#!/usr/bin/env python3
"""
GunGuard - Real-time Gun Detection Service
Uses YOLOv5 to detect guns in webcam feed and sends alerts to backend
"""

import cv2
import torch
import numpy as np
import requests
import base64
import time
import json
import logging
from datetime import datetime
from pathlib import Path
import argparse
import os
from typing import Optional, Tuple, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('gun_detection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class GunDetectionService:
    def __init__(self, 
                 model_path: str = "best.pt",
                 backend_url: str = "http://localhost:4000",
                 camera_id: str = "webcam-01",
                 confidence_threshold: float = 0.5,
                 cooldown_seconds: int = 10,
                 capture_snapshots: bool = True):
        """
        Initialize the Gun Detection Service
        
        Args:
            model_path: Path to YOLOv5 model file
            backend_url: Backend server URL
            camera_id: Unique identifier for this camera
            confidence_threshold: Minimum confidence for detection
            cooldown_seconds: Seconds between alerts for same detection
            capture_snapshots: Whether to capture and send image snapshots
        """
        self.model_path = model_path
        self.backend_url = backend_url.rstrip('/')
        self.camera_id = camera_id
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self.capture_snapshots = capture_snapshots
        
        # State tracking
        self.last_alert_time = 0
        self.detection_count = 0
        
        # Initialize model and camera
        self.model = None
        self.cap = None
        
        logger.info(f"🔫 GunGuard Detection Service initialized")
        logger.info(f"   Model: {model_path}")
        logger.info(f"   Backend: {backend_url}")
        logger.info(f"   Camera ID: {camera_id}")
        logger.info(f"   Confidence Threshold: {confidence_threshold}")
        logger.info(f"   Cooldown: {cooldown_seconds}s")
    
    def load_model(self) -> bool:
        """Load YOLOv5 model"""
        try:
            if not os.path.exists(self.model_path):
                logger.error(f"❌ Model file not found: {self.model_path}")
                return False
            
            # Load YOLOv5 model
            self.model = torch.hub.load('ultralytics/yolov5', 'custom', 
                                      path=self.model_path, force_reload=True)
            self.model.conf = self.confidence_threshold
            
            logger.info(f"✅ Model loaded successfully")
            logger.info(f"   Classes: {self.model.names}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return False
    
    def initialize_camera(self, camera_index: int = 0) -> bool:
        """Initialize camera capture"""
        try:
            self.cap = cv2.VideoCapture(camera_index)
            if not self.cap.isOpened():
                logger.error(f"❌ Cannot open camera {camera_index}")
                return False
            
            # Set camera properties for better performance
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
    
    def send_alert(self, detection_type: str, confidence: float, 
                   frame: Optional[np.ndarray] = None) -> bool:
        """Send alert to backend server"""
        try:
            current_time = time.time()
            
            # Check cooldown period
            if current_time - self.last_alert_time < self.cooldown_seconds:
                logger.debug(f"⏳ Alert cooldown active, skipping...")
                return False
            
            # Prepare alert data
            alert_data = {
                "camera_id": self.camera_id,
                "timestamp": datetime.now().isoformat(),
                "confidence": float(confidence),
                "detection_type": detection_type
            }
            
            # Add image if available and enabled
            if self.capture_snapshots and frame is not None:
                alert_data["image_base64"] = self.encode_image_to_base64(frame)
            
            # Send POST request to backend
            response = requests.post(
                f"{self.backend_url}/api/alert",
                json=alert_data,
                timeout=5,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                self.last_alert_time = current_time
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
    
    def process_detections(self, results, frame: np.ndarray) -> List[Tuple[str, float]]:
        """Process YOLO detection results"""
        detections = []
        
        # Parse results
        for *box, conf, cls in results.xyxy[0].cpu().numpy():
            if conf >= self.confidence_threshold:
                class_name = self.model.names[int(cls)]
                if class_name in ['gun', 'knife']:  # Only process weapons
                    detections.append((class_name, conf))
                    
                    # Draw bounding box on frame
                    x1, y1, x2, y2 = map(int, box)
                    color = (0, 0, 255) if class_name == 'gun' else (0, 165, 255)  # Red for gun, orange for knife
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, f'{class_name}: {conf:.2%}', 
                              (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        return detections
    
    def run(self, show_video: bool = True, camera_index: int = 0):
        """Main detection loop"""
        logger.info(f"🚀 Starting GunGuard Detection Service...")
        
        # Initialize components
        if not self.load_model():
            return False
        
        if not self.initialize_camera(camera_index):
            return False
        
        logger.info(f"✅ All systems ready! Starting detection...")
        logger.info(f"   Press 'q' to quit")
        logger.info(f"   Press 's' to save current frame")
        
        frame_count = 0
        start_time = time.time()
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("❌ Failed to read frame from camera")
                    break
                
                frame_count += 1
                
                # Run inference
                results = self.model(frame)
                
                # Process detections
                detections = self.process_detections(results, frame)
                
                # Send alerts for detected weapons
                for detection_type, confidence in detections:
                    self.send_alert(detection_type, confidence, frame)
                
                # Display video feed if enabled
                if show_video:
                    # Add status overlay
                    status_text = f"GunGuard Active | Frame: {frame_count} | Alerts: {self.detection_count}"
                    cv2.putText(frame, status_text, (10, 30), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    
                    # Show cooldown status
                    if time.time() - self.last_alert_time < self.cooldown_seconds:
                        cooldown_remaining = self.cooldown_seconds - (time.time() - self.last_alert_time)
                        cv2.putText(frame, f"Cooldown: {cooldown_remaining:.1f}s", (10, 60), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                    
                    cv2.imshow('GunGuard - Gun Detection', frame)
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    logger.info("🛑 Quit requested by user")
                    break
                elif key == ord('s'):
                    # Save current frame
                    filename = f"snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    cv2.imwrite(filename, frame)
                    logger.info(f"📸 Frame saved as {filename}")
                
                # Log performance every 100 frames
                if frame_count % 100 == 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    logger.info(f"📊 Performance: {fps:.1f} FPS | Frames: {frame_count} | Alerts: {self.detection_count}")
        
        except KeyboardInterrupt:
            logger.info("🛑 Interrupted by user")
        except Exception as e:
            logger.error(f"❌ Unexpected error in main loop: {e}")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        logger.info("🧹 Cleanup completed")

def main():
    parser = argparse.ArgumentParser(description='GunGuard Real-time Gun Detection Service')
    parser.add_argument('--model', default='best.pt', help='Path to YOLOv5 model file')
    parser.add_argument('--backend', default='http://localhost:4000', help='Backend server URL')
    parser.add_argument('--camera-id', default='webcam-01', help='Camera identifier')
    parser.add_argument('--confidence', type=float, default=0.5, help='Confidence threshold')
    parser.add_argument('--cooldown', type=int, default=10, help='Cooldown between alerts (seconds)')
    parser.add_argument('--camera-index', type=int, default=0, help='Camera index (0 for default)')
    parser.add_argument('--no-video', action='store_true', help='Run without video display')
    parser.add_argument('--no-snapshots', action='store_true', help='Disable snapshot capture')
    
    args = parser.parse_args()
    
    # Create detection service
    service = GunDetectionService(
        model_path=args.model,
        backend_url=args.backend,
        camera_id=args.camera_id,
        confidence_threshold=args.confidence,
        cooldown_seconds=args.cooldown,
        capture_snapshots=not args.no_snapshots
    )
    
    # Run the service
    service.run(show_video=not args.no_video, camera_index=args.camera_index)

if __name__ == "__main__":
    main() 