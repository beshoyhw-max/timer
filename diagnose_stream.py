"""
Stream Diagnostic Script
Tests raw RTSP streaming WITHOUT any YOLO/detection to isolate the bottleneck.

Usage: python diagnose_stream.py
"""
import cv2
import numpy as np
import threading
import time
import os
import json

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

def test_raw_stream(sources, duration=15):
    """Test raw RTSP stream display WITHOUT any detection."""
    print("=" * 60)
    print("TEST 1: Raw RTSP Stream (NO detection, NO processing)")
    print(f"Cameras: {len(sources)}")
    print(f"Duration: {duration}s")
    print("=" * 60)
    
    caps = []
    for i, src in enumerate(sources):
        cap = cv2.VideoCapture(src)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        if cap.isOpened():
            caps.append((i, cap))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"  Camera {i}: {w}x{h} - Connected")
        else:
            print(f"  Camera {i}: FAILED to connect")
    
    if not caps:
        print("No cameras connected!")
        return
    
    cv2.namedWindow("Diagnostic - Raw Stream", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Diagnostic - Raw Stream", 1280, 720)
    
    start = time.time()
    frame_counts = [0] * len(caps)
    fps_start = time.time()
    
    print("\nStreaming... (press Q to stop)")
    while time.time() - start < duration:
        frames = []
        for idx, (cam_id, cap) in enumerate(caps):
            ret, frame = cap.read()
            if ret:
                frames.append(frame)
                frame_counts[idx] += 1
            else:
                frames.append(np.zeros((480, 640, 3), dtype=np.uint8))
        
        # Simple grid display
        if len(frames) == 1:
            display = cv2.resize(frames[0], (1280, 720))
        elif len(frames) == 2:
            row = np.hstack([cv2.resize(f, (640, 360)) for f in frames])
            display = row
        else:
            cols = 2
            rows_needed = (len(frames) + cols - 1) // cols
            cell_w, cell_h = 640, 360
            display = np.zeros((rows_needed * cell_h, cols * cell_w, 3), dtype=np.uint8)
            for i, f in enumerate(frames):
                r, c = divmod(i, cols)
                resized = cv2.resize(f, (cell_w, cell_h))
                display[r*cell_h:(r+1)*cell_h, c*cell_w:(c+1)*cell_w] = resized
        
        cv2.imshow("Diagnostic - Raw Stream", display)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        
        # Print FPS every 3 seconds
        elapsed = time.time() - fps_start
        if elapsed >= 3.0:
            fps_strs = []
            for idx in range(len(caps)):
                fps = frame_counts[idx] / elapsed
                fps_strs.append(f"Cam{idx}: {fps:.1f}fps")
                frame_counts[idx] = 0
            fps_start = time.time()
            print(f"  [RAW FPS] {' | '.join(fps_strs)}")
    
    cv2.destroyAllWindows()
    for _, cap in caps:
        cap.release()
    print("Test 1 complete.\n")


def test_threaded_stream(sources, duration=15):
    """Test threaded RTSP stream (same pattern as VideoReader) WITHOUT detection."""
    print("=" * 60)
    print("TEST 2: Threaded Stream (VideoReader pattern, NO detection)")
    print(f"Cameras: {len(sources)}")
    print(f"Duration: {duration}s")
    print("=" * 60)
    
    class SimpleReader:
        def __init__(self, source, name):
            self.source = source
            self.name = name
            self.cap = None
            self.frame = None
            self.lock = threading.Lock()
            self.running = False
            self.read_count = 0
            self.thread = threading.Thread(target=self._run, daemon=True)
        
        def start(self):
            self.running = True
            self.thread.start()
        
        def stop(self):
            self.running = False
            self.thread.join(timeout=2)
            if self.cap:
                self.cap.release()
        
        def _run(self):
            self.cap = cv2.VideoCapture(self.source)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
            w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"  [{self.name}] Connected: {w}x{h}")
            
            while self.running:
                ret, frame = self.cap.read()
                if ret:
                    with self.lock:
                        self.frame = frame
                    self.read_count += 1
                else:
                    time.sleep(0.1)
        
        def get_frame(self):
            with self.lock:
                return self.frame.copy() if self.frame is not None else None
    
    readers = []
    for i, src in enumerate(sources):
        r = SimpleReader(src, f"Cam{i}")
        r.start()
        readers.append(r)
    
    time.sleep(2)  # Let connections establish
    
    cv2.namedWindow("Diagnostic - Threaded Stream", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Diagnostic - Threaded Stream", 1280, 720)
    
    start = time.time()
    display_count = 0
    fps_start = time.time()
    
    print("\nDisplaying... (press Q to stop)")
    while time.time() - start < duration:
        frames = []
        for r in readers:
            f = r.get_frame()
            if f is not None:
                frames.append(f)
            else:
                frames.append(np.zeros((480, 640, 3), dtype=np.uint8))
        
        # Grid display
        cols = 2
        rows_needed = max(1, (len(frames) + cols - 1) // cols)
        cell_w, cell_h = 640, 360
        display = np.zeros((rows_needed * cell_h, cols * cell_w, 3), dtype=np.uint8)
        for i, f in enumerate(frames):
            r_idx, c_idx = divmod(i, cols)
            resized = cv2.resize(f, (cell_w, cell_h))
            display[r_idx*cell_h:(r_idx+1)*cell_h, c_idx*cell_w:(c_idx+1)*cell_w] = resized
        
        cv2.imshow("Diagnostic - Threaded Stream", display)
        if cv2.waitKey(16) & 0xFF == ord('q'):
            break
        display_count += 1
        
        # Print stats every 3 seconds
        elapsed = time.time() - fps_start
        if elapsed >= 3.0:
            display_fps = display_count / elapsed
            reader_strs = []
            for i, rd in enumerate(readers):
                rfps = rd.read_count / elapsed
                rd.read_count = 0
                reader_strs.append(f"Cam{i}: {rfps:.1f}fps")
            display_count = 0
            fps_start = time.time()
            print(f"  [READ FPS] {' | '.join(reader_strs)} | [DISPLAY] {display_fps:.1f}fps")
    
    cv2.destroyAllWindows()
    for rd in readers:
        rd.stop()
    print("Test 2 complete.\n")


def test_gpu_load(duration=10):
    """Test if GPU CUDA contexts cause interference."""
    print("=" * 60)
    print("TEST 3: GPU Load Test")
    print("=" * 60)
    
    try:
        import torch
        print(f"  CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"  GPU: {torch.cuda.get_device_name()}")
            print(f"  VRAM Total: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
            
            # Allocate some GPU memory to simulate model loading
            print("  Loading test tensors to simulate 3 camera models...")
            tensors = []
            for i in range(6):  # 3 cameras × 2 models
                t = torch.randn(1, 3, 640, 640, device='cuda')
                tensors.append(t)
            
            allocated = torch.cuda.memory_allocated() / 1024**2
            reserved = torch.cuda.memory_reserved() / 1024**2
            print(f"  GPU Memory Allocated: {allocated:.0f} MB")
            print(f"  GPU Memory Reserved: {reserved:.0f} MB")
            
            # Cleanup
            del tensors
            torch.cuda.empty_cache()
        else:
            print("  No CUDA - GPU test skipped")
    except ImportError:
        print("  PyTorch not available - GPU test skipped")
    print("Test 3 complete.\n")


if __name__ == '__main__':
    # Load camera sources from cameras.json
    config_file = "cameras.json"
    
    if os.path.exists(config_file):
        with open(config_file, 'r') as f:
            configs = json.load(f)
        sources = [c['source'] for c in configs]
    else:
        print("No cameras.json found!")
        sources = []
    
    if not sources:
        print("No camera sources found. Add cameras to cameras.json first.")
        exit(1)
    
    print(f"\nFound {len(sources)} camera source(s)")
    print(f"OpenCV version: {cv2.__version__}")
    print(f"OpenCV build info (video I/O):")
    build = cv2.getBuildInformation()
    for line in build.split('\n'):
        if any(k in line.lower() for k in ['ffmpeg', 'gstreamer', 'msmf', 'dshow', 'video i/o']):
            print(f"  {line.strip()}")
    print()
    
    # Run tests
    test_gpu_load()
    
    print("Add your RTSP camera URLs to cameras.json. Current sources:")
    for i, s in enumerate(sources):
        display_src = s if len(str(s)) < 60 else str(s)[:57] + "..."
        print(f"  [{i}] {display_src}")
    print()
    
    test_raw_stream(sources, duration=15)
    test_threaded_stream(sources, duration=15)
    
    print("=" * 60)
    print("DIAGNOSIS COMPLETE")
    print("=" * 60)
    print("""
If Test 1 (raw) was smooth:
  → RTSP stream is fine, problem is in processing/GPU contention

If Test 1 (raw) lagged:
  → Problem is in OpenCV RTSP decode or network on this machine

If Test 2 (threaded) lagged but Test 1 was smooth:
  → Problem is frame copy overhead or GIL contention

Share the output of this script and I'll tell you the exact fix!
""")
