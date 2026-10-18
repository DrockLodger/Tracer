# TRACER — トレーサー

Overlay any image on your phone's live camera, fade it down, and **trace it onto paper**.
A static PWA — no build step. Install from the phone's browser via **Add to Home Screen** / **Install app**.

![mark](icons/icon-192.png)

## How it works
1. **Mark the page** — draw a small cross in each of the 4 corners of your drawing area.
2. **Line up from far** — fit the whole page in view. Open Tracer → **Start Tracing** → pick your image → tap **LOCK** and touch the 4 crosses (top-left, top-right, bottom-right, bottom-left). The image warps into perspective and sits inside your marks.
3. **Move in & TRACK** — tap **TRACK**. The app follows the paper frame-by-frame, so you can lower the phone toward any section and the overlay stays registered and zooms in with you.
4. Drop the **opacity** and trace. **Flip** to mirror, **Torch** for light, **Reset** to start over.

Before locking you can also place the image by hand: **drag** to move, **pinch** to zoom, **twist** to rotate.

### About live tracking (experimental)
Tracking follows visual detail in the camera feed every frame (optical flow). It's steady when there's texture to lock onto — your corner crosses, the clipboard edge, pencil lines you've already drawn — and will **drift or jitter over large areas of blank white paper** and on fast moves, because there's nothing there to track. If it loses the page, pull back until all 4 crosses are visible and tap **LOCK** again.

## Tech
- Vanilla HTML / CSS / JS. Camera via `getUserMedia`. Perspective via a CSS `matrix3d` homography.
- **Live tracking:** OpenCV.js (`vendor/opencv.js`) — `goodFeaturesToTrack` + pyramidal Lucas-Kanade optical flow + `findHomography` (RANSAC), accumulating a frame-to-frame homography. Loaded lazily on first use (~10 MB, then cached), frames processed downscaled (~480 px) for speed.
- `manifest.webmanifest` + `sw.js` make it installable and offline-capable.
- Requires HTTPS for the camera — Netlify provides this automatically. Best on a modern Android phone (Chrome).

## Run locally
Serve the folder over HTTP (the camera needs a secure context — `localhost` counts):

```bash
# any static server works, e.g. with Python:
python -m http.server 8080
# then open http://localhost:8080
```

## Deploy (Netlify)
Connect this repo in Netlify. No build command; publish directory is the repo root (see `netlify.toml`).

## Brand
Vermillion red on cream paper, retro Japanese billboard styling. Logo: three dashes, faint → full red.
