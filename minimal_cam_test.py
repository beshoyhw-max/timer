"""
Minimal Multi-Camera Test
JUST: RTSP read (threaded) + YOLO inference + display
NO: sleep detection, face recognition, optical flow, attendance, evidence saving

Run: python minimal_cam_test.py
"""
import cv2
import numpy as np
import threading
import time
import json
import os

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"


class MinimalReader(threading.Thread):
    def __init__(self, source, name):
        super().__init__(daemon=True)
        self.source = source
        self.name = name
        self.frame = None
        self.lock = threading.Lock()
        self.running = False
        self.frame_time = 0

    def run(self):
        self.running = True
        cap = cv2.VideoCapture(self.source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        print(f"[{self.name}] Connected: {int(cap.get(3))}x{int(cap.get(4))}")
        while self.running:
            ret, frame = cap.read()
            if ret:
                with self.lock:
                    self.frame = frame
                    self.frame_time = time.time()
            else:
                time.sleep(0.1)
        cap.release()

    def get_frame(self):
        with self.lock:
            if self.frame is not None:
                return self.frame.copy(), self.frame_time
            return None, 0

    def stop(self):
        self.running = False


def main():
    # Load cameras
    with open("cameras.json") as f:
        cams = json.load(f)

    sources = [(c['name'], c['source']) for c in cams]
    print(f"Cameras: {len(sources)}")

    # Start readers
    readers = []
    for name, src in sources:
        r = MinimalReader(src, name)
        r.start()
        readers.append(r)

    time.sleep(3)  # Let connections establish

    # Load ONE YOLO model (shared, simulates best case)
    from ultralytics import YOLO
    import torch
    print(f"\nGPU: {torch.cuda.get_device_name()}")
    model = YOLO('yolo26s.pt')
    # Warmup
    dummy = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    model(dummy, verbose=False, imgsz=1280, device='cuda')
    print("YOLO model loaded and warmed up\n")

    cv2.namedWindow("Minimal Test", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Minimal Test", 1280, 720)

    skip = 5
    frame_counters = [0] * len(readers)
    fps_start = time.time()
    display_count = 0
    infer_count = 0

    print("Running... press Q to quit")
    print(f"Skip frames: {skip} (YOLO runs every {skip}th frame)\n")

    while True:
        frames = []
        for i, reader in enumerate(readers):
            frame, ts = reader.get_frame()
            if frame is not None:
                # Run YOLO on every Nth frame
                if frame_counters[i] % skip == 0:
                    results = model.track(frame, classes=[0, 67], conf=0.25,
                                          persist=True, verbose=False,
                                          imgsz=1280, device='cuda')
                    infer_count += 1
                    # Draw boxes
                    if len(results) > 0 and results[0].boxes:
                        for box in results[0].boxes:
                            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

                frame_counters[i] += 1
                frames.append(cv2.resize(frame, (640, 360)))
            else:
                frames.append(np.zeros((360, 640, 3), dtype=np.uint8))

        # Build grid
        if len(frames) == 1:
            display = frames[0]
        elif len(frames) == 2:
            display = np.hstack(frames)
        else:
            cols = 2
            rows = (len(frames) + 1) // 2
            grid = np.zeros((rows * 360, cols * 640, 3), dtype=np.uint8)
            for i, f in enumerate(frames):
                r, c = divmod(i, cols)
                grid[r*360:(r+1)*360, c*640:(c+1)*640] = f
            display = grid

        cv2.imshow("Minimal Test", display)
        display_count += 1

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        # Stats every 3 sec
        elapsed = time.time() - fps_start
        if elapsed >= 3.0:
            print(f"  Display: {display_count/elapsed:.1f}fps | Inferences: {infer_count/elapsed:.1f}/sec")
            display_count = 0
            infer_count = 0
            fps_start = time.time()

    cv2.destroyAllWindows()
    for r in readers:
        r.stop()
    print("Done.")


if __name__ == '__main__':
    main()
