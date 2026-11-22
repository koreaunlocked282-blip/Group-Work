// Animated flow-field background for the hero: thin ink lines drifting on the paper.
// Pauses off-screen and in hidden tabs, renders one still frame for reduced-motion users.
const c = document.getElementById('bg');
const ctx = c && c.getContext && c.getContext('2d');
if (ctx) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAIL = 90;
  let W = 1, H = 1, dpr = 1, P = [], raf = 0, onScreen = true, t = 0, tick = 0;

  const spawn = () => ({ x: Math.random() * W, y: Math.random() * H, tr: [], life: 220 + Math.random() * 320, hot: Math.random() < 0.09 });
  const angle = (x, y) => Math.sin(x * 0.0022 + t * 0.00025) * 1.6 + Math.cos(y * 0.0031 - t * 0.0002) * 1.6 + Math.sin((x + y) * 0.0015);

  function size() {
    const r = c.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(360, Math.max(80, (W * H) / 9000)));
    while (P.length < n) P.push(spawn());
    P.length = n;
    if (reduce) { for (let i = 0; i < 120; i++) step(); draw() }
  }

  function step() {
    t += 16;
    for (const p of P) {
      const a = angle(p.x, p.y);
      p.x += Math.cos(a) * 1.5 + 0.3; p.y += Math.sin(a) * 1.5;
      p.tr.push(p.x, p.y); if (p.tr.length > TAIL * 2) p.tr.splice(0, 2);
      if (--p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) Object.assign(p, spawn());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const hot of [false, true]) {
      ctx.strokeStyle = hot ? 'rgba(255,218,0,.85)' : 'rgba(11,11,10,.2)';
      ctx.lineWidth = hot ? 2.2 : 1.1;
      ctx.beginPath();
      for (const p of P) {
        if (p.hot !== hot || p.tr.length < 4) continue;
        ctx.moveTo(p.tr[0], p.tr[1]);
        for (let i = 2; i < p.tr.length; i += 2) ctx.lineTo(p.tr[i], p.tr[i + 1]);
      }
      ctx.stroke();
    }
  }

  function loop() {
    raf = 0;
    if (reduce || !onScreen || document.hidden) return;
    if (W > 700 || (tick++ & 1)) { step(); draw() }
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduce && onScreen && !document.hidden) raf = requestAnimationFrame(loop) };

  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(size) }).observe(c.parentElement);
  new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; start() }).observe(c.parentElement);
  document.addEventListener('visibilitychange', start);
  size(); start();
}
