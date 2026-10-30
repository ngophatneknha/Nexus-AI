// Seeded RNG so the illustrations look the same on every visit.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

/* ---------- Reading progress, active section, mobile menu, pipeline rail ---------- */
(() => {
  const bar = $('progress');
  const links = [...document.querySelectorAll('#site-nav a')];
  const menu = document.querySelector('.menu');
  const pipe = $('pipeline'), rail = $('rail');
  const steps = [...document.querySelectorAll('.stp')];
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    // pipeline: rail fills to the viewport middle, steps above it light up
    const r = pipe.getBoundingClientRect(), mid = innerHeight * 0.55;
    rail.style.height = Math.max(0, Math.min(r.height - 48, mid - r.top - 24)) + 'px';
    steps.forEach(s => s.classList.toggle('lit', s.getBoundingClientRect().top + 24 < mid));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.hash === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => io.observe(document.querySelector(a.hash)));
  links.forEach(a => a.addEventListener('click', () => menu.open = false));
})();

/* ---------- Scroll reveal ---------- */
(() => {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => {
    el.style.transitionDelay = Math.min([...el.parentNode.children].indexOf(el), 4) * 70 + 'ms';
    io.observe(el);
  });
})();

/* ---------- Real images: P1–P4 compare ---------- */
(() => {
  const box = $('compare');
  const setPos = p => {
    p = Math.max(0, Math.min(100, p));
    box.style.setProperty('--pos', p + '%');
    box.setAttribute('aria-valuenow', Math.round(p));
  };
  const fromEvent = e => setPos((e.clientX - box.getBoundingClientRect().left) / box.clientWidth * 100);
  let drag = false;
  box.addEventListener('pointerdown', e => { drag = true; box.setPointerCapture(e.pointerId); fromEvent(e); });
  box.addEventListener('pointermove', e => drag && fromEvent(e));
  box.addEventListener('pointerup', () => drag = false);
  box.addEventListener('keydown', e => {
    const v = +box.getAttribute('aria-valuenow');
    if (e.key === 'ArrowLeft') { setPos(v - 5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos(v + 5); e.preventDefault(); }
  });

  const btns = [...document.querySelectorAll('#passages button')];
  const rows = [...document.querySelectorAll('#density .row')];
  btns.forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.p;
    $('cmp-in').src = `assets/p${p}-in.webp`;
    $('cmp-seg').src = `assets/p${p}-mask.webp`;
    $('cmp-title').textContent = 'Passage P' + p;
    btns.forEach(x => x.setAttribute('aria-pressed', x === b));
    rows.forEach((r, i) => r.classList.toggle('on', i === p - 1));
  }));
  // nudge the handle once so people notice it can move
  if (!reduceMotion) {
    let t = 0;
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const anim = () => { t += 0.03; setPos(50 + Math.sin(t * 3) * 22 * Math.max(0, 1 - t / 2.2)); if (t < 2.2) requestAnimationFrame(anim); else setPos(50); };
      anim();
    }, { threshold: 0.6 });
    io.observe(box);
  }
})();

/* ---------- Leave-one-dataset-out rotation ---------- */
(() => {
  const srcs = [...document.querySelectorAll('#sources .src')];
  let k = 0, timer;
  function show(i) {
    k = i;
    srcs.forEach((s, j) => {
      s.className = 'src ' + (j === i ? 'test' : 'train');
      s.querySelector('em').textContent = j === i ? 'kiểm tra · chưa thấy' : 'huấn luyện';
    });
    $('fold').textContent = `Lượt ${i + 1}/${srcs.length}: giữ riêng ${srcs[i].firstChild.textContent}`;
  }
  const start = () => { if (!reduceMotion) timer = setInterval(() => show((k + 1) % srcs.length), 1800); };
  srcs.forEach((s, i) => s.addEventListener('click', () => { clearInterval(timer); show(i); }));
  show(0); start();
})();

/* ---------- Simulated predictions shared by both reliability panels ---------- */
const N = 400;
const samples = (() => {
  const R = rng(42);
  return Array.from({ length: N }, () => {
    const conf = 0.3 + 0.7 * Math.sqrt(R());
    return { conf, correct: R() < Math.pow(conf, 1.9) }; // overconfident on purpose
  });
})();

/* ---------- ① Reliability diagram ---------- */
(() => {
  const svg = $('rel-plot');
  const X = v => 46 + v * 296, Y = v => 240 - v * 216;
  const bins = Array.from({ length: 7 }, (_, i) => 0.3 + i * 0.1);
  function stats(after) {
    // "after": temperature-style rescaling, so stated confidence matches observed accuracy
    return bins.map(lo => {
      const inBin = samples.filter(s => s.conf >= lo && s.conf < lo + 0.1);
      const acc = inBin.filter(s => s.correct).length / (inBin.length || 1);
      const meanConf = inBin.reduce((a, s) => a + s.conf, 0) / (inBin.length || 1);
      return { lo, n: inBin.length, acc, conf: after ? acc + (meanConf - acc) * 0.12 : meanConf };
    });
  }
  let axes = '';
  for (let k = 0; k <= 5; k++) {
    const v = k / 5;
    axes += `<line x1="46" x2="342" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e4e5"/><text x="38" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="#6b7177">${Math.round(v * 100)}%</text>`;
    axes += `<text x="${X(v)}" y="256" text-anchor="middle" font-size="10" fill="#6b7177">${Math.round(v * 100)}%</text>`;
  }
  axes += `<text x="194" y="274" text-anchor="middle" font-size="10" fill="#121416">Độ tin cậy dự đoán</text><text x="10" y="132" text-anchor="middle" font-size="10" fill="#121416" transform="rotate(-90 10 132)">Độ chính xác thực tế</text>`;
  axes += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="#121416" stroke-dasharray="4 4"/><text x="${X(0.97)}" y="${Y(0.97) - 6}" text-anchor="end" font-size="10" fill="#121416">hoàn hảo</text>`;
  function draw(after) {
    const st = stats(after);
    let bars = '';
    st.forEach(b => {
      const x = X(b.lo) + 3, w = X(0.1) - X(0) - 6;
      // gap between claimed confidence and real accuracy
      bars += `<rect x="${x}" width="${w}" y="${Y(Math.max(b.conf, b.acc))}" height="${Math.abs(Y(b.acc) - Y(b.conf))}" fill="#d23a42" opacity=".18"/>`;
      bars += `<rect x="${x}" width="${w}" y="${Y(b.acc)}" height="${Y(0) - Y(b.acc)}" fill="${after ? '#0f766e' : '#d23a42'}" opacity=".85"/>`;
      bars += `<line x1="${x}" x2="${x + w}" y1="${Y(b.conf)}" y2="${Y(b.conf)}" stroke="#121416" stroke-width="1.5"/>`;
    });
    svg.innerHTML = axes + bars;
    const ece = st.reduce((a, b) => a + b.n / N * Math.abs(b.acc - b.conf), 0);
    $('ece').textContent = ece.toFixed(3);
    $('cal-before').setAttribute('aria-pressed', !after);
    $('cal-after').setAttribute('aria-pressed', after);
  }
  $('cal-before').addEventListener('click', () => draw(false));
  $('cal-after').addEventListener('click', () => draw(true));
  draw(false);
})();

/* ---------- ② Risk–coverage ---------- */
(() => {
  const stats = t => {
    const acc = samples.filter(s => s.conf >= t);
    const wrong = acc.filter(s => !s.correct).length;
    return { cov: acc.length / N, risk: acc.length ? wrong / acc.length : 0, n: acc.length };
  };
  const curve = [];
  for (let t = 0.3; t <= 0.985; t += 0.01) curve.push(stats(t));
  console.assert(curve.every((p, i) => !i || p.cov <= curve[i - 1].cov), 'coverage must fall as τ rises');

  const svg = $('rc-plot');
  const maxR = Math.ceil(Math.max(...curve.map(p => p.risk)) * 10) / 10;
  const X = c => 46 + c * 296, Y = r => 166 - (r / maxR) * 150;
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const r = maxR * k / 4, c = k / 4;
    grid += `<line x1="46" x2="342" y1="${Y(r)}" y2="${Y(r)}" stroke="#e3e4e5"/><text x="38" y="${Y(r) + 4}" text-anchor="end" font-size="10" fill="#6b7177">${Math.round(r * 100)}%</text>`;
    grid += `<text x="${X(c)}" y="182" text-anchor="middle" font-size="10" fill="#6b7177">${c * 100}%</text>`;
  }
  const path = curve.map((p, i) => (i ? 'L' : 'M') + X(p.cov).toFixed(1) + ' ' + Y(p.risk).toFixed(1)).join(' ');
  svg.innerHTML = grid +
    `<text x="194" y="198" text-anchor="middle" font-size="10" fill="#121416">Coverage</text>` +
    `<text x="10" y="90" text-anchor="middle" font-size="10" fill="#121416" transform="rotate(-90 10 90)">Risk</text>` +
    `<path d="${path}" fill="none" stroke="#a3141c" stroke-width="2"/>` +
    `<line id="rc-v" y1="16" y2="166" stroke="#a3141c" stroke-dasharray="3 4" opacity=".5"/>` +
    `<circle id="rc-dot" r="6" fill="#fff" stroke="#a3141c" stroke-width="2.5"/>`;

  const tray = $('tray');
  tray.innerHTML = '<i></i>'.repeat(N);
  const dots = tray.children, tau = $('tau');
  function update() {
    const t = +tau.value, s = stats(t);
    $('tau-out').textContent = t.toFixed(2);
    $('st-cov').textContent = Math.round(s.cov * 100) + '%';
    $('st-risk').textContent = (s.risk * 100).toFixed(1) + '%';
    $('st-ref').textContent = N - s.n;
    samples.forEach((p, i) => { dots[i].className = p.conf < t ? 'ref' : p.correct ? 'ok' : 'bad'; });
    const dot = $('rc-dot'), v = $('rc-v');
    dot.setAttribute('cx', X(s.cov)); dot.setAttribute('cy', Y(s.risk));
    v.setAttribute('x1', X(s.cov)); v.setAttribute('x2', X(s.cov));
  }
  tau.addEventListener('input', update);
  update();
})();
