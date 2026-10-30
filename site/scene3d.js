// 3D illustrations (three.js). Both scenes are didactic models, not model output.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const smooth = t => t * t * (3 - 2 * t);

function setup(host, fov, camPos) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(...camPos);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, autoRotate: !reduceMotion, minPolarAngle: 0.25, maxPolarAngle: 1.3 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x20262c, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 8, 5);
  scene.add(sun);
  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(host);
  return { renderer, scene, camera, controls };
}

// Render only while on screen; with reduced motion, only when something changes.
function animate(host, ctx, tick) {
  const { renderer, scene, camera, controls } = ctx;
  let visible = false, running = false;
  const frame = () => {
    if (!visible) { running = false; return; }
    tick();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  const draw = () => { tick(); controls.update(); renderer.render(scene, camera); };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (reduceMotion) { if (visible) draw(); return; }
    if (visible && !running) { running = true; requestAnimationFrame(frame); }
  }).observe(host);
  if (reduceMotion) controls.addEventListener('change', draw);
  return draw;
}

/* ---------- Hero: culture dish being scanned ---------- */
function dish() {
  const host = $('dish');
  const ctx = setup(host, 34, [0, 9, 10.8]);
  const { scene } = ctx;
  const R = 4, MAX = 420, R0 = rng(11);
  const glass = { color: 0xdfe8ec, transparent: true, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.1, 96), new THREE.MeshStandardMaterial({ ...glass, opacity: 0.22 }));
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.8, 96, 1, true), new THREE.MeshStandardMaterial({ ...glass, opacity: 0.16 }));
  wall.position.y = 0.4;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 8, 160), new THREE.MeshStandardMaterial({ color: 0xf2f5f6, roughness: 0.2 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.8;
  const medium = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.34, 96), new THREE.MeshStandardMaterial({ color: 0xd0646c, transparent: true, opacity: 0.1, depthWrite: false }));
  medium.position.y = 0.22;
  scene.add(base, wall, rim, medium);
  // stage rings under the dish
  for (const [r, o] of [[R + 0.6, 0.25], [R + 1.4, 0.12]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.012, 128), new THREE.MeshBasicMaterial({ color: 0x8a949b, transparent: true, opacity: o }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.06;
    scene.add(ring);
  }

  const cells = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 10), new THREE.MeshStandardMaterial({ roughness: 0.45 }), MAX);
  const info = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < MAX; i++) {
    const a = R0() * Math.PI * 2, d = Math.sqrt(R0()) * (R - 0.35);
    const old = R0() < 0.12; // larger, flattened, "senescent-looking"
    const p = new THREE.Vector3(Math.cos(a) * d, 0.1, Math.sin(a) * d);
    const s = old ? new THREE.Vector3(0.17 + R0() * 0.05, 0.03, 0.12 + R0() * 0.04) : new THREE.Vector3(0.24 + R0() * 0.16, 0.04, 0.04 + R0() * 0.02);
    q.setFromAxisAngle(up, R0() * Math.PI);
    m.compose(p, q, s);
    cells.setMatrixAt(i, m);
    cells.setColorAt(i, new THREE.Color(0x9aa3aa));
    info.push({ x: p.x, old });
  }
  scene.add(cells);

  const scanMat = new THREE.MeshBasicMaterial({ color: 0xff4a54, transparent: true, opacity: 0.85 });
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.5, 1), scanMat);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: 0xff4a54, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  scan.position.y = 0.25; glow.position.y = 0.16;
  scene.add(scan, glow);

  const gray = new THREE.Color(0x9aa3aa), red = new THREE.Color(0xe0343e), amber = new THREE.Color(0xf0a63a);
  const START = 140, STEP = 70;
  let shown = START, x = -R, day = 1;
  const t0 = performance.now();
  const ui = { conf: $('ro-conf'), bar: $('ro-bar'), cells: $('ro-cells'), old: $('ro-old'), time: $('hud-time') };
  function tick() {
    x = reduceMotion ? R : x + 0.028;
    if (x > R + 0.4) { // one sweep = one day in culture: cells proliferate, then the dish is passaged
      x = -R; day++;
      shown = shown + STEP > MAX ? START : shown + STEP;
      if (shown === START) day = 1;
    }
    cells.count = shown;
    let seg = 0, old = 0;
    for (let i = 0; i < shown; i++) {
      const hit = info[i].x < x;
      cells.setColorAt(i, hit ? (info[i].old ? amber : red) : gray);
      if (hit) { seg++; if (info[i].old) old++; }
    }
    cells.instanceColor.needsUpdate = true;
    const half = Math.sqrt(Math.max(0, R * R - x * x));
    scan.visible = glow.visible = half > 0.05;
    scan.position.x = glow.position.x = x;
    scan.scale.z = glow.scale.y = 2 * half;
    glow.position.x = x - 0.45;
    const conf = Math.round(shown / MAX * 86);
    ui.conf.textContent = conf + '%';
    ui.bar.style.width = conf + '%';
    ui.cells.textContent = `${seg}/${shown}`;
    ui.old.textContent = old;
    ui.time.textContent = `Ngày ${day} · ${String(Math.floor((performance.now() - t0) / 1000) % 60).padStart(2, '0')}s`;
  }
  ctx.controls.autoRotateSpeed = 0.55;
  ctx.renderer.domElement.addEventListener('pointerdown', () => $('hint').remove(), { once: true });
  animate(host, ctx, tick);
}

/* ---------- Single MSC: young spindle → senescent flat cell ---------- */
function cell() {
  const host = $('cell');
  const ctx = setup(host, 32, [0, 2.6, 5.4]);
  const { scene } = ctx;
  const rim = new THREE.DirectionalLight(0xff8a90, 1.2);
  rim.position.set(-5, 1, -4);
  scene.add(rim);

  const geo = new THREE.SphereGeometry(1, 96, 64);
  const pos = geo.attributes.position, n = pos.count;
  const young = new Float32Array(n * 3), aged = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const taper = Math.pow(Math.max(0, 1 - x * x), 0.85);
    young.set([x * 2.3, y * 0.3 * taper + 0.12 * Math.sin(x * 2.2), z * 0.5 * taper], i * 3);
    const th = Math.atan2(z, x);
    const r = 1.75 * (1 + 0.13 * Math.sin(3 * th) + 0.08 * Math.sin(5 * th + 1.3));
    aged.set([x * r, y * 0.2, z * r * 0.9], i * 3);
  }
  const mem = new THREE.MeshPhysicalMaterial({ color: 0xeadbd5, transparent: true, opacity: 0.55, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const membrane = new THREE.Mesh(geo, mem);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0x8a1820, roughness: 0.5 }));
  const G = 46, R1 = rng(5);
  const gran = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.6 }), G);
  const gInfo = Array.from({ length: G }, (_, i) => {
    const a = R1() * Math.PI * 2, d = 0.55 + R1() * 0.85;
    return { p: new THREE.Vector3(Math.cos(a) * d, (R1() - 0.5) * 0.12, Math.sin(a) * d * 0.9), at: i / G };
  });
  scene.add(membrane, nucleus, gran);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.55;
  scene.add(shadow);

  const cYoung = new THREE.Color(0xeadbd5), cAged = new THREE.Color(0xe9c9a2);
  const m = new THREE.Matrix4(), one = new THREE.Quaternion();
  const age = $('age');
  let shownT = -1;
  function apply(t) {
    const k = smooth(t);
    for (let i = 0; i < n * 3; i++) pos.array[i] = young[i] + (aged[i] - young[i]) * k;
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    mem.color.copy(cYoung).lerp(cAged, k);
    nucleus.scale.set(0.42 + 0.12 * k, 0.22 - 0.06 * k, 0.26 + 0.22 * k);
    gInfo.forEach((g, i) => {
      const s = Math.min(1, Math.max(0, (t - g.at * 0.85) * 5));
      m.compose(g.p, one, new THREE.Vector3(s, s, s));
      gran.setMatrixAt(i, m);
    });
    gran.instanceMatrix.needsUpdate = true;
    shadow.scale.setScalar(0.7 + 0.5 * k);
    const lvl = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
    $('t-area').textContent = '×' + (1 + 2.2 * k).toFixed(1);
    $('t-flat').textContent = ['thấp', 'vừa', 'cao'][lvl];
    $('t-gran').textContent = ['ít', 'vừa', 'nhiều'][lvl];
    $('cell-state').textContent = ['Hình thoi · trẻ', 'Đang chuyển dạng', 'To, dẹt, nhiều hạt · lão hóa'][lvl];
  }
  const tick = () => {
    const t = age.value / 100;
    if (t !== shownT) { shownT = t; apply(t); }
  };
  ctx.controls.autoRotateSpeed = 1.2;
  const draw = animate(host, ctx, tick);
  age.addEventListener('input', () => reduceMotion && draw());
}

function fallback(host, html) { host.insertAdjacentHTML('afterbegin', html); }
try { dish(); } catch (e) {
  console.warn('3D unavailable', e);
  fallback($('dish'), '<img class="fallback-img" src="assets/p3-in.webp" alt="Ảnh tương phản pha MSC">');
}
try { cell(); } catch (e) {
  console.warn('3D unavailable', e);
  fallback($('cell'), '<p class="note" style="position:absolute;inset:auto 16px 16px;color:#9aa3aa">Trình duyệt không hỗ trợ WebGL.</p>');
}
