#!/usr/bin/env python3
"""
Minimal test streaming service
"""

from flask import Flask, Response, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

def generate_test_frames():
    """Generate test frames"""
    while True:
        # Simple test frame data
        test_frame = b"test frame data"
        yield (b'--frame\r\n'
               b'Content-Type: text/plain\r\n\r\n' + test_frame + b'\r\n')
        time.sleep(1)

@app.route('/')
def index():
    return '<h1>Test Stream Service</h1><p>Service is running!</p>'

@app.route('/video_feed')
def video_feed():
    return Response(generate_test_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/status')
def status():
    return jsonify({
        'status': 'active',
        'service': 'test'
    })

if __name__ == '__main__':
    print("Starting test stream service on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False) 