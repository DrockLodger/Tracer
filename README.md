# TRACER — トレーサー

Overlay any image on your phone's live camera, fade it down, and **trace it onto paper**.
A static PWA — no build step, no dependencies. Install to your iPhone via **Add to Home Screen**.

![mark](icons/icon-192.png)

## How it works
1. **Mark the page** — draw a small cross in each of the 4 corners of your drawing area.
2. **Mount the phone** above the page, rear camera facing down. Open Tracer → **Start Tracing** → pick your image.
3. **Tap LOCK** and touch the 4 crosses (top-left, top-right, bottom-right, bottom-left). The image warps into perfect perspective and locks to your paper.
4. Drop the **opacity** and trace. Use **Flip** to mirror, **Torch** for light, **Reset** to start over.

Before locking you can also place the image by hand: **drag** to move, **pinch** to zoom, **twist** to rotate.

## Tech
- Vanilla HTML / CSS / JS. Camera via `getUserMedia`. Perspective via a CSS `matrix3d` homography.
- `manifest.webmanifest` + `sw.js` make it installable and offline-capable.
- Requires HTTPS for the camera — Netlify provides this automatically.

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
