#!/usr/bin/env python3
"""
Test script for improved gun/knife detection
Tests the model with different confidence thresholds and provides debugging output
"""

import cv2
import torch
import numpy as np
import logging
import os
import sys
import time

# Fix for Windows/Linux path compatibility issue
import pathlib
temp = pathlib.PosixPath
pathlib.PosixPath = pathlib.WindowsPath

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_model_detection():
    """Test the model with webcam and different confidence levels"""
    
    # Check if model exists
    model_path = "best.pt"
    if not os.path.exists(model_path):
        print(f"❌ Model file not found: {model_path}")
        return False
    
    try:
        # Load model
        print("📦 Loading gun/knife detection model...")
        model = torch.hub.load('ultralytics/yolov5', 'custom', 
                              path=model_path, force_reload=True, trust_repo=True)
        
        print(f"✅ Model loaded!")
        print(f"   Classes: {model.names}")
        
        # Test different confidence levels
        confidence_levels = [0.1, 0.3, 0.5, 0.7]
        
        # Initialize camera
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ Cannot open camera")
            return False
        
        print("🎥 Camera initialized. Testing detection at different confidence levels...")
        print("Press 'q' to quit, 'c' to cycle confidence levels, 's' to save frame")
        
        current_conf_idx = 1  # Start with 0.3
        model.conf = confidence_levels[current_conf_idx]
        
        frame_count = 0
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Run detection
            results = model(frame)
            
            # Get detections
            detections = results.xyxy[0].cpu().numpy()
            
            # Process and display results
            detected_objects = []
            for *box, conf, cls in detections:
                if conf >= model.conf:
                    class_name = model.names[int(cls)]
                    detected_objects.append((class_name, conf))
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box)
                    
                    # Color based on class and confidence
                    if class_name == 'gun':
                        color = (0, 0, 255) if conf > 0.5 else (0, 0, 180)
                    elif class_name == 'knife':
                        color = (0, 165, 255) if conf > 0.5 else (0, 140, 220)
                    else:
                        color = (128, 128, 128)
                    
                    thickness = 3 if conf > 0.5 else 2
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
                    
                    # Add label
                    label = f'{class_name}: {conf:.2%}'
                    cv2.putText(frame, label, (x1, y1-10), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            # Add info overlay
            info_text = f"Confidence: {model.conf:.2f} | Detections: {len(detected_objects)}"
            cv2.putText(frame, info_text, (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Show controls
            controls = "Controls: 'q'=quit, 'c'=change confidence, 's'=save"
            cv2.putText(frame, controls, (10, frame.shape[0] - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            # Log detections
            if detected_objects:
                print(f"Frame {frame_count}: {detected_objects}")
            
            # Display frame
            cv2.imshow('Gun/Knife Detection Test', frame)
            
            # Handle key presses
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('c'):
                # Cycle confidence levels
                current_conf_idx = (current_conf_idx + 1) % len(confidence_levels)
                model.conf = confidence_levels[current_conf_idx]
                print(f"🔄 Changed confidence threshold to: {model.conf}")
            elif key == ord('s'):
                # Save current frame
                filename = f"detection_test_{time.strftime('%Y%m%d_%H%M%S')}.jpg"
                cv2.imwrite(filename, frame)
                print(f"📸 Saved frame: {filename}")
        
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        
        # Performance summary
        elapsed = time.time() - start_time
        fps = frame_count / elapsed
        print(f"\n📊 Test Summary:")
        print(f"   Frames processed: {frame_count}")
        print(f"   Average FPS: {fps:.1f}")
        print(f"   Test duration: {elapsed:.1f}s")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        return False

def main():
    print("🧪 Gun/Knife Detection Test")
    print("=" * 50)
    print("This script tests the improved detection with:")
    print("• Multiple confidence levels (0.1, 0.3, 0.5, 0.7)")
    print("• Real-time webcam feed")
    print("• Visual feedback for all detections")
    print("• Performance monitoring")
    print("=" * 50)
    
    if test_model_detection():
        print("✅ Test completed successfully!")
    else:
        print("❌ Test failed!")

if __name__ == "__main__":
    main() 