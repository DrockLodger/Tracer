/* ============================================================
   TRACER — app logic
   Camera overlay tracing with 4-corner perspective lock.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const home       = $('home');
  const cam        = $('cam');
  const video      = $('video');
  const stage      = $('overlayStage');
  const img        = $('overlayImg');
  const emptyState = $('emptyState');
  const fileInput  = $('fileInput');
  const opacity    = $('opacity');
  const opacityVal = $('opacityVal');
  const camStatus  = $('camStatus');
  const toastEl    = $('toast');

  const alignLayer = $('alignLayer');
  const alignSvg   = $('alignSvg');
  const alignStep  = $('alignStep');
  const alignLabel = $('alignLabel');

  const NS = 'http://www.w3.org/2000/svg';
  const ALIGN_LABELS = [
    'Tap the TOP-LEFT cross',
    'Tap the TOP-RIGHT cross',
    'Tap the BOTTOM-RIGHT cross',
    'Tap the BOTTOM-LEFT cross'
  ];

  // ---- state ----
  let stream = null;
  let torchOn = false;
  let hasImage = false;
  let natW = 0, natH = 0;
  let flipped = false;
  let locked = false;
  let lockPts = [];          // tapped dest corners (clockwise: TL,TR,BR,BL)
  const free = { cx: 0, cy: 0, scale: 1, angle: 0 };

  // =========================================================
  // toast
  // =========================================================
  let toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  // =========================================================
  // screen switching
  // =========================================================
  $('startBtn').addEventListener('click', openCam);
  $('closeCam').addEventListener('click', closeCam);

  async function openCam() {
    home.hidden = true;
    cam.hidden = false;
    document.body.style.overflow = 'hidden';
    await startCamera();
  }

  function closeCam() {
    stopCamera();
    cam.hidden = true;
    home.hidden = false;
    document.body.style.overflow = '';
  }

  // =========================================================
  // camera
  // =========================================================
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Camera not supported on this browser.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
    } catch (err) {
      console.error(err);
      toast('Could not open camera — check permissions.');
    }
  }

  function stopCamera() {
    torchOn = false;
    $('btnTorch').classList.remove('is-on');
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
  }

  // =========================================================
  // image picking
  // =========================================================
  $('btnPick').addEventListener('click', () => fileInput.click());
  $('pickFirst').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    img.onload = () => {
      natW = img.naturalWidth;
      natH = img.naturalHeight;
      hasImage = true;
      flipped = false;
      locked = false;
      lockPts = [];
      img.style.display = 'block';
      emptyState.hidden = true;
      stage.style.pointerEvents = 'auto';
      fitFree();
      applyTransform();
      setStatus();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast('Could not load that image.');
    img.src = url;
    fileInput.value = '';
  });

  function setStatus() {
    if (!hasImage) { camStatus.textContent = 'NO IMAGE'; return; }
    camStatus.textContent = locked ? 'LOCKED' : 'FREE';
  }

  // =========================================================
  // opacity
  // =========================================================
  opacity.addEventListener('input', () => {
    const v = +opacity.value;
    img.style.opacity = v / 100;
    opacityVal.textContent = v + '%';
  });
  img.style.opacity = opacity.value / 100;

  // =========================================================
  // free-mode fit + transform
  // =========================================================
  function fitFree() {
    const vw = window.innerWidth, vh = window.innerHeight;
    free.scale = Math.min(vw / natW, vh / natH) * 0.9;
    free.cx = vw / 2;
    free.cy = vh / 2;
    free.angle = 0;
  }

  function applyTransform() {
    if (locked && lockPts.length === 4) applyHomography();
    else applyFree();
  }

  function applyFree() {
    img.style.transformOrigin = 'center center';
    const sx = (flipped ? -1 : 1) * free.scale;
    const tx = free.cx - natW / 2;
    const ty = free.cy - natH / 2;
    img.style.transform =
      `translate(${tx}px, ${ty}px) rotate(${free.angle}deg) scale(${sx}, ${free.scale})`;
  }

  // =========================================================
  // gestures (free mode): pan / pinch-zoom / twist-rotate
  // =========================================================
  const pointers = new Map();

  stage.addEventListener('pointerdown', (e) => {
    if (locked) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });

  stage.addEventListener('pointermove', (e) => {
    if (locked || !pointers.has(e.pointerId)) return;
    const old = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);

    const ids = [...pointers.keys()];
    if (ids.length === 1) {
      free.cx += cur.x - old.x;
      free.cy += cur.y - old.y;
    } else {
      const a = pointers.get(ids[0]), b = pointers.get(ids[1]);
      const aPrev = ids[0] === e.pointerId ? old : a;
      const bPrev = ids[1] === e.pointerId ? old : b;
      const pc = mid(aPrev, bPrev), cc = mid(a, b);
      const pd = dist(aPrev, bPrev), cd = dist(a, b);
      const pa = ang(aPrev, bPrev), ca = ang(a, b);
      if (pd > 0) free.scale = clamp(free.scale * (cd / pd), 0.05, 25);
      free.angle += (ca - pa) * 180 / Math.PI;
      free.cx += cc.x - pc.x;
      free.cy += cc.y - pc.y;
    }
    applyFree();
  });

  const endPtr = (e) => pointers.delete(e.pointerId);
  stage.addEventListener('pointerup', endPtr);
  stage.addEventListener('pointercancel', endPtr);

  const mid  = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang  = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // =========================================================
  // flip / reset / torch
  // =========================================================
  $('btnFlip').addEventListener('click', () => {
    if (!hasImage) return toast('Pick an image first.');
    flipped = !flipped;
    applyTransform();
    $('btnFlip').classList.toggle('is-on', flipped);
  });

  $('btnReset').addEventListener('click', () => {
    if (!hasImage) return;
    locked = false;
    lockPts = [];
    flipped = false;
    $('btnFlip').classList.remove('is-on');
    $('btnLock').classList.remove('is-on');
    stage.style.pointerEvents = 'auto';
    opacity.value = 55; img.style.opacity = 0.55; opacityVal.textContent = '55%';
    fitFree();
    applyTransform();
    setStatus();
    toast('Reset.');
  });

  $('btnTorch').addEventListener('click', async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) return toast('Torch not available on this device.');
    try {
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      $('btnTorch').classList.toggle('is-on', torchOn);
    } catch (err) {
      toast('Could not toggle torch.');
    }
  });

  // =========================================================
  // 4-corner LOCK — perspective align
  // =========================================================
  $('btnLock').addEventListener('click', startAlign);
  $('alignCancel').addEventListener('click', endAlign);
  $('alignUndo').addEventListener('click', () => {
    lockPts.pop();
    renderAlign();
  });

  function startAlign() {
    if (!hasImage) return toast('Pick an image first.');
    lockPts = [];
    locked = false;
    alignLayer.hidden = false;
    stage.style.pointerEvents = 'none';
    renderAlign();
  }

  function endAlign() {
    alignLayer.hidden = true;
    stage.style.pointerEvents = 'auto';
    renderAlign();
  }

  alignLayer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (lockPts.length >= 4) return;
    lockPts.push({ x: e.clientX, y: e.clientY });
    renderAlign();
    if (lockPts.length === 4) {
      locked = true;
      $('btnLock').classList.add('is-on');
      applyHomography();
      setStatus();
      endAlign();
      toast('Locked to your 4 marks. Fade & trace.');
    }
  });

  function renderAlign() {
    // HUD
    const n = Math.min(lockPts.length, 3);
    alignStep.textContent = `${Math.min(lockPts.length + 1, 4)} / 4`;
    alignLabel.textContent = lockPts.length < 4 ? ALIGN_LABELS[lockPts.length] : 'Done';

    // markers
    while (alignSvg.firstChild) alignSvg.removeChild(alignSvg.firstChild);
    // connecting polygon
    if (lockPts.length >= 2) {
      const poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', lockPts.map(p => `${p.x},${p.y}`).join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'rgba(228,41,28,.55)');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('stroke-dasharray', '7 6');
      alignSvg.appendChild(poly);
    }
    lockPts.forEach((p, i) => {
      const g = document.createElementNS(NS, 'g');
      const r = 15;
      const h = document.createElementNS(NS, 'line');
      h.setAttribute('x1', p.x - r); h.setAttribute('y1', p.y);
      h.setAttribute('x2', p.x + r); h.setAttribute('y2', p.y);
      const v = document.createElementNS(NS, 'line');
      v.setAttribute('x1', p.x); v.setAttribute('y1', p.y - r);
      v.setAttribute('x2', p.x); v.setAttribute('y2', p.y + r);
      [h, v].forEach(l => { l.setAttribute('stroke', '#E4291C'); l.setAttribute('stroke-width', '3'); g.appendChild(l); });
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 20);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#E4291C'); c.setAttribute('stroke-width', '2');
      g.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', p.x + 24); t.setAttribute('y', p.y - 18);
      t.setAttribute('fill', '#E4291C'); t.setAttribute('font-size', '22');
      t.setAttribute('font-family', 'Anton, sans-serif');
      t.textContent = i + 1;
      g.appendChild(t);
      alignSvg.appendChild(g);
    });
  }

  // ---- homography: map image rect -> tapped quad (clockwise) ----
  function applyHomography() {
    const W = natW, H = natH;
    // source corners clockwise; flip swaps left/right edges
    const s = flipped
      ? [W, 0, 0, 0, 0, H, W, H]   // TR,TL,BL,BR
      : [0, 0, W, 0, W, H, 0, H];  // TL,TR,BR,BL
    const d = [
      lockPts[0].x, lockPts[0].y,
      lockPts[1].x, lockPts[1].y,
      lockPts[2].x, lockPts[2].y,
      lockPts[3].x, lockPts[3].y
    ];
    const t = general2DProjection(
      s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7],
      d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7]
    );
    for (let i = 0; i < 9; i++) t[i] = t[i] / t[8];
    const m = [
      t[0], t[3], 0, t[6],
      t[1], t[4], 0, t[7],
      0, 0, 1, 0,
      t[2], t[5], 0, t[8]
    ];
    img.style.transformOrigin = '0 0';
    img.style.transform = 'matrix3d(' + m.join(',') + ')';
  }

  // ---- projective math ----
  function adj(m) {
    return [
      m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
      m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
      m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
    ];
  }
  function mmul(a, b) {
    const c = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
        c[3 * i + j] = s;
      }
    return c;
  }
  function mvmul(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  }
  function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
    const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
    const v = mvmul(adj(m), [x4, y4, 1]);
    return mmul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
  }
  function general2DProjection(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4,
                               dx1, dy1, dx2, dy2, dx3, dy3, dx4, dy4) {
    const s = basisToPoints(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4);
    const d = basisToPoints(dx1, dy1, dx2, dy2, dx3, dy3, dx4, dy4);
    return mmul(d, adj(s));
  }

  // keep free-mode fit sensible on rotation / resize
  window.addEventListener('resize', () => {
    if (hasImage && !locked) { /* keep current placement; nothing forced */ }
  });

  // =========================================================
  // service worker
  // =========================================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
