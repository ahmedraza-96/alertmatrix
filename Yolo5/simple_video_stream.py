#!/usr/bin/env python3
"""
Simple Video Streaming Service for AlertMatrix
Basic video streaming without detection to test the setup
"""

import cv2
import time
import logging
from flask import Flask, Response, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables
current_frame = None
cap = None

def initialize_camera():
    """Initialize camera"""
    global cap
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            logger.error("Cannot open camera")
            return False
        
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        logger.info("Camera initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize camera: {e}")
        return False

def generate_frames():
    """Generate video frames"""
    global cap
    while True:
        if cap is None:
            if not initialize_camera():
                time.sleep(1)
                continue
        
        ret, frame = cap.read()
        if not ret:
            logger.warning("Failed to read frame")
            time.sleep(0.1)
            continue
        
        # Add timestamp to frame
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, timestamp, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ret:
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>AlertMatrix - Simple Video Stream</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; background: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .video-container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            img { max-width: 100%; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📹 AlertMatrix - Simple Video Stream</h1>
            <div class="video-container">
                <img src="/video_feed" alt="Live Video Stream">
            </div>
            <p><em>Basic video streaming test</em></p>
        </div>
    </body>
    </html>
    '''

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/status')
def status():
    return jsonify({
        'status': 'active',
        'camera_id': 'test-camera',
        'type': 'simple_stream'
    })

if __name__ == '__main__':
    logger.info("Starting simple video streaming service...")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True) 