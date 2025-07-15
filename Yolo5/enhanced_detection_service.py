#!/usr/bin/env python3
"""
Enhanced Detection Service
Real-time object detection with video streaming and alert notifications
Integrates with the existing AlertMatrix backend
"""

import cv2
import torch
import numpy as np
import time
import logging
import requests
import base64
import json
import threading
from datetime import datetime
import argparse
from flask import Flask, Response, render_template_string, jsonify
from flask_cors import CORS
import os
import traceback

# Fix for Windows/Linux path compatibility issue
import pathlib
temp = pathlib.PosixPath
pathlib.PosixPath = pathlib.WindowsPath

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure PyTorch loads full checkpoints (not weights_only) to avoid "Weights only load failed" errors
os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

class EnhancedDetectionService:
    def __init__(self, 
                 confidence_threshold: float = 0.5,  # Increased for better accuracy
                 backend_url: str = "http://localhost:8000",
                 camera_id: str = "webcam-01",
                 cooldown_seconds: int = 10):
        """
        Initialize the Enhanced Detection Service
        
        Args:
            confidence_threshold: Minimum confidence for detection (increased to 0.5 for better accuracy)
            backend_url: Backend server URL for alerts
            camera_id: Camera identifier
            cooldown_seconds: Cooldown between alerts for same detection type
        """
        self.confidence_threshold = confidence_threshold
        self.alert_threshold = 0.7  # Higher threshold for sending alerts
        self.backend_url = backend_url.rstrip('/')
        self.camera_id = camera_id
        self.cooldown_seconds = cooldown_seconds
        
        # State tracking
        self.detection_count = 0
        self.last_gun_alert = 0
        self.last_knife_alert = 0
        self.frame_detections = 0  # Track detections per frame
        
        # Video streaming
        self.current_frame = None
        self.frame_lock = threading.Lock()
        
        # Initialize models and camera
        self.weapon_model = None   # Fine-tuned gun/knife model (best.pt)
        self.cap = None
        
        # Flask app for video streaming
        self.app = Flask(__name__)
        CORS(self.app)
        self.setup_flask_routes()
        
        logger.info(f"🔫 Enhanced Detection Service initialized")
        logger.info(f"   Backend: {backend_url}")
        logger.info(f"   Camera ID: {camera_id}")
        logger.info(f"   Detection Threshold: {confidence_threshold}")
        logger.info(f"   Alert Threshold: {self.alert_threshold}")
        logger.info(f"   Cooldown: {cooldown_seconds}s")
        
        self.register_camera_with_backend()
    
    def validate_model(self) -> bool:
        """Validate that the loaded model is working correctly"""
        try:
            if self.weapon_model is None:
                logger.error("❌ Model not loaded")
                return False
            
            # Create a test image (black image)
            test_image = np.zeros((640, 640, 3), dtype=np.uint8)
            
            # Run inference on test image
            results = self.weapon_model(test_image)
            
            # Check if results are in expected format
            if isinstance(results, list) and len(results) > 0:
                result = results[0]
                if hasattr(result, 'boxes') and result.boxes is not None:
                    logger.info("✅ Model validation successful - inference working")
                    return True
            
            logger.warning("⚠️ Model validation failed - unexpected result format")
            return False
            
        except Exception as e:
            logger.error(f"❌ Model validation failed: {e}")
            return False
    
    def setup_flask_routes(self):
        """Setup Flask routes for video streaming"""
        
        @self.app.route('/')
        def index():
            return render_template_string('''
            <!DOCTYPE html>
            <html>
            <head>
                <title>AlertMatrix - Live Video Stream</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background: #f0f0f0; }
                    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                    .video-container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    img { max-width: 100%; border-radius: 8px; }
                    .status { margin: 20px 0; padding: 10px; background: #e8f5e8; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔫 AlertMatrix - Live Detection Feed</h1>
                    <div class="status">
                        <p><strong>Status:</strong> Active Detection</p>
                        <p><strong>Camera:</strong> {{ camera_id }}</p>
                    </div>
                    <div class="video-container">
                        <img src="{{ url_for('video_feed') }}" alt="Live Video Stream">
                    </div>
                    <p><em>Real-time object detection with gun and knife alerts</em></p>
                </div>
            </body>
            </html>
            ''', camera_id=self.camera_id)
        
        @self.app.route('/video_feed')
        def video_feed():
            def generate_with_headers():
                for frame_data in self.generate_frames():
                    yield frame_data
            
            response = Response(generate_with_headers(),
                              mimetype='multipart/x-mixed-replace; boundary=frame')
            
            # Add CORS headers for cross-origin requests
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS, HEAD'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Cache-Control'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Content-Length'
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            
            return response
        
        @self.app.route('/video_feed', methods=['OPTIONS'])
        def video_feed_options():
            response = Response()
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS, HEAD'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Cache-Control'
            response.headers['Access-Control-Max-Age'] = '3600'
            return response
        
        @self.app.route('/api/status')
        def status():
            return jsonify({
                'status': 'active',
                'camera_id': self.camera_id,
                'detection_count': self.detection_count,
                'confidence_threshold': self.confidence_threshold
            })
    
    def generate_frames(self):
        """Generate video frames for streaming"""
        while True:
            with self.frame_lock:
                if self.current_frame is not None:
                    ret, buffer = cv2.imencode('.jpg', self.current_frame, 
                                             [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ret:
                        frame = buffer.tobytes()
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.1)  # Control frame rate
    
    def load_models(self) -> bool:
        """Load the fine-tuned weapon model"""
        try:
            # Try multiple possible paths for the model
            possible_paths = [
                # Primary path
                os.path.join(
                    os.path.dirname(__file__),
                    'Weapons-and-Knives-Detector-with-YOLOv8',
                    'runs', 'detect', 'Normal_Compressed', 'weights', 'best.pt'
                ),
                # Secondary fallback
                os.path.join(
                    os.getcwd(), 'Yolo5',
                    'Weapons-and-Knives-Detector-with-YOLOv8',
                    'runs', 'detect', 'Normal_Compressed', 'weights', 'best.pt'
                ),
                # Alternative model paths
                os.path.join(os.path.dirname(__file__), 'best.pt'),
                os.path.join(os.getcwd(), 'Yolo5', 'best.pt'),
                # YOLOv5 model as fallback
                os.path.join(os.path.dirname(__file__), 'yolov5', 'best.pt'),
            ]

            weapon_model_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    weapon_model_path = path
                    logger.info(f"✅ Found model at: {path}")
                    break

            if not weapon_model_path:
                logger.error("❌ No weapon model found. Tried paths:")
                for path in possible_paths:
                    logger.error(f"   - {path}")
                return False

            logger.info("📦 Loading YOLOv8 gun/knife model from %s", weapon_model_path)

            from ultralytics import YOLO  # local import to avoid mandatory dep when not needed

            self.weapon_model = YOLO(weapon_model_path)

            # Configure runtime settings
            self.weapon_model.overrides["conf"] = self.confidence_threshold
            self.weapon_model.overrides["iou"] = 0.45

            # Log model information for debugging
            logger.info("✅ Weapon model loaded successfully")
            logger.info(f"   Model classes: {self.weapon_model.names}")
            logger.info(f"   Number of classes: {len(self.weapon_model.names)}")
            logger.info(f"   Confidence threshold: {self.confidence_threshold}")
            logger.info(f"   IOU threshold: {self.weapon_model.overrides['iou']}")
            
            # Validate model classes
            expected_classes = ['gun', 'knife']
            actual_classes = list(self.weapon_model.names.values())
            logger.info(f"   Expected classes: {expected_classes}")
            logger.info(f"   Actual classes: {actual_classes}")
            
            # Check for class name mismatches
            if not all(cls in actual_classes for cls in expected_classes):
                logger.warning("⚠️ Model classes don't match expected classes!")
                logger.warning(f"   Missing classes: {[cls for cls in expected_classes if cls not in actual_classes]}")
                logger.warning(f"   Extra classes: {[cls for cls in actual_classes if cls not in expected_classes]}")
            
            return True

        except Exception as e:
            logger.error("❌ Failed to load fine-tuned model: %s", e)
            traceback.print_exc()
            return False
    
    def initialize_camera(self, camera_index: int = 0) -> bool:
        """Initialize camera capture"""
        try:
            self.cap = cv2.VideoCapture(camera_index)
            if not self.cap.isOpened():
                logger.error(f"❌ Cannot open camera {camera_index}")
                return False
            
            # Set camera properties
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            
            logger.info(f"✅ Camera initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize camera: {e}")
            return False
    
    def encode_image_to_base64(self, frame: np.ndarray) -> str:
        """Convert frame to base64 string"""
        try:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            image_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{image_base64}"
        except Exception as e:
            logger.error(f"❌ Failed to encode image: {e}")
            return ""
    
    def send_alert(self, detection_type: str, confidence: float, frame: np.ndarray) -> bool:
        """Send alert to backend server"""
        try:
            current_time = time.time()
            
            # Check cooldown period for specific detection type
            last_alert_time = self.last_gun_alert if detection_type == 'gun' else self.last_knife_alert
            
            if current_time - last_alert_time < self.cooldown_seconds:
                logger.debug(f"⏳ {detection_type.upper()} alert cooldown active, skipping...")
                return False
            
            # Prepare alert data
            alert_data = {
                "camera_id": self.camera_id,
                "timestamp": datetime.now().isoformat(),
                "confidence": float(confidence),
                "detection_type": detection_type,
                "image_base64": self.encode_image_to_base64(frame)
            }
            
            # Send POST request to backend
            response = requests.post(
                f"{self.backend_url}/api/alert",
                json=alert_data,
                timeout=5,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                # Update cooldown timer
                if detection_type == 'gun':
                    self.last_gun_alert = current_time
                else:
                    self.last_knife_alert = current_time
                
                self.detection_count += 1
                logger.warning(f"🚨 ALERT SENT: {detection_type.upper()} detected! "
                             f"Confidence: {confidence:.2%} | Total alerts: {self.detection_count}")
                return True
            else:
                logger.error(f"❌ Failed to send alert: HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error sending alert: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error sending alert: {e}")
            return False
    
    def process_detections(self, results, frame: np.ndarray, model, send_alerts: bool = False) -> list:
        """Process YOLO detection results, draw bounding boxes, and optionally send alerts"""
        detections = []
        frame_detection_count = 0
        
        # Initialize empty prediction array
        pred = np.empty((0, 6))

        # Handle ultralytics YOLO results (which returns a list of Results objects)
        if isinstance(results, list) and len(results) > 0:
            # Take the first result (single image inference)
            result = results[0]
            if hasattr(result, 'boxes') and result.boxes is not None:
                boxes = result.boxes
                if len(boxes) > 0:
                    # Extract detection data from ultralytics boxes
                    xyxy = boxes.xyxy.cpu().numpy()  # Bounding boxes
                    conf = boxes.conf.cpu().numpy().reshape(-1, 1)  # Confidence scores
                    cls = boxes.cls.cpu().numpy().reshape(-1, 1)   # Class indices
                    
                    # Combine into standard format: [x1, y1, x2, y2, conf, cls]
                    pred = np.hstack([xyxy, conf, cls])
                    
                    # Ensure 2D array shape for consistent processing
                    if pred.ndim == 1:
                        pred = pred.reshape(1, -1)
        
        # Handle single ultralytics YOLOv8 Results object (fallback)
        elif hasattr(results, 'boxes') and results.boxes is not None:
            boxes = results.boxes
            if len(boxes) > 0:
                # Extract detection data from ultralytics boxes
                xyxy = boxes.xyxy.cpu().numpy()  # Bounding boxes
                conf = boxes.conf.cpu().numpy().reshape(-1, 1)  # Confidence scores
                cls = boxes.cls.cpu().numpy().reshape(-1, 1)   # Class indices
                
                # Combine into standard format: [x1, y1, x2, y2, conf, cls]
                pred = np.hstack([xyxy, conf, cls])
                
                # Ensure 2D array shape for consistent processing
                if pred.ndim == 1:
                    pred = pred.reshape(1, -1)
        
        # Handle YOLOv5 torch.hub results
        elif hasattr(results, 'xyxy'):
            pred = results.xyxy[0].cpu().numpy()

        # At this point, pred should always be a numpy array
        # Validate prediction array shape
        if isinstance(pred, np.ndarray) and pred.size > 0:
            # Ensure we have the expected number of columns
            if len(pred.shape) < 2 or pred.shape[1] < 6:
                logger.warning(f"⚠️ Unexpected prediction shape: {pred.shape}, expected (N, 6)")
                pred = np.empty((0, 6))  # Reset to empty if malformed

        logger.debug(f"🔍 Raw detections: {len(pred)} objects found")
        
        # Get model class names for validation
        model_classes = list(model.names.values()) if hasattr(model, 'names') else []
        logger.debug(f"   Model classes: {model_classes}")
        
        # Process each detection
        for i, detection in enumerate(pred):
            if len(detection) < 6:
                logger.warning(f"⚠️ Skipping malformed detection {i}: {detection}")
                continue
                
            # Unpack detection: [x1, y1, x2, y2, conf, cls]
            x1, y1, x2, y2, conf, cls = detection
            class_id = int(cls)
            
            # Safely get class name
            try:
                class_name = model.names[class_id]
            except (KeyError, IndexError) as e:
                logger.warning(f"⚠️ Invalid class ID {class_id} for detection {i}: {e}")
                continue
            
            # Log all detections for debugging
            logger.debug(f"   Detection {i+1}: {class_name} @ {conf:.3f} confidence")
            
            # Display all detections above threshold
            if conf >= self.confidence_threshold:
                frame_detection_count += 1
                detections.append((class_name, conf, [x1, y1, x2, y2]))
                
                # Get bounding box coordinates as integers
                x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                
                # Determine if this is a weapon - handle various class name formats
                weapon_classes = ['gun', 'knife', 'guns', 'knives']  # Handle both singular and plural
                is_weapon = any(weapon in class_name.lower() for weapon in weapon_classes)
                
                # Set colors based on detection type and confidence
                if is_weapon:
                    if conf >= self.alert_threshold:
                        # High confidence weapon - bright alert colors
                        if any(gun_type in class_name.lower() for gun_type in ['gun', 'guns']):
                            color = (0, 0, 255)  # Bright red for gun
                            alert_color = (0, 0, 255)
                            weapon_type = 'gun'
                        else:
                            color = (0, 165, 255)  # Orange for knife
                            alert_color = (0, 165, 255)
                            weapon_type = 'knife'
                        thickness = 3
                        
                        # Send alert for high-confidence weapons
                        if send_alerts:
                            self.send_alert(weapon_type, conf, frame)
                        
                        # Add prominent warning text
                        warning_text = f'⚠️ {weapon_type.upper()} DETECTED! {conf:.1%}'
                        cv2.putText(frame, warning_text, (10, 60 + (20 * frame_detection_count)), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, alert_color, 2)
                    else:
                        # Lower confidence weapon - dimmer colors
                        if any(gun_type in class_name.lower() for gun_type in ['gun', 'guns']):
                            color = (0, 0, 180)  # Dimmer red
                        else:
                            color = (0, 140, 220)  # Dimmer orange
                        thickness = 2
                else:
                    # Non-weapon detection (shouldn't happen with gun/knife model)
                    color = (128, 128, 128)  # Gray
                    thickness = 1
                    logger.debug(f"   Non-weapon detection: {class_name}")
                
                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
                
                # Add label with confidence
                label = f'{class_name}: {conf:.2%}'
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                
                # Draw label background
                cv2.rectangle(frame, (x1, y1 - label_size[1] - 10), 
                            (x1 + label_size[0], y1), color, -1)
                
                # Draw label text
                cv2.putText(frame, label, (x1, y1 - 5), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
                
                # Add detection indicator dot
                center_x, center_y = (x1 + x2) // 2, (y1 + y2) // 2
                cv2.circle(frame, (center_x, center_y), 3, color, -1)
        
        # Add detection summary to frame
        detection_text = f"Detections: {frame_detection_count} | Threshold: {self.confidence_threshold:.2f}"
        cv2.putText(frame, detection_text, (10, frame.shape[0] - 40), 
                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Log detection summary
        if frame_detection_count > 0 and send_alerts:
            weapon_detections = [d for d in detections if any(weapon in d[0].lower() for weapon in ['gun', 'knife'])]
            if weapon_detections:
                logger.info(f"🎯 Frame weapons: {len(weapon_detections)} | "
                          f"Details: {[(d[0], f'{d[1]:.2%}') for d in weapon_detections]}")
        
        return detections
    
    def run_detection(self, camera_index: int = 0):
        """Main detection loop"""
        logger.info(f"🚀 Starting Enhanced Detection Service...")
        
        # Initialize components
        if not self.load_models():
            logger.error("❌ Failed to load models")
            return False
        
        # Validate model after loading
        if not self.validate_model():
            logger.error("❌ Model validation failed")
            return False
        
        if not self.initialize_camera(camera_index):
            logger.error("❌ Failed to initialize camera")
            return False
        
        logger.info(f"✅ All systems ready! Starting detection...")
        logger.info(f"   Video stream available at: http://localhost:5000")
        logger.info(f"   Detection threshold: {self.confidence_threshold}")
        logger.info(f"   Alert threshold: {self.alert_threshold}")
        logger.info(f"   Press Ctrl+C to stop")
        
        frame_count = 0
        total_detections = 0
        start_time = time.time()
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("❌ Failed to read frame from camera")
                    break
                
                frame_count += 1
                
                # --- Inference with fine-tuned weapon model ---
                inference_start = time.time()
                try:
                    results_weapon = self.weapon_model(frame)
                    inference_time = time.time() - inference_start
                except Exception as e:
                    logger.error(f"❌ Inference failed on frame {frame_count}: {e}")
                    continue

                # Process detections and potentially send alerts
                processing_start = time.time()
                try:
                    det_weapon = self.process_detections(results_weapon, frame, self.weapon_model, send_alerts=True)
                    processing_time = time.time() - processing_start
                except Exception as e:
                    logger.error(f"❌ Detection processing failed on frame {frame_count}: {e}")
                    continue

                total_detections += len(det_weapon)
                
                # Add enhanced status overlay
                status_text = f"Weapon Detection | Frame: {frame_count} | Alerts: {self.detection_count}"
                cv2.putText(frame, status_text, (10, 30), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
                # Add performance metrics
                perf_text = f"Inference: {inference_time*1000:.1f}ms | Processing: {processing_time*1000:.1f}ms"
                cv2.putText(frame, perf_text, (10, frame.shape[0] - 60), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
                
                # Add FPS counter
                if frame_count > 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    cv2.putText(frame, f"FPS: {fps:.1f}", (10, frame.shape[0] - 20), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)
                
                # Update current frame for streaming
                with self.frame_lock:
                    self.current_frame = frame.copy()
                
                # Enhanced logging every 50 frames
                if frame_count % 50 == 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    avg_detections = total_detections / frame_count
                    logger.info(f"📊 Performance: {fps:.1f} FPS | "
                              f"Avg detections/frame: {avg_detections:.1f} | "
                              f"Total alerts: {self.detection_count} | "
                              f"Avg inference: {inference_time*1000:.1f}ms")
        
        except KeyboardInterrupt:
            logger.info("🛑 Interrupted by user")
        except Exception as e:
            logger.error(f"❌ Unexpected error in detection loop: {e}")
            logger.error(f"   Traceback: {traceback.format_exc()}")
        finally:
            self.cleanup()
    
    def start_video_server(self, port: int = 5000):
        """Start the video streaming server"""
        try:
            logger.info(f"🎥 Starting video server on port {port}...")
            self.app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
        except Exception as e:
            logger.error(f"❌ Failed to start video server: {e}")
    
    def run(self, camera_index: int = 0, video_port: int = 5000):
        """Run both detection and video server"""
        # Start video server in a separate thread
        video_thread = threading.Thread(
            target=self.start_video_server, 
            args=(video_port,),
            daemon=True
        )
        video_thread.start()
        
        # Small delay to let server start
        time.sleep(2)
        
        # Run detection in main thread
        self.run_detection(camera_index)
    
    def cleanup(self):
        """Clean up resources"""
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        logger.info("🧹 Cleanup completed")
    
    def register_camera_with_backend(self):
        """Ensure the current cameraId exists in the backend DB"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/camera/register",
                json={"cameraId": self.camera_id, "description": "Auto-registered from detection service"},
                timeout=5,
            )
            if response.ok:
                logger.info("📷 Camera registered/verified with backend: %s", self.camera_id)
            else:
                logger.warning("⚠️  Camera registration failed (status %s) – proceeding anyway", response.status_code)
        except Exception as e:
            logger.warning("⚠️  Could not register camera with backend: %s", e)

def main():
    parser = argparse.ArgumentParser(description='Enhanced Detection Service with Video Streaming')
    parser.add_argument('--confidence', type=float, default=0.3, help='Confidence threshold (0.0-1.0)')
    parser.add_argument('--camera-index', type=int, default=0, help='Camera index (0 for default)')
    parser.add_argument('--backend-url', default='http://localhost:8000', help='Backend server URL')
    parser.add_argument('--camera-id', default='webcam-01', help='Camera identifier')
    parser.add_argument('--cooldown', type=int, default=10, help='Cooldown between alerts (seconds)')
    parser.add_argument('--video-port', type=int, default=5000, help='Video streaming port')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode with detailed logging')
    
    args = parser.parse_args()
    
    # Set logging level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        print("🐛 Debug mode enabled - detailed logging active")
    
    # Validate confidence threshold
    if not 0.0 <= args.confidence <= 1.0:
        print("❌ Confidence threshold must be between 0.0 and 1.0")
        return
    
    print("🎯 Enhanced Detection Service")
    print("=" * 50)
    print("Features:")
    print("• Real-time gun and knife detection")
    print("• Enhanced accuracy with lower detection threshold")
    print("• Multi-level confidence visualization")
    print("• Video streaming to web browser")
    print("• Alert notifications to mobile app")
    print("• Integration with AlertMatrix backend")
    print("• Performance monitoring and debugging")
    print("=" * 50)
    
    # Create detection service
    service = EnhancedDetectionService(
        confidence_threshold=args.confidence,
        backend_url=args.backend_url,
        camera_id=args.camera_id,
        cooldown_seconds=args.cooldown
    )
    
    # Run the service
    service.run(
        camera_index=args.camera_index,
        video_port=args.video_port
    )

if __name__ == "__main__":
    main() 