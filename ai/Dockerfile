FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    opencv-python-headless==4.8.1.78 \
    numpy==1.26.4 \
    requests \
    flask

WORKDIR /app

# Download YOLOv8n ONNX model
RUN mkdir -p models && \
    curl -L -o models/yolov8n.onnx \
    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx" || true

COPY detector.py .
COPY server.py .

EXPOSE 5050

CMD ["python", "server.py"]
