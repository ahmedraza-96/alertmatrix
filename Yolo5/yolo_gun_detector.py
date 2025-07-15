#!/usr/bin/env python3
"""
YOLO Gun Detection - Simplified
Real-time gun detection using webcam with ultralytics YOLO
"""

import cv2
import numpy as np
import time
import logging
from datetime import datetime
import argparse
import os
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class YOLOGunDetector:
    def __init__(self, 
                 model_path: str = "best.pt",
                 confidence_threshold: float = 0.5):
        """
        Initialize the YOLO Gun Detector
        
        Args:
            model_path: Path to YOLO model file
            confidence_threshold: Minimum confidence for detection
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        
        # State tracking
        self.detection_count = 0
        
        # Initialize model and camera
        self.model = None
        self.cap = None
        
        logger.info(f"🔫 YOLO Gun Detector initialized")
        logger.info(f"   Model: {model_path}")
        logger.info(f"   Confidence Threshold: {confidence_threshold}")
    
    def load_model(self) -> bool:
        """Load YOLO model"""
        try:
            if not os.path.exists(self.model_path):
                logger.error(f"❌ Model file not found: {self.model_path}")
                return False
            
            # Load YOLO model using ultralytics
            logger.info("📦 Loading YOLO model...")
            self.model = YOLO(self.model_path)
            
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
    
    def process_detections(self, results, frame: np.ndarray) -> list:
        """Process YOLO detection results"""
        detections = []
        
        # Process results from ultralytics YOLO
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Get detection data
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = self.model.names[class_id]
                    
                    if confidence >= self.confidence_threshold and class_name in ['gun', 'knife']:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        detections.append((class_name, confidence, (x1, y1, x2, y2)))
                        
                        # Draw bounding box on frame
                        color = (0, 0, 255) if class_name == 'gun' else (0, 165, 255)  # Red for gun, orange for knife
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(frame, f'{class_name}: {confidence:.2%}', 
                                  (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                        
                        # Log detection
                        logger.warning(f"🚨 DETECTION: {class_name.upper()} detected! Confidence: {confidence:.2%}")
        
        return detections
    
    def run(self, camera_index: int = 0, save_detections: bool = False):
        """Main detection loop"""
        logger.info(f"🚀 Starting YOLO Gun Detection...")
        
        # Initialize components
        if not self.load_model():
            return False
        
        if not self.initialize_camera(camera_index):
            return False
        
        logger.info(f"✅ All systems ready! Starting detection...")
        logger.info(f"   Press 'q' to quit")
        logger.info(f"   Press 's' to save current frame")
        logger.info(f"   Press 'r' to reset detection count")
        
        frame_count = 0
        start_time = time.time()
        detection_frames = []
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("❌ Failed to read frame from camera")
                    break
                
                frame_count += 1
                
                # Run inference
                results = self.model(frame, conf=self.confidence_threshold, verbose=False)
                
                # Process detections
                detections = self.process_detections(results, frame)
                
                # Update detection count
                if detections:
                    self.detection_count += len(detections)
                    if save_detections:
                        detection_frames.append((frame.copy(), detections, datetime.now()))
                
                # Add status overlay
                status_text = f"YOLO Gun Detection Active | Frame: {frame_count} | Detections: {self.detection_count}"
                cv2.putText(frame, status_text, (10, 30), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
                # Add FPS counter
                if frame_count > 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 60), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                
                # Show current detections count
                if detections:
                    detection_text = f"Current Frame: {len(detections)} weapon(s) detected!"
                    cv2.putText(frame, detection_text, (10, 90), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                
                # Display video feed
                cv2.imshow('YOLO Gun Detection', frame)
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    logger.info("🛑 Quit requested by user")
                    break
                elif key == ord('s'):
                    # Save current frame
                    filename = f"detection_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    cv2.imwrite(filename, frame)
                    logger.info(f"📸 Frame saved as {filename}")
                elif key == ord('r'):
                    # Reset detection count
                    self.detection_count = 0
                    detection_frames.clear()
                    logger.info("🔄 Detection count reset")
                
                # Log performance every 100 frames
                if frame_count % 100 == 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    logger.info(f"📊 Performance: {fps:.1f} FPS | Frames: {frame_count} | Total Detections: {self.detection_count}")
        
        except KeyboardInterrupt:
            logger.info("🛑 Interrupted by user")
        except Exception as e:
            logger.error(f"❌ Unexpected error in main loop: {e}")
        finally:
            self.cleanup()
            
            # Save detection summary
            if save_detections and detection_frames:
                logger.info(f"💾 Saving {len(detection_frames)} detection frames...")
                for i, (det_frame, dets, timestamp) in enumerate(detection_frames):
                    filename = f"detection_{timestamp.strftime('%Y%m%d_%H%M%S')}_{i}.jpg"
                    cv2.imwrite(filename, det_frame)
                logger.info(f"✅ Detection frames saved")
    
    def cleanup(self):
        """Clean up resources"""
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        logger.info("🧹 Cleanup completed")

def main():
    parser = argparse.ArgumentParser(description='YOLO Gun Detection')
    parser.add_argument('--model', default='best.pt', help='Path to YOLO model file')
    parser.add_argument('--confidence', type=float, default=0.5, help='Confidence threshold (0.0-1.0)')
    parser.add_argument('--camera-index', type=int, default=0, help='Camera index (0 for default)')
    parser.add_argument('--save-detections', action='store_true', help='Save frames with detections')
    
    args = parser.parse_args()
    
    # Validate confidence threshold
    if not 0.0 <= args.confidence <= 1.0:
        print("❌ Confidence threshold must be between 0.0 and 1.0")
        return
    
    # Create detection service
    detector = YOLOGunDetector(
        model_path=args.model,
        confidence_threshold=args.confidence
    )
    
    # Run the detector
    detector.run(
        camera_index=args.camera_index,
        save_detections=args.save_detections
    )

if __name__ == "__main__":
    main() 