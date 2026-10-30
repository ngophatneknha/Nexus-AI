// Seeded RNG so the illustrations look the same on every visit.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hero: scanning microscope (illustration only) ---------- */
(() => {
  const canvas = document.getElementById('cells');
  const ctx = canvas.getContext('2d');
  const R = rng(7);
  let W, cells = [], scanX = 0, scanned = new Set();
  const roConf = document.getElementById('ro-conf');
  const roCells = document.getElementById('ro-cells');
  const roState = document.getElementById('ro-state');

  function addCell() {
    const old = R() < 0.14; // larger, flattened, granular "senescent-looking" cells
    cells.push({
      x: R() * W, y: R() * W,
      a: old ? W * (0.05 + R() * 0.03) : W * (0.045 + R() * 0.03),
      b: old ? W * (0.035 + R() * 0.02) : W * (0.009 + R() * 0.006),
      r: R() * Math.PI, vr: (R() - 0.5) * 0.004,
      vx: (R() - 0.5) * 0.15, vy: (R() - 0.5) * 0.15, old,
    });
  }
  function reset() {
    cells = []; scanned.clear();
    for (let i = 0; i < 28; i++) addCell();
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    canvas.width = canvas.height = W * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    reset();
  }

  function draw() {
    ctx.clearRect(0, 0, W, W);
    for (const [i, c] of cells.entries()) {
      if (!reduceMotion) {
        c.x = (c.x + c.vx + W) % W; c.y = (c.y + c.vy + W) % W; c.r += c.vr;
      }
      const hit = scanned.has(i);
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.r);
      ctx.beginPath(); ctx.ellipse(0, 0, c.a, c.b, 0, 0, Math.PI * 2);
      ctx.fillStyle = hit ? (c.old ? 'rgba(232,163,61,.55)' : 'rgba(158,26,32,.38)') : 'rgba(120,110,100,.28)';
      ctx.fill();
      ctx.lineWidth = hit ? 1.6 : 1;
      ctx.strokeStyle = hit ? (c.old ? '#c97d12' : '#9e1a20') : 'rgba(80,70,65,.55)';
      ctx.stroke();
      if (c.old) { // granules
        ctx.fillStyle = 'rgba(40,30,30,.55)';
        for (let g = 0; g < 4; g++) { ctx.beginPath(); ctx.arc(Math.cos(g * 1.7) * c.a * .45, Math.sin(g * 2.3) * c.b * .45, 1.6, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    }
    // scan line
    const g = ctx.createLinearGradient(scanX - 40, 0, scanX, 0);
    g.addColorStop(0, 'rgba(158,26,32,0)'); g.addColorStop(1, 'rgba(158,26,32,.22)');
    ctx.fillStyle = g; ctx.fillRect(scanX - 40, 0, 40, W);
    ctx.fillStyle = '#9e1a20'; ctx.fillRect(scanX - 1, 0, 2, W);
  }

  function tick() {
    scanX += W / 260;
    cells.forEach((c, i) => { if (c.x < scanX) scanned.add(i); });
    if (scanX > W + 40) {
      // one "sweep" = one day of culture: cells proliferate, then the dish is passaged
      scanX = 0; scanned.clear();
      if (cells.length > 150) reset(); else for (let i = 0; i < 18; i++) addCell();
    }
    const area = cells.reduce((s, c) => s + Math.PI * c.a * c.b, 0);
    const conf = Math.min(99, Math.round(area / (W * W) * 100 * 1.6));
    roConf.textContent = conf + '%';
    roCells.textContent = scanned.size;
    roState.textContent = conf >= 80 ? 'Nên cấy chuyển' : 'Đang quét';
    draw();
    if (!reduceMotion) requestAnimationFrame(tick);
  }
  resize();
  addEventListener('resize', () => { if (Math.abs(canvas.clientWidth - W) > 4) resize(); });
  if (reduceMotion) { scanX = W; tick(); } else requestAnimationFrame(tick);
})();

/* ---------- Risk–coverage demo (simulated data) ---------- */
(() => {
  const R = rng(42), N = 400;
  const samples = Array.from({ length: N }, () => {
    const conf = 0.3 + 0.7 * Math.sqrt(R());
    return { conf, correct: R() < Math.pow(conf, 1.4) };
  });
  const stats = t => {
    const acc = samples.filter(s => s.conf >= t);
    const wrong = acc.filter(s => !s.correct).length;
    return { cov: acc.length / N, risk: acc.length ? wrong / acc.length : 0, n: acc.length };
  };

  const curve = [];
  for (let t = 0.3; t <= 0.985; t += 0.01) curve.push(stats(t));
  console.assert(curve.every((p, i) => !i || p.cov <= curve[i - 1].cov), 'coverage must fall as τ rises');

  const svg = document.getElementById('rc-plot');
  const X = c => 48 + c * 292, Y = r => 220 - (r / 0.5) * 196;
  const path = curve.map((p, i) => (i ? 'L' : 'M') + X(p.cov).toFixed(1) + ' ' + Y(p.risk).toFixed(1)).join(' ');
  let grid = '';
  for (let k = 0; k <= 5; k++) {
    const r = k * 0.1;
    grid += `<line x1="48" x2="340" y1="${Y(r)}" y2="${Y(r)}" stroke="#eee3d9"/><text x="40" y="${Y(r) + 4}" text-anchor="end" font-size="10" fill="#5a4c4a">${Math.round(r * 100)}%</text>`;
  }
  for (let k = 0; k <= 4; k++) {
    const c = k * 0.25;
    grid += `<text x="${X(c)}" y="238" text-anchor="middle" font-size="10" fill="#5a4c4a">${c * 100}%</text>`;
  }
  svg.innerHTML = grid +
    `<text x="194" y="256" text-anchor="middle" font-size="10" fill="#1c1414">Coverage</text>` +
    `<text x="12" y="120" text-anchor="middle" font-size="10" fill="#1c1414" transform="rotate(-90 12 120)">Risk</text>` +
    `<path d="${path}" fill="none" stroke="#9e1a20" stroke-width="2.5"/>` +
    `<line id="rc-v" y1="24" y2="220" stroke="#9e1a20" stroke-dasharray="3 4" opacity=".5"/>` +
    `<circle id="rc-dot" r="7" fill="#fff" stroke="#9e1a20" stroke-width="3"/>`;

  const tray = document.getElementById('tray');
  tray.innerHTML = '<i></i>'.repeat(N);
  const dots = tray.children;
  const tau = document.getElementById('tau');
  const out = id => document.getElementById(id);

  function update() {
    const t = +tau.value, s = stats(t);
    out('tau-out').textContent = t.toFixed(2);
    out('st-cov').textContent = Math.round(s.cov * 100) + '%';
    out('st-risk').textContent = (s.risk * 100).toFixed(1) + '%';
    out('st-ref').textContent = N - s.n;
    samples.forEach((p, i) => { dots[i].className = p.conf < t ? 'ref' : p.correct ? 'ok' : 'bad'; });
    const dot = out('rc-dot'), v = out('rc-v');
    dot.setAttribute('cx', X(s.cov)); dot.setAttribute('cy', Y(s.risk));
    v.setAttribute('x1', X(s.cov)); v.setAttribute('x2', X(s.cov));
  }
  tau.addEventListener('input', update);
  update();
})();

/* ---------- Scroll reveal ---------- */
(() => {
  const els = document.querySelectorAll('.section h2, .card, .tier, .step, .novel article, .outcomes article, .impact > div, .limits li, .goal, .rc, .fig');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  els.forEach(el => {
    el.classList.add('reveal');
    el.style.transitionDelay = Math.min([...el.parentNode.children].indexOf(el), 4) * 70 + 'ms'; // stagger grid siblings
    io.observe(el);
  });
})();

/* ---------- Reading progress, active section, mobile menu ---------- */
(() => {
  const bar = document.getElementById('progress');
  const links = [...document.querySelectorAll('#site-nav a')];
  const menu = document.querySelector('.menu');
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }, { passive: true });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.hash === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => io.observe(document.querySelector(a.hash)));
  links.forEach(a => a.addEventListener('click', () => menu.open = false));
})();
