"""
Timed Minimal Test - measures where EXACTLY the time goes.
Run on the NEW laptop with 3 cameras.
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

    def run(self):
        self.running = True
        cap = cv2.VideoCapture(self.source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        w = int(cap.get(3))
        h = int(cap.get(4))
        print(f"[{self.name}] Connected: {w}x{h}")
        while self.running:
            ret, frame = cap.read()
            if ret:
                with self.lock:
                    self.frame = frame
            else:
                time.sleep(0.1)
        cap.release()

    def get_frame_ref(self):
        """Return frame reference (no copy) for reading."""
        with self.lock:
            return self.frame

    def get_frame_copy(self):
        """Return frame copy (safe)."""
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False


def main():
    with open("cameras.json") as f:
        cams = json.load(f)

    sources = [(c['name'], c['source']) for c in cams]
    print(f"Cameras: {len(sources)}")

    readers = []
    for name, src in sources:
        r = MinimalReader(src, name)
        r.start()
        readers.append(r)

    time.sleep(3)

    from ultralytics import YOLO
    import torch
    print(f"GPU: {torch.cuda.get_device_name()}")
    model = YOLO('yolo26s.pt')
    dummy = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    model(dummy, verbose=False, imgsz=1280, device='cuda')
    print("Ready\n")

    cv2.namedWindow("Timed Test", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Timed Test", 1280, 720)

    skip = 5
    counters = [0] * len(readers)

    # Timing accumulators
    t_copy = 0; t_infer = 0; t_resize = 0; t_grid = 0; t_display = 0; t_loop = 0
    n_cycles = 0; n_infer = 0
    stats_start = time.time()

    print("=== TEST A: With frame.copy() (current behavior) ===")
    for cycle in range(300):  # ~30 seconds
        loop_start = time.time()
        frames = []

        for i, reader in enumerate(readers):
            t0 = time.time()
            frame = reader.get_frame_copy()  # frame.copy()
            t_copy += time.time() - t0

            if frame is not None:
                if counters[i] % skip == 0:
                    t0 = time.time()
                    results = model.track(frame, classes=[0, 67], conf=0.25,
                                          persist=True, verbose=False,
                                          imgsz=1280, device='cuda')
                    t_infer += time.time() - t0
                    n_infer += 1

                t0 = time.time()
                frames.append(cv2.resize(frame, (640, 360)))
                t_resize += time.time() - t0
                counters[i] += 1
            else:
                frames.append(np.zeros((360, 640, 3), dtype=np.uint8))

        t0 = time.time()
        cols = 2
        rows = max(1, (len(frames) + 1) // 2)
        grid = np.zeros((rows * 360, cols * 640, 3), dtype=np.uint8)
        for i, f in enumerate(frames):
            r, c = divmod(i, cols)
            grid[r*360:(r+1)*360, c*640:(c+1)*640] = f
        t_grid += time.time() - t0

        t0 = time.time()
        cv2.imshow("Timed Test", grid)
        key = cv2.waitKey(1)
        t_display += time.time() - t0

        t_loop += time.time() - loop_start
        n_cycles += 1

        if key & 0xFF == ord('q'):
            break

        elapsed = time.time() - stats_start
        if elapsed >= 5.0:
            print(f"\n  --- Cycle avg ({n_cycles} cycles, {n_cycles/elapsed:.1f} fps) ---")
            print(f"  frame.copy():  {t_copy/n_cycles*1000:6.1f} ms/cycle ({t_copy/elapsed*100:4.1f}% of time)")
            print(f"  YOLO track():  {t_infer/max(1,n_infer)*1000:6.1f} ms/infer × {n_infer/n_cycles:.1f}/cycle")
            print(f"  cv2.resize():  {t_resize/n_cycles*1000:6.1f} ms/cycle")
            print(f"  grid build:    {t_grid/n_cycles*1000:6.1f} ms/cycle")
            print(f"  imshow+waitK:  {t_display/n_cycles*1000:6.1f} ms/cycle")
            print(f"  TOTAL loop:    {t_loop/n_cycles*1000:6.1f} ms/cycle")
            t_copy = t_infer = t_resize = t_grid = t_display = t_loop = 0
            n_cycles = n_infer = 0
            stats_start = time.time()

    cv2.destroyAllWindows()

    # TEST B: Without display (just processing)
    print("\n\n=== TEST B: Processing WITHOUT display ===")
    t_total = 0; n = 0; ni = 0
    counters = [0] * len(readers)
    stats_start = time.time()

    for cycle in range(300):
        t0 = time.time()
        for i, reader in enumerate(readers):
            frame = reader.get_frame_copy()
            if frame is not None:
                if counters[i] % skip == 0:
                    model.track(frame, classes=[0, 67], conf=0.25,
                                persist=True, verbose=False,
                                imgsz=1280, device='cuda')
                    ni += 1
                counters[i] += 1
        t_total += time.time() - t0
        n += 1

        elapsed = time.time() - stats_start
        if elapsed >= 5.0:
            print(f"  NO-DISPLAY: {n/elapsed:.1f} cycles/sec | {ni/elapsed:.1f} infer/sec | {t_total/n*1000:.1f} ms/cycle")
            t_total = 0; n = 0; ni = 0
            stats_start = time.time()

    # TEST C: Without copy (frame reference)
    print("\n\n=== TEST C: Frame REFERENCE (no copy) + display ===")
    cv2.namedWindow("Test C", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Test C", 1280, 720)
    counters = [0] * len(readers)
    stats_start = time.time()
    nc = 0

    for cycle in range(300):
        frames = []
        for i, reader in enumerate(readers):
            frame = reader.get_frame_ref()  # NO COPY!
            if frame is not None:
                if counters[i] % skip == 0:
                    model.track(frame, classes=[0, 67], conf=0.25,
                                persist=True, verbose=False,
                                imgsz=1280, device='cuda')
                frames.append(cv2.resize(frame, (640, 360)))
                counters[i] += 1
            else:
                frames.append(np.zeros((360, 640, 3), dtype=np.uint8))

        cols = 2
        rows = max(1, (len(frames) + 1) // 2)
        grid = np.zeros((rows * 360, cols * 640, 3), dtype=np.uint8)
        for i, f in enumerate(frames):
            r, c = divmod(i, cols)
            grid[r*360:(r+1)*360, c*640:(c+1)*640] = f
        cv2.imshow("Test C", grid)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        nc += 1

        elapsed = time.time() - stats_start
        if elapsed >= 5.0:
            print(f"  NO-COPY: {nc/elapsed:.1f} fps")
            nc = 0
            stats_start = time.time()

    cv2.destroyAllWindows()
    for r in readers:
        r.stop()
    print("\nDone. Compare Test A/B/C results.")


if __name__ == '__main__':
    main()
