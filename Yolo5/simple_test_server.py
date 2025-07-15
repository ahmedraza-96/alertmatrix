#!/usr/bin/env python3
"""
Simple test server for video streaming
"""

import cv2
import time
from flask import Flask, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def generate_test_frames():
    """Generate test frames from camera"""
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Cannot open camera")
        return
    
    # Set camera properties
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("✅ Camera initialized")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break
        
        # Add test text overlay
        cv2.putText(frame, f"Test Stream - {time.strftime('%H:%M:%S')}", 
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ret:
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS
    
    cap.release()

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head><title>Test Video Stream</title></head>
    <body style="background: #000; color: white; text-align: center; padding: 20px;">
        <h1>🎥 Test Video Stream</h1>
        <img src="/video_feed" style="max-width: 100%; border: 2px solid #fff;">
        <p>Simple camera test without YOLO detection</p>
    </body>
    </html>
    '''

@app.route('/video_feed')
def video_feed():
    return Response(generate_test_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/status')
def status():
    return {
        'status': 'active',
        'service': 'test-camera',
        'timestamp': time.time()
    }

if __name__ == '__main__':
    print("🎯 Starting Simple Test Server")
    print("📷 Testing camera access...")
    print("🌐 Server will run on http://localhost:5000")
    print("🎥 Video feed: http://localhost:5000/video_feed")
    print("📊 Status: http://localhost:5000/api/status")
    print("=" * 50)
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    except Exception as e:
        print(f"❌ Server error: {e}") 