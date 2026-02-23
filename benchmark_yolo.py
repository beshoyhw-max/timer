"""
YOLO Inference Benchmark
Run on BOTH laptops to compare GPU inference speed.
"""
import time
import numpy as np

# GPU Info
import torch
print(f"GPU: {torch.cuda.get_device_name()}")
print(f"CUDA: {torch.version.cuda}")
print(f"PyTorch: {torch.__version__}")
print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
print()

from ultralytics import YOLO

# Create fake 1080p frame
frame = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)

# Test 1: Single model inference
print("=" * 50)
print("TEST 1: Single YOLO model (yolo26s.pt)")
print("=" * 50)
model = YOLO('yolo26s.pt')

# Warmup
print("Warming up...")
for _ in range(10):
    model(frame, verbose=False, imgsz=1280, device='cuda')

# Benchmark
print("Benchmarking 50 inferences...")
t = time.time()
for _ in range(50):
    model(frame, verbose=False, imgsz=1280, device='cuda')
e = time.time() - t
print(f"  → {e/50*1000:.1f} ms/frame | {50/e:.1f} FPS")
print()

# Test 2: model.track() (what the app actually uses)
print("=" * 50)
print("TEST 2: YOLO track() mode (what app uses)")
print("=" * 50)

# Warmup tracking
print("Warming up tracker...")
for _ in range(10):
    model.track(frame, classes=[0, 67], conf=0.25, persist=True,
                verbose=False, imgsz=1280, device='cuda')

# Benchmark
print("Benchmarking 50 track() calls...")
t = time.time()
for _ in range(50):
    model.track(frame, classes=[0, 67], conf=0.25, persist=True,
                verbose=False, imgsz=1280, device='cuda')
e = time.time() - t
print(f"  → {e/50*1000:.1f} ms/frame | {50/e:.1f} FPS")
print()

# Test 3: Pose model
print("=" * 50)
print("TEST 3: Pose model (yolo26s-pose.pt)")
print("=" * 50)
try:
    pose_model = YOLO('yolo26s-pose.pt')
    
    print("Warming up...")
    for _ in range(10):
        pose_model(frame, verbose=False, conf=0.5, device='cuda')
    
    print("Benchmarking 50 inferences...")
    t = time.time()
    for _ in range(50):
        pose_model(frame, verbose=False, conf=0.5, device='cuda')
    e = time.time() - t
    print(f"  → {e/50*1000:.1f} ms/frame | {50/e:.1f} FPS")
except Exception as ex:
    print(f"  Pose model not found or error: {ex}")
print()

# Test 4: Multiple models loaded (simulates 3 cameras)
print("=" * 50)
print("TEST 4: 3 detection models loaded simultaneously")
print("=" * 50)
models = [YOLO('yolo26s.pt') for _ in range(3)]
print(f"  VRAM after loading 3 models: {torch.cuda.memory_allocated()/1024**2:.0f} MB")

# Each model does inference in sequence (simulates GIL serialization)
print("Benchmarking 30 rounds (3 models × 30 = 90 inferences)...")
t = time.time()
for _ in range(30):
    for m in models:
        m(frame, verbose=False, imgsz=1280, device='cuda')
e = time.time() - t
print(f"  → {e/30*1000:.1f} ms/round (3 cameras) | {30/e:.1f} rounds/sec")
print(f"  → {e/90*1000:.1f} ms/frame per camera")
print()

# Cleanup
del models
torch.cuda.empty_cache()

print("=" * 50)
print("VRAM Usage Summary:")
print(f"  Allocated: {torch.cuda.memory_allocated()/1024**2:.0f} MB")
print(f"  Reserved:  {torch.cuda.memory_reserved()/1024**2:.0f} MB")
print("=" * 50)
