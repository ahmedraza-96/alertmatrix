#!/usr/bin/env python3
"""
YOLOv5 Gun Detection - Direct Implementation
Real-time gun detection using webcam with YOLOv5 repository
"""

import cv2
import torch
import numpy as np
import time
import logging
from datetime import datetime
import argparse
import os
import sys
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class YOLOv5GunDetector:
    def __init__(self, 
                 model_path: str = "best.pt",
                 confidence_threshold: float = 0.5):
        """
        Initialize the YOLOv5 Gun Detector
        
        Args:
            model_path: Path to YOLOv5 model file
            confidence_threshold: Minimum confidence for detection
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        
        # State tracking
        self.detection_count = 0
        
        # Initialize model and camera
        self.model = None
        self.cap = None
        self.yolo_repo_path = None
        
        logger.info(f"🔫 YOLOv5 Gun Detector initialized")
        logger.info(f"   Model: {model_path}")
        logger.info(f"   Confidence Threshold: {confidence_threshold}")
    
    def setup_yolov5_repo(self) -> bool:
        """Clone or use existing YOLOv5 repository"""
        try:
            repo_dir = "yolov5"
            if not os.path.exists(repo_dir):
                logger.info("📦 Cloning YOLOv5 repository...")
                result = subprocess.run([
                    "git", "clone", "https://github.com/ultralytics/yolov5.git"
                ], capture_output=True, text=True)
                
                if result.returncode != 0:
                    logger.error(f"❌ Failed to clone YOLOv5 repo: {result.stderr}")
                    return False
            
            self.yolo_repo_path = os.path.abspath(repo_dir)
            
            # Add to Python path
            if self.yolo_repo_path not in sys.path:
                sys.path.insert(0, self.yolo_repo_path)
            
            logger.info(f"✅ YOLOv5 repository ready at: {self.yolo_repo_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to setup YOLOv5 repo: {e}")
            return False
    
    def load_model(self) -> bool:
        """Load YOLOv5 model"""
        try:
            if not os.path.exists(self.model_path):
                logger.error(f"❌ Model file not found: {self.model_path}")
                return False
            
            # Setup YOLOv5 repository
            if not self.setup_yolov5_repo():
                return False
            
            # Change to YOLOv5 directory
            original_cwd = os.getcwd()
            os.chdir(self.yolo_repo_path)
            
            try:
                # Import YOLOv5 detect module
                from models.common import DetectMultiBackend
                from utils.general import check_img_size, non_max_suppression, scale_boxes
                from utils.torch_utils import select_device
                
                # Load model
                logger.info("📦 Loading YOLOv5 model...")
                device = select_device('')
                model_path_abs = os.path.join(original_cwd, self.model_path)
                
                self.model = DetectMultiBackend(model_path_abs, device=device, dnn=False, data=None, fp16=False)
                self.stride = self.model.stride
                self.names = self.model.names
                self.pt = self.model.pt
                
                # Import additional utilities
                self.non_max_suppression = non_max_suppression
                self.scale_boxes = scale_boxes
                self.device = device
                
                logger.info(f"✅ Model loaded successfully")
                logger.info(f"   Classes: {self.names}")
                return True
                
            finally:
                os.chdir(original_cwd)
            
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
    
    def letterbox(self, im, new_shape=(640, 640), color=(114, 114, 114), auto=True, scaleFill=False, scaleup=True, stride=32):
        """Resize and pad image while maintaining aspect ratio"""
        shape = im.shape[:2]  # current shape [height, width]
        if isinstance(new_shape, int):
            new_shape = (new_shape, new_shape)

        # Scale ratio (new / old)
        r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
        if not scaleup:  # only scale down, do not scale up (for better val mAP)
            r = min(r, 1.0)

        # Compute padding
        ratio = r, r  # width, height ratios
        new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
        dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]  # wh padding

        if auto:  # minimum rectangle
            dw, dh = np.mod(dw, stride), np.mod(dh, stride)  # wh padding
        elif scaleFill:  # stretch
            dw, dh = 0.0, 0.0
            new_unpad = (new_shape[1], new_shape[0])
            ratio = new_shape[1] / shape[1], new_shape[0] / shape[0]  # width, height ratios

        dw /= 2  # divide padding into 2 sides
        dh /= 2

        if shape[::-1] != new_unpad:  # resize
            im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        im = cv2.copyMakeBorder(im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)  # add border
        return im, ratio, (dw, dh)
    
    def process_detections(self, pred, frame: np.ndarray, im0_shape) -> list:
        """Process YOLOv5 detection results"""
        detections = []
        
        for det in pred:
            if len(det):
                # Rescale boxes from img_size to im0 size
                det[:, :4] = self.scale_boxes((640, 640), det[:, :4], im0_shape).round()
                
                for *xyxy, conf, cls in reversed(det):
                    class_id = int(cls)
                    class_name = self.names[class_id]
                    confidence = float(conf)
                    
                    if confidence >= self.confidence_threshold and class_name in ['gun', 'knife']:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, xyxy)
                        
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
        logger.info(f"🚀 Starting YOLOv5 Gun Detection...")
        
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
                im0 = frame.copy()
                
                # Preprocess image
                img, ratio, pad = self.letterbox(frame)
                img = img.transpose((2, 0, 1))[::-1]  # HWC to CHW, BGR to RGB
                img = np.ascontiguousarray(img)
                img = torch.from_numpy(img).to(self.device)
                img = img.half() if self.model.fp16 else img.float()  # uint8 to fp16/32
                img /= 255  # 0 - 255 to 0.0 - 1.0
                if len(img.shape) == 3:
                    img = img[None]  # expand for batch dim
                
                # Run inference
                pred = self.model(img, augment=False, visualize=False)
                pred = self.non_max_suppression(pred, self.confidence_threshold, 0.45, None, False, max_det=1000)
                
                # Process detections
                detections = self.process_detections(pred, frame, im0.shape)
                
                # Update detection count
                if detections:
                    self.detection_count += len(detections)
                    if save_detections:
                        detection_frames.append((frame.copy(), detections, datetime.now()))
                
                # Add status overlay
                status_text = f"YOLOv5 Gun Detection Active | Frame: {frame_count} | Detections: {self.detection_count}"
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
                cv2.imshow('YOLOv5 Gun Detection', frame)
                
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
    parser = argparse.ArgumentParser(description='YOLOv5 Gun Detection')
    parser.add_argument('--model', default='best.pt', help='Path to YOLOv5 model file')
    parser.add_argument('--confidence', type=float, default=0.5, help='Confidence threshold (0.0-1.0)')
    parser.add_argument('--camera-index', type=int, default=0, help='Camera index (0 for default)')
    parser.add_argument('--save-detections', action='store_true', help='Save frames with detections')
    
    args = parser.parse_args()
    
    # Validate confidence threshold
    if not 0.0 <= args.confidence <= 1.0:
        print("❌ Confidence threshold must be between 0.0 and 1.0")
        return
    
    # Create detection service
    detector = YOLOv5GunDetector(
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