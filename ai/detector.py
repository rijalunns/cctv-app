"""
detector.py - AI Detection Engine for CCTV Dahua
Supports: HOG (builtin) dan YOLOv8n ONNX (if model available)
Added: Event-based recording (ffmpeg)
"""

import cv2
import numpy as np
import time
import os
import base64
import logging
import subprocess

logging.basicConfig(level=logging.INFO, format='[DETECTOR] %(asctime)s %(message)s')
log = logging.getLogger(__name__)

RTSP_URL = os.environ.get(
    'RTSP_URL',
    'rtsp://admin:admin2008@192.168.1.2:554/cam/realmonitor?channel=1&subtype=1'
)

YOLO_MODEL_PATH = '/app/models/yolov8n.onnx'
SNAPSHOT_DIR = '/app/snapshots'
RECORD_DIR = '/app/recordings'
os.makedirs(SNAPSHOT_DIR, exist_ok=True)
os.makedirs(RECORD_DIR, exist_ok=True)

# COCO class names (index 0 = person)
COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorbike', 'aeroplane', 'bus', 'train',
    'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign',
    'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep',
    'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
    'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
    'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard',
    'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork',
    'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
    'sofa', 'pottedplant', 'bed', 'diningtable', 'toilet', 'tvmonitor',
    'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave',
    'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
    'scissors', 'teddy bear', 'hair drier', 'toothbrush'
]

class CCTVDetector:
    def __init__(self):
        self.use_yolo = False
        self.net = None
        self.hog = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(YOLO_MODEL_PATH) and os.path.getsize(YOLO_MODEL_PATH) > 1000:
            try:
                self.net = cv2.dnn.readNetFromONNX(YOLO_MODEL_PATH)
                self.use_yolo = True
                log.info("✅ YOLOv8n ONNX model loaded!")
            except Exception as e:
                log.warning(f"⚠️  YOLOv8n failed ({e}), falling back to HOG")
        
        if not self.use_yolo:
            self.hog = cv2.HOGDescriptor()
            self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            log.info("✅ HOG People Detector loaded (fallback mode)")

    def detect(self, frame):
        """Returns list of detections: [{label, confidence, box}]"""
        if self.use_yolo:
            return self._detect_yolo(frame)
        else:
            return self._detect_hog(frame)

    def _detect_hog(self, frame):
        resized = cv2.resize(frame, (640, 480))
        boxes, weights = self.hog.detectMultiScale(
            resized, winStride=(8, 8), padding=(4, 4), scale=1.05
        )
        detections = []
        scale_x = frame.shape[1] / 640
        scale_y = frame.shape[0] / 480
        for (x, y, w, h), weight in zip(boxes, weights):
            if weight[0] > 0.4:
                detections.append({
                    'label': 'person',
                    'confidence': float(weight[0]),
                    'box': [int(x*scale_x), int(y*scale_y), int(w*scale_x), int(h*scale_y)]
                })
        return detections

    def _detect_yolo(self, frame):
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(frame, 1/255.0, (640, 640), swapRB=True, crop=False)
        self.net.setInput(blob)
        outputs = self.net.forward()
        
        detections = []
        output = outputs[0]
        if len(output.shape) == 3:
            output = output[0]

        for det in output.T:
            scores = det[4:]
            class_id = np.argmax(scores)
            confidence = float(scores[class_id])
            if confidence < 0.4:
                continue
            # Only person, car, motorbike
            if class_id not in [0, 2, 3]:
                continue
            cx, cy, bw, bh = det[:4]
            x1 = int((cx - bw/2) * w / 640)
            y1 = int((cy - bh/2) * h / 640)
            bw_px = int(bw * w / 640)
            bh_px = int(bh * h / 640)
            label = COCO_CLASSES[class_id] if class_id < len(COCO_CLASSES) else str(class_id)
            detections.append({
                'label': label,
                'confidence': confidence,
                'box': [x1, y1, bw_px, bh_px]
            })
        return detections


def draw_detections(frame, detections):
    """Draw bounding boxes on frame"""
    for det in detections:
        x, y, w, h = det['box']
        label = f"{det['label']} {det['confidence']:.2f}"
        color = (0, 255, 100) if det['label'] == 'person' else (0, 200, 255)
        cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
        cv2.putText(frame, label, (x, y-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    return frame

def frame_to_base64(frame):
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return base64.b64encode(buf).decode('utf-8')

def save_snapshot(frame, label):
    ts = time.strftime('%Y%m%d_%H%M%S')
    path = f"{SNAPSHOT_DIR}/{ts}_{label}.jpg"
    cv2.imwrite(path, frame)
    return path

def trigger_recording(label, duration_sec=15):
    """Start ffmpeg to capture stream copy into MP4"""
    ts = time.strftime('%Y%m%d_%H%M%S')
    filename = f"{ts}_{label}.mp4"
    out_path = f"{RECORD_DIR}/{filename}"
    
    cmd = [
        'ffmpeg', '-y', '-rtsp_transport', 'tcp', '-i', RTSP_URL,
        '-t', str(duration_sec), '-c', 'copy', out_path
    ]
    # Fire and forget (subprocess.Popen) so it doesn't block AI loop
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    return out_path