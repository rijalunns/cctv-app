"""
server.py - Flask API to serve AI Detections
Added: MP4 event records and auto-cleaner (3 days)
"""

from flask import Flask, jsonify, send_from_directory
import threading
import time
import cv2
import sqlite3
import os
import logging
import glob
from detector import CCTVDetector, draw_detections, frame_to_base64, save_snapshot, trigger_recording, RTSP_URL, SNAPSHOT_DIR, RECORD_DIR

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # Max 50MB upload limit to prevent DoS

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum allowed size is 50MB.'}), 413
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

DB_PATH = '/app/data/events.db'

latest_snapshot = None
latest_detections = []

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS events
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                  label TEXT,
                  confidence REAL,
                  snapshot_path TEXT,
                  video_path TEXT)''')
    # Add video_path column if upgrading old DB
    try:
        c.execute("ALTER TABLE events ADD COLUMN video_path TEXT")
    except:
        pass
    conn.commit()
    conn.close()

def log_event(label, conf, snap_path, vid_path):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO events (label, confidence, snapshot_path, video_path) VALUES (?, ?, ?, ?)",
              (label, conf, os.path.basename(snap_path), os.path.basename(vid_path)))
    conn.commit()
    conn.close()

def auto_clean_worker():
    """Delete files older than 3 days"""
    while True:
        try:
            now = time.time()
            cutoff = now - (3 * 24 * 60 * 60) # 3 days in seconds
            
            # Clean snapshots
            for f in glob.glob(os.path.join(SNAPSHOT_DIR, "*.jpg")):
                if os.path.getmtime(f) < cutoff:
                    os.remove(f)
                    
            # Clean videos
            for f in glob.glob(os.path.join(RECORD_DIR, "*.mp4")):
                if os.path.getmtime(f) < cutoff:
                    os.remove(f)
            
            # Clean DB
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("DELETE FROM events WHERE timestamp <= datetime('now', '-3 days')")
            conn.commit()
            conn.close()
            
        except Exception as e:
            logging.error(f"Auto-clean error: {e}")
            
        time.sleep(3600) # Check every hour

def camera_worker():
    global latest_snapshot, latest_detections
    detector = CCTVDetector()
    cap = cv2.VideoCapture(RTSP_URL)
    
    frame_count = 0
    cooldown_until = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            logging.error("Failed to read RTSP. Reconnecting in 5s...")
            time.sleep(5)
            cap = cv2.VideoCapture(RTSP_URL)
            continue
        
        frame_count += 1
        if frame_count % 15 != 0:
            continue
        
        now = time.time()
        dets = detector.detect(frame)
        
        if dets:
            frame_annotated = draw_detections(frame.copy(), dets)
            latest_snapshot = frame_to_base64(frame_annotated)
            latest_detections = dets
            
            # Save event to DB max once every 20 seconds (so videos don't overlap)
            if now > cooldown_until:
                top_det = sorted(dets, key=lambda x: x['confidence'], reverse=True)[0]
                snap_path = save_snapshot(frame_annotated, top_det['label'])
                vid_path = trigger_recording(top_det['label'], duration_sec=15)
                log_event(top_det['label'], top_det['confidence'], snap_path, vid_path)
                cooldown_until = now + 20
                logging.info(f"🚨 DETECTED: {top_det['label']} ({top_det['confidence']:.2f}) -> Recording 15s MP4")

@app.route('/api/live', methods=['GET'])
def get_live():
    return jsonify({
        'status': 'ok',
        'detections': latest_detections,
        'snapshot_b64': latest_snapshot
    })

@app.route('/api/events', methods=['GET'])
def get_events():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, datetime(timestamp, 'localtime'), label, confidence, snapshot_path, video_path FROM events ORDER BY id DESC LIMIT 20")
    rows = c.fetchall()
    conn.close()
    
    events = []
    for r in rows:
        events.append({
            'id': r[0],
            'time': r[1],
            'type': r[2].upper() + ' DETECTED',
            'desc': f"AI Confidence: {r[3]:.2f}",
            'snapshot': f"/snapshots/{r[4]}" if r[4] else None,
            'video': f"/recordings/{r[5]}" if r[5] else None
        })
    return jsonify(events)

import subprocess

CONVERT_DIR = '/tmp/cctv_convert'
os.makedirs(CONVERT_DIR, exist_ok=True)

@app.route('/api/convert', methods=['POST'])
def convert_dav():
    from flask import request
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.dav'):
        return jsonify({'error': 'File must be .dav extension'}), 400
    
    ts = time.strftime('%Y%m%d_%H%M%S')
    clean_name = os.path.splitext(os.path.basename(file.filename))[0]
    dav_path = os.path.join(CONVERT_DIR, f"{ts}_{clean_name}.dav")
    mp4_filename = f"{clean_name}_converted.mp4"
    mp4_path = os.path.join(RECORD_DIR, mp4_filename)
    
    file.save(dav_path)
    
    # Run ffmpeg stream copy conversion
    cmd = ['ffmpeg', '-y', '-i', dav_path, '-c:v', 'copy', '-c:a', 'aac', mp4_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    # Cleanup temp .dav file
    if os.path.exists(dav_path):
        os.remove(dav_path)
        
    if res.returncode == 0 and os.path.exists(mp4_path):
        return jsonify({
            'status': 'success',
            'filename': mp4_filename,
            'download_url': f'/recordings/{mp4_filename}'
        })
    else:
        # Fallback ffmpeg re-encode if stream copy fails
        cmd_reencode = ['ffmpeg', '-y', '-i', dav_path, '-c:v', 'libx264', '-preset', 'ultrafast', mp4_path]
        res_re = subprocess.run(cmd_reencode, capture_output=True, text=True)
        if res_re.returncode == 0 and os.path.exists(mp4_path):
            return jsonify({
                'status': 'success',
                'filename': mp4_filename,
                'download_url': f'/recordings/{mp4_filename}'
            })
        return jsonify({'error': 'Conversion failed', 'details': res.stderr}), 500

@app.route('/snapshots/<filename>')
def get_snapshot(filename):
    return send_from_directory(SNAPSHOT_DIR, filename)

@app.route('/recordings/<filename>')
def get_recording(filename):
    return send_from_directory(RECORD_DIR, filename)


if __name__ == '__main__':
    init_db()
    logging.info("Starting AI Camera Worker...")
    threading.Thread(target=camera_worker, daemon=True).start()
    
    logging.info("Starting Auto-Cleaner Worker (3-day retention)...")
    threading.Thread(target=auto_clean_worker, daemon=True).start()
    
    logging.info("Starting API Server on port 5050...")
    app.run(host='0.0.0.0', port=5050)
