#!/usr/bin/env python3
"""
YOLO Object Detection Demo
Real-time object detection using webcam with pre-trained YOLO model
"""

import cv2
import torch
import numpy as np
import time
import logging
from datetime import datetime
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class YOLODetectionDemo:
    def __init__(self, confidence_threshold: float = 0.5):
        """
        Initialize the YOLO Detection Demo
        
        Args:
            confidence_threshold: Minimum confidence for detection
        """
        self.confidence_threshold = confidence_threshold
        
        # State tracking
        self.detection_count = 0
        
        # Initialize model and camera
        self.model = None
        self.cap = None
        
        logger.info(f"🎯 YOLO Detection Demo initialized")
        logger.info(f"   Confidence Threshold: {confidence_threshold}")
    
    def load_model(self) -> bool:
        """Load YOLOv5 model"""
        try:
            # Use a standard YOLOv5 model that should work
            logger.info("📦 Loading YOLOv5s model...")
            self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', trust_repo=True)
            self.model.conf = self.confidence_threshold
            
            logger.info(f"✅ Model loaded successfully")
            logger.info(f"   Classes: {len(self.model.names)} classes available")
            logger.info(f"   Some classes: {list(self.model.names.values())[:10]}...")
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
        
        # Parse results
        for *box, conf, cls in results.xyxy[0].cpu().numpy():
            if conf >= self.confidence_threshold:
                class_name = self.model.names[int(cls)]
                detections.append((class_name, conf, box))
                
                # Draw bounding box on frame
                x1, y1, x2, y2 = map(int, box)
                
                # Different colors for different objects
                if class_name == 'person':
                    color = (0, 255, 0)  # Green for person
                elif class_name in ['bottle', 'cup']:
                    color = (255, 0, 0)  # Blue for bottles/cups
                elif class_name in ['cell phone', 'laptop']:
                    color = (0, 255, 255)  # Yellow for electronics
                else:
                    color = (255, 255, 255)  # White for others
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f'{class_name}: {conf:.2%}', 
                          (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Log interesting detections
                if class_name in ['person', 'bottle', 'cell phone', 'laptop', 'cup']:
                    logger.info(f"🎯 DETECTION: {class_name.upper()} detected! Confidence: {conf:.2%}")
        
        return detections
    
    def run(self, camera_index: int = 0, save_detections: bool = False):
        """Main detection loop"""
        logger.info(f"🚀 Starting YOLO Object Detection Demo...")
        
        # Initialize components
        if not self.load_model():
            return False
        
        if not self.initialize_camera(camera_index):
            return False
        
        logger.info(f"✅ All systems ready! Starting detection...")
        logger.info(f"   Press 'q' to quit")
        logger.info(f"   Press 's' to save current frame")
        logger.info(f"   Press 'r' to reset detection count")
        logger.info(f"   Press 'h' to show/hide help")
        
        frame_count = 0
        start_time = time.time()
        detection_frames = []
        show_help = False
        
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
                
                # Update detection count
                if detections:
                    self.detection_count += len(detections)
                    if save_detections:
                        detection_frames.append((frame.copy(), detections, datetime.now()))
                
                # Add status overlay
                status_text = f"YOLO Object Detection | Frame: {frame_count} | Objects: {self.detection_count}"
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
                    detection_text = f"Current Frame: {len(detections)} object(s) detected!"
                    cv2.putText(frame, detection_text, (10, 90), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                # Show help text
                if show_help:
                    help_texts = [
                        "Controls:",
                        "q - Quit",
                        "s - Save frame", 
                        "r - Reset count",
                        "h - Toggle help"
                    ]
                    for i, text in enumerate(help_texts):
                        cv2.putText(frame, text, (10, 150 + i*25), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                
                # Display video feed
                cv2.imshow('YOLO Object Detection Demo', frame)
                
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
                elif key == ord('h'):
                    # Toggle help
                    show_help = not show_help
                    logger.info(f"ℹ️ Help {'shown' if show_help else 'hidden'}")
                
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
    parser = argparse.ArgumentParser(description='YOLO Object Detection Demo')
    parser.add_argument('--confidence', type=float, default=0.5, help='Confidence threshold (0.0-1.0)')
    parser.add_argument('--camera-index', type=int, default=0, help='Camera index (0 for default)')
    parser.add_argument('--save-detections', action='store_true', help='Save frames with detections')
    
    args = parser.parse_args()
    
    # Validate confidence threshold
    if not 0.0 <= args.confidence <= 1.0:
        print("❌ Confidence threshold must be between 0.0 and 1.0")
        return
    
    print("🎯 YOLO Object Detection Demo")
    print("=" * 50)
    print("This demo shows real-time object detection using YOLOv5.")
    print("It will detect common objects like people, bottles, phones, etc.")
    print("Note: This is a demonstration - your gun detection model")
    print("      has compatibility issues with Windows paths.")
    print("=" * 50)
    
    # Create detection service
    detector = YOLODetectionDemo(
        confidence_threshold=args.confidence
    )
    
    # Run the detector
    detector.run(
        camera_index=args.camera_index,
        save_detections=args.save_detections
    )

if __name__ == "__main__":
    main() 