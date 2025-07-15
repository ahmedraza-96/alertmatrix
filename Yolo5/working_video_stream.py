#!/usr/bin/env python3
"""
Working Video Streaming Service for AlertMatrix
Simplified version that focuses on reliable video streaming
"""

import cv2
import time
import logging
import threading
import os
import sys
from flask import Flask, Response, render_template_string, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Global variables
camera_lock = threading.Lock()
current_frame = None
camera_active = False
frame_count = 0
service_start_time = time.time()

class VideoStreamer:
    def __init__(self):
        self.cap = None
        self.running = False
        self.camera_index = 0
        self.fallback_indexes = [0, 1, 2]  # Try these camera indexes if primary fails
        
    def initialize_camera(self, try_alternatives=True):
        """Initialize camera with fallback options"""
        if self.cap is not None and self.cap.isOpened():
            return True
            
        # Try primary camera index first
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if self.cap.isOpened():
                # Set camera properties
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_FPS, 30)
                
                logger.info(f"Camera initialized successfully with index {self.camera_index}")
                return True
        except Exception as e:
            logger.error(f"Failed to initialize camera {self.camera_index}: {e}")
            
        # Try alternative camera indexes if primary fails
        if try_alternatives:
            for idx in self.fallback_indexes:
                if idx == self.camera_index:
                    continue  # Skip the one we already tried
                    
                try:
                    logger.info(f"Trying alternative camera index {idx}...")
                    self.cap = cv2.VideoCapture(idx)
                    if self.cap.isOpened():
                        self.camera_index = idx  # Remember successful index
                        # Set camera properties
                        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        self.cap.set(cv2.CAP_PROP_FPS, 30)
                        
                        logger.info(f"Camera initialized successfully with index {idx}")
                        return True
                except Exception as e:
                    logger.error(f"Failed to initialize camera {idx}: {e}")
        
        logger.error("All camera initialization attempts failed")
        return False
    
    def start_capture(self):
        """Start camera capture in a separate thread"""
        if not self.initialize_camera():
            logger.error("Cannot start capture - camera initialization failed")
            return False
            
        self.running = True
        capture_thread = threading.Thread(target=self._capture_loop)
        capture_thread.daemon = True
        capture_thread.start()
        return True
        
    def _capture_loop(self):
        """Main capture loop"""
        global current_frame, camera_active, frame_count
        
        while self.running:
            try:
                if not self.cap or not self.cap.isOpened():
                    logger.warning("Camera connection lost, attempting to reconnect...")
                    if not self.initialize_camera():
                        time.sleep(2)  # Wait before retry
                        continue
                
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame")
                    time.sleep(0.1)
                    continue
                
                # Add timestamp overlay
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                cv2.putText(frame, f"AlertMatrix Live Feed - {timestamp}", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
                # Add status indicator
                cv2.circle(frame, (620, 20), 8, (0, 255, 0), -1)  # Green dot for active
                cv2.putText(frame, "LIVE", (580, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Add frame counter
                frame_count += 1
                if frame_count % 100 == 0:
                    logger.info(f"Processed {frame_count} frames")
                
                with camera_lock:
                    current_frame = frame.copy()
                    camera_active = True
                    
                time.sleep(0.033)  # ~30 FPS
                
            except Exception as e:
                logger.error(f"Error in capture loop: {e}")
                time.sleep(1)
    
    def stop_capture(self):
        """Stop camera capture"""
        self.running = False
        if self.cap:
            self.cap.release()
            self.cap = None

# Initialize video streamer
streamer = VideoStreamer()

def generate_frames():
    """Generate frames for streaming"""
    global current_frame, camera_active
    
    while True:
        with camera_lock:
            if current_frame is not None:
                # Get quality parameter from request
                quality = request.args.get('quality', 'auto')
                
                # Adjust JPEG quality based on requested quality
                if quality == 'low':
                    jpeg_quality = 50
                elif quality == 'medium':
                    jpeg_quality = 70
                elif quality == 'high':
                    jpeg_quality = 90
                else:  # auto
                    jpeg_quality = 85
                
                # Encode frame as JPEG
                ret, buffer = cv2.imencode('.jpg', current_frame, 
                                         [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            else:
                # Send placeholder frame if no camera
                placeholder = create_placeholder_frame()
                ret, buffer = cv2.imencode('.jpg', placeholder, 
                                         [cv2.IMWRITE_JPEG_QUALITY, 85])
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS

def create_placeholder_frame():
    """Create a placeholder frame when camera is not available"""
    import numpy as np
    
    # Create a black frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add placeholder text
    text_lines = [
        "AlertMatrix Video Stream",
        "Camera Not Available",
        "Please check camera connection",
        time.strftime("%Y-%m-%d %H:%M:%S")
    ]
    
    y_offset = 180
    for i, line in enumerate(text_lines):
        cv2.putText(frame, line, (50, y_offset + i * 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (128, 128, 128), 2)
    
    return frame

@app.route('/')
def index():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>AlertMatrix - Live Video Stream</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                color: white;
                margin: 0;
                padding: 20px;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px; 
            }
            .video-container { 
                background: rgba(255,255,255,0.1); 
                padding: 20px; 
                border-radius: 15px; 
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                margin: 20px 0;
            }
            img { 
                max-width: 100%; 
                border-radius: 10px; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            .status { 
                margin: 20px 0; 
                padding: 15px; 
                background: rgba(76, 175, 80, 0.2); 
                border-radius: 10px; 
                border-left: 4px solid #4CAF50;
            }
            .info {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin: 10px 0;
            }
            h1 { margin-bottom: 10px; }
            .emoji { font-size: 2em; margin: 0 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1><span class="emoji">🎯</span>AlertMatrix - Live Detection Feed<span class="emoji">📹</span></h1>
            <div class="status">
                <p><strong>🟢 Status:</strong> Video Streaming Active</p>
                <p><strong>📷 Camera:</strong> Primary Webcam</p>
            </div>
            <div class="video-container">
                <img src="{{ url_for('video_feed') }}" alt="Live Video Stream" id="videoStream">
            </div>
            <div class="info">
                <p><em>Real-time video streaming for AlertMatrix security system</em></p>
                <p>🔄 Auto-refresh • 📡 Live Feed • 🎥 30 FPS</p>
            </div>
        </div>
        
        <script>
            // Auto-reload on error
            document.getElementById('videoStream').onerror = function() {
                setTimeout(() => {
                    this.src = this.src + '?t=' + new Date().getTime();
                }, 5000);
            };
        </script>
    </body>
    </html>
    ''')

@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    # Add CORS headers for video streaming
    response = Response(generate_frames(),
                      mimetype='multipart/x-mixed-replace; boundary=frame')
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control')
    response.headers.add('Access-Control-Expose-Headers', 'Content-Type, Content-Length')
    response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.add('Pragma', 'no-cache')
    response.headers.add('Expires', '0')
    return response

@app.route('/video_feed', methods=['OPTIONS'])
def video_feed_options():
    """Handle CORS preflight for video_feed"""
    response = Response()
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response

@app.route('/api/status')
def status():
    """Status endpoint for the mobile app"""
    global camera_active, frame_count, service_start_time
    
    uptime = int(time.time() - service_start_time)
    hours, remainder = divmod(uptime, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    return jsonify({
        'status': 'active' if camera_active else 'inactive',
        'camera_id': 'primary-webcam',
        'service': 'working_video_stream',
        'streaming': camera_active,
        'timestamp': time.time(),
        'frames_processed': frame_count,
        'uptime': uptime_str,
        'server_info': {
            'host': request.host,
            'remote_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', 'Unknown')
        }
    })

@app.route('/api/health')
def health():
    """Health check endpoint"""
    global camera_active
    
    if camera_active:
        return jsonify({'status': 'healthy'}), 200
    else:
        return jsonify({'status': 'unhealthy', 'reason': 'Camera not active'}), 503

@app.route('/snapshot')
def snapshot():
    """Return a single snapshot from the camera"""
    global current_frame
    
    with camera_lock:
        if current_frame is not None:
            ret, buffer = cv2.imencode('.jpg', current_frame)
            if ret:
                response = Response(buffer.tobytes(), mimetype='image/jpeg')
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
    
    # Return placeholder if no frame available
    placeholder = create_placeholder_frame()
    ret, buffer = cv2.imencode('.jpg', placeholder)
    response = Response(buffer.tobytes(), mimetype='image/jpeg')
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

def main():
    """Main entry point"""
    try:
        # Get port from command line or use default
        port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
        
        print(f"🎥 AlertMatrix Video Streaming Service")
        print("=" * 50)
        print(f"Starting video server on port {port}...")
        print("Web interface: http://localhost:{port}")
        print("Video feed: http://localhost:{port}/video_feed")
        print("Status API: http://localhost:{port}/api/status")
        print("=" * 50)
        
        # Start video capture
        streamer.start_capture()
        
        # Start Flask server
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
        
    except KeyboardInterrupt:
        print("\nShutting down video service...")
    except Exception as e:
        print(f"Error starting service: {e}")
    finally:
        streamer.stop_capture()

if __name__ == "__main__":
    main() 