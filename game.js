// game.js — classic script (works via file:// double-click, needs internet for three.min.js CDN)
window.addEventListener('error', (e) => {
  const box = document.getElementById('err');
  if (box && e && e.message) {
    box.classList.remove('hidden');
    box.textContent = 'Error: ' + e.message + ' — press F12, screenshot the red Console line and send it to me.';
  }
});

// ---------- DOM ----------
const catnipEl = document.getElementById('catnip');
const tunaEl = document.getElementById('tuna');
const hpEl = document.getElementById('hp');
const toastEl = document.getElementById('toast');
const fightEl = document.getElementById('fight');
const fightTitle = document.getElementById('fight-title');
const fightSub = document.getElementById('fight-sub');
const phpEl = document.getElementById('php');
const ehpEl = document.getElementById('ehp');
const enemyNameEl = document.getElementById('enemy-name');
const letterWrap = document.getElementById('letter-wrap');
const miceEl = document.getElementById('mice');

let catnip = 0, tuna = 0, miceCaught = 0, letterRead = false;
function toast(msg, ms = 2400) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.style.opacity = 0, ms);
}
function updateHUD() {
  catnipEl.textContent = catnip;
  tunaEl.textContent = tuna;
  hpEl.textContent = player ? player.hp : 5;
  if (miceEl) miceEl.textContent = miceCaught;
  if (catnip >= 10 && tuna >= 10) document.getElementById('win').classList.remove('hidden');
}

// ---------- AUDIO ----------
// Music stays 8-bit. Meow / hiss / bark are smooth filtered synth (not square-wave)
// so they sound like animals, not the soundtrack.
let AC = null, masterBus = null, musicOn = false, volume = 0.7;
function audio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
// Every sound goes through this master bus, so the Vol slider controls all.
function bus() {
  const ac = audio();
  if (!masterBus) {
    masterBus = ac.createGain();
    masterBus.gain.value = volume;
    masterBus.connect(ac.destination);
  }
  return masterBus;
}
function chip(f0, dur, type, vol, when = 0, slideTo = null) {
  const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  const t = ac.currentTime + when;
  o.frequency.setValueAtTime(Math.max(30, f0), t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bus());
  o.start(t); o.stop(t + dur + 0.03);
}
function noiseBurst(dur, filterType, freq, vol, when = 0, q = 1) {
  const ac = audio();
  const len = Math.floor(dur * ac.sampleRate);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  const t = ac.currentTime + when;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus());
  src.start(t);
}

// Exaggerated but animal-like voices (formants + breath, no square-wave).
// Two-syllable raspy ME-OW with growl onset, chesty double WOOF, spitty HISS.
function voiceBase(dur) {
  const ac = audio();
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.34, t + 0.08);
  master.gain.setValueAtTime(0.34, t + dur - 0.14);
  master.gain.exponentialRampToValueAtTime(0.001, t + dur);
  master.connect(bus());
  return { ac, t, master };
}
function meow(pitch = 1) {
  const { ac, t, master } = voiceBase(1.05);
  const dur = 1.05;
  // faint chest rumble under the onset
  const growl = ac.createOscillator(); growl.type = 'sine';
  growl.frequency.setValueAtTime(82 * pitch, t);
  growl.frequency.linearRampToValueAtTime(105 * pitch, t + 0.3);
  const growlG = ac.createGain(); growlG.gain.setValueAtTime(0.16, t);
  growlG.gain.setValueAtTime(0.16, t + 0.22);
  growlG.gain.linearRampToValueAtTime(0.0, t + 0.4);
  growl.connect(growlG); growlG.connect(master);
  growl.start(t); growl.stop(t + 0.45);
  // main cry: "MEEE (rises a little) - OW (falls)"
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(390 * pitch, t + 0.05);
  o.frequency.linearRampToValueAtTime(640 * pitch, t + 0.45);
  o.frequency.linearRampToValueAtTime(690 * pitch, t + 0.55);
  o.frequency.exponentialRampToValueAtTime(300 * pitch, t + dur);
  const vib = ac.createOscillator(), vg = ac.createGain();
  vib.frequency.value = 5; vg.gain.value = 10 * pitch;
  vib.connect(vg); vg.connect(o.frequency);
  // EE-ish then OW-ish mouth shape
  const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 2.5;
  f1.frequency.setValueAtTime(620, t);
  f1.frequency.linearRampToValueAtTime(820, t + 0.45);
  f1.frequency.linearRampToValueAtTime(380, t + dur);
  const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 3;
  f2.frequency.setValueAtTime(1650 * pitch, t);
  f2.frequency.linearRampToValueAtTime(2050 * pitch, t + 0.45);
  f2.frequency.linearRampToValueAtTime(950 * pitch, t + dur);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const g = ac.createGain(); g.gain.value = 0.8;
  o.connect(f1); o.connect(f2); f1.connect(lp); f2.connect(lp); lp.connect(g); g.connect(master);
  o.start(t + 0.03); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  noiseBurst(0.6, 'bandpass', 2400, 0.03, 0.05, 1.5);
}
function hiss() {
  const ac = audio();
  const t = ac.currentTime, dur = 1.0;
  const len = Math.floor(dur * ac.sampleRate);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const env = Math.min(1, k * 12) * Math.pow(1 - k, 1.2);
    const flutter = 0.75 + 0.25 * Math.sin(i * 0.11);
    const white = Math.random() * 2 - 1;
    last = last * 0.35 + white * 0.65; // darken a touch
    d[i] = (white * 0.7 + last * 0.5) * env * flutter;
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
  const peak = ac.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 6200; peak.Q.value = 0.9; peak.gain.value = 8;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp); hp.connect(peak); peak.connect(g); g.connect(bus());
  src.start(t);
  noiseBurst(0.06, 'highpass', 5000, 0.3, 0); // spit onset
}
function bark(pitch = 1) {
  const ac = audio(), t = ac.currentTime;
  [0, 0.22].forEach((off, idx) => {
    const dur = 0.16;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime((idx ? 380 : 420) * pitch, t + off);
    o.frequency.exponentialRampToValueAtTime(120 * pitch, t + off + dur);
    const chest = ac.createBiquadFilter(); chest.type = 'lowpass'; chest.frequency.value = 900;
    const form = ac.createBiquadFilter(); form.type = 'peaking'; form.frequency.value = 750; form.Q.value = 2; form.gain.value = 6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.55, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + dur + 0.03);
    o.connect(chest); chest.connect(form); form.connect(g); g.connect(bus());
    o.start(t + off); o.stop(t + off + dur + 0.05);
  });
  noiseBurst(0.05, 'lowpass', 1400, 0.3, 0);
  noiseBurst(0.05, 'lowpass', 1400, 0.3, 0.22);
}
function squeak(vol = 0.1) {
  chip(2700, 0.07, 'sine', vol, 0, 3400);
  chip(3200, 0.06, 'sine', vol * 0.8, 0.08, 2500);
}
function slapSnd() { noiseBurst(0.07, 'lowpass', 1800, 0.3); chip(180, 0.07, 'triangle', 0.2); }
function pickupSnd() { chip(660, 0.1, 'triangle', 0.18); chip(880, 0.14, 'triangle', 0.18, 0.09); }
function hurtSnd() { chip(220, 0.25, 'sawtooth', 0.12, 0, 70); }

// Cartoon-Halloween showtune waltz: sneaky pizzicato, creeping chromatic
// bass, music-box celesta lead, tuba oom-pah-pah, stab + slide gags.
// A-minor, 3/4, deliberately vaudeville-spooky.
const W_LEAD = [
  880, 0, 0,  0, 830.6, 0,  880, 0, 0,  1046.5, 0, 987.8,
  880, 0, 0,  0, 830.6, 0,  783.99, 0, 739.99,  698.5, 0, 0,
  659.3, 0, 0,  0, 698.5, 0,  880, 0, 0,  0, 0, 1046.5,
  987.8, 0, 880,  830.6, 0, 0,  783.99, 0, 0,  659.3, 0, 0
];
const W_PIZZ = [
  440, 0, 523.25,  440, 0, 523.25,  440, 0, 523.25,  523.25, 0, 523.25,
  349.2, 0, 415.3,  349.2, 0, 415.3,  329.6, 0, 392,  329.6, 0, 329.6,
  329.6, 0, 392,  329.6, 0, 440,  440, 0, 523.25,  523.25, 0, 587.3,
  587.3, 0, 523.25,  493.9, 0, 440,  392, 0, 329.6,  220, 0, 0
];
const W_BASS = [
  110, 0, 0,  110, 164.8, 164.8,  110, 0, 0,  130.8, 196, 196,
  87.3, 0, 0,  87.3, 130.8, 130.8,  82.4, 0, 0,  82.4, 123.5, 123.5,
  82.4, 0, 0,  82.4, 123.5, 123.5,  110, 0, 0,  146.8, 0, 110,
  146.8, 0, 0,  130.8, 0, 123.5,  110, 0, 0,  55, 0, 82.4
];
let musicStep = 0;
function startMusic() {
  if (musicOn) return; musicOn = true;
  setInterval(() => {
    if (!AC || document.hidden) return;
    const i = musicStep % W_LEAD.length;
    const L = W_LEAD[i], P = W_PIZZ[i], B = W_BASS[i];
    if (L) { chip(L, 0.42, 'square', 0.02); chip(L * 2, 0.25, 'sine', 0.013); chip(L * 0.5, 0.4, 'triangle', 0.02); }
    if (P) chip(P, 0.14, 'square', 0.014);
    if (B) chip(B, 0.42, 'triangle', 0.085);
    if (i % 24 === 23) { chip(220, 0.35, 'sawtooth', 0.03, 0, 110); } // tuba slide gag
    if (i % 24 === 12) { chip(1244.5, 0.18, 'square', 0.02); chip(1318.5, 0.18, 'square', 0.02, 0.09); } // stab
    if (i % 3 === 2) noiseBurst(0.02, 'highpass', 7500, 0.01);
    musicStep++;
  }, 272);
}

// ---------- THREE SETUP (Burton Halloween: purple gloom + pumpkin glow) ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2138);
scene.fog = new THREE.Fog(0x2a2138, 35, 150);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-wrap').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8a7ab8, 0x2e2130, 0.7));
const moonLight = new THREE.DirectionalLight(0xb8a8ff, 0.55);
moonLight.position.set(-50, 80, -30);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.left = -130; moonLight.shadow.camera.right = 130;
moonLight.shadow.camera.top = 130; moonLight.shadow.camera.bottom = -130;
scene.add(moonLight);
// warm pumpkin-ish street glow from town center
const warm = new THREE.PointLight(0xff8c3a, 1.1, 120);
warm.position.set(0, 12, 0);
scene.add(warm);

function pixelTex(base, speck1, speck2) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 16, 16);
  g.fillStyle = speck1;
  for (let i = 0; i < 14; i++) g.fillRect(Math.random() * 16 | 0, Math.random() * 16 | 0, 2, 1);
  if (speck2) { g.fillStyle = speck2; for (let i = 0; i < 7; i++) g.fillRect(Math.random() * 16 | 0, Math.random() * 16 | 0, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function flat(color) { return new THREE.MeshLambertMaterial({ color }); }
function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

// ---------- WORLD (big + foggy, edge hidden) ----------
const WORLD_R = 135;
const colliders = [];
function solid(x, z, w, d, top) {
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
}
const grassTex = pixelTex('#4a3d4a', '#413545', '#554657');
grassTex.repeat.set(70, 70);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), new THREE.MeshLambertMaterial({ map: grassTex }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// crooked moon
const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshBasicMaterial({ color: 0xf2b64a, fog: false }));
moon.position.set(-120, 95, -180); moon.lookAt(0, 0, 0); scene.add(moon);
const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(20, 24), new THREE.MeshBasicMaterial({ color: 0xf2b64a, transparent: true, opacity: 0.22, fog: false }));
moonHalo.position.set(-120, 95, -181); moonHalo.lookAt(0, 0, 0); scene.add(moonHalo);

// roads: dark cobble + worn edges
const roadMat = new THREE.MeshLambertMaterial({ map: pixelTex('#3a3340', '#332c39') });
const walkMat = flat(0x5a4f5e);
[[0, 0, 340, 9], [0, 0, 9, 340]].forEach(([x, z, w, d]) => {
  const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), roadMat);
  r.position.set(x, 0.06, z); r.receiveShadow = true; scene.add(r);
});

// Crooked Burton house: leaning walls, tall bent roof, glowing windows
function house(x, z, wall = 0x4a3f55, roof = 0x2e2438, rotY = 0, lean = 0.08) {
  const g = new THREE.Group();
  const found = shadowed(new THREE.Mesh(new THREE.BoxGeometry(12.5, 1, 10.5), flat(0x2c2530)));
  found.position.y = 0.5; g.add(found);
  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 10),
    new THREE.MeshLambertMaterial({ map: pixelTex('#5a4c68', '#4a3f55') })));
  base.material.color.set(wall);
  base.position.y = 4.5; base.rotation.z = lean; g.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(12.3, 0.5, 10.3), flat(0x1e1826));
  trim.position.y = 7.4; trim.rotation.z = lean; g.add(trim);
  // tall bent spire roof
  const roofM = shadowed(new THREE.Mesh(new THREE.ConeGeometry(9.6, 6.5, 4), flat(roof)));
  roofM.position.set(lean * 8, 11, 0); roofM.rotation.y = Math.PI / 4; roofM.rotation.z = lean * 2; g.add(roofM);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), flat(0x1e1826));
  tip.position.set(lean * 12, 15, 0); tip.rotation.z = lean * 3; g.add(tip);
  const chim = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), flat(0x3a3040)));
  chim.position.set(3.4, 10.5, -1.5); chim.rotation.z = -lean; g.add(chim);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.3), flat(0x241a2e));
  door.position.set(0, 2.6, 5.05); g.add(door);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), flat(0xd97b2e));
  knob.position.set(0.6, 2.6, 5.25); g.add(knob);
  // glowing pumpkin windows
  [-3.6, 3.6].forEach(wx => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 0.25), flat(0x1e1826));
    frame.position.set(wx, 4.6, 5.02); g.add(frame);
    const glow = (wx > 0) !== (x > 0); // some windows dark, some lit
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.28),
      new THREE.MeshBasicMaterial({ color: glow ? 0xffb154 : 0x241e2e }));
    glass.position.set(wx, 4.6, 5.03); g.add(glass);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.3), flat(0x1e1826));
    barV.position.set(wx, 4.6, 5.05); g.add(barV);
    const barH = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.3), flat(0x1e1826));
    barH.position.set(wx, 4.6, 5.05); g.add(barH);
  });
  g.position.set(x, 0, z); g.rotation.y = rotY;
  scene.add(g);
  solid(x, z, 12, 10, 8);
}
house(-34, -32, 0x4a3f55, 0x2e2438, 0, 0.07);
house(34, -36, 0x3f4a5a, 0x232030, 0, -0.06);
house(-40, 32, 0x55404a, 0x30242e, 0.2, 0.09);
house(38, 36, 0x44503f, 0x242e22, -0.2, -0.08);
house(-4, -62, 0x4f4258, 0x2a2138, 0, 0.05);
house(-74, -6, 0x503f3f, 0x2e2126, 0.4, -0.07);
house(74, 4, 0x3f4a55, 0x20262e, -0.4, 0.06);
house(4, 66, 0x4a3f55, 0x2e2438, 0, -0.05);
house(-70, -58, 0x443a52, 0x262033, 0.5, 0.1);
house(70, -62, 0x3d443e, 0x222a22, -0.5, -0.09);

// dead Burton trees: twisted trunks, sparse purple canopy
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 0.9), flat(0x2c2130)));
  trunk.position.y = 2.6; trunk.rotation.z = 0.12; g.add(trunk);
  const branch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.4), flat(0x2c2130));
  branch.position.set(0.8, 4.4, 0); branch.rotation.z = 0.5; g.add(branch);
  const branch2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.35), flat(0x2c2130));
  branch2.position.set(-0.7, 5.2, 0); branch2.rotation.z = -0.6; g.add(branch2);
  const c1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), flat(0x5a2f4a)));
  c1.position.y = 6.2; c1.rotation.y = 0.4; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), flat(0x6e3a55));
  c2.position.set(0.5, 7, 0); g.add(c2);
  g.position.set(x, 0, z); g.scale.setScalar(s);
  g.rotation.y = Math.random() * 3;
  scene.add(g);
  solid(x, z, 1.1, 1.1, 3.4);
}
[[-20, -14, 1.1], [20, -10, 1.2], [-14, 20, 1], [22, 16, 0.9], [-52, -16, 1.2], [52, -16, 1],
 [-18, 52, 1.1], [16, 54, 1], [62, 26, 1.2], [-62, 20, 1], [84, -36, 1.3], [-84, 36, 1.2],
 [44, -64, 1], [-44, -64, 1.1], [84, 62, 1], [-84, -42, 1],
 [-88, 78, 1.4], [88, 80, 1.3], [90, -84, 1.4], [-90, -84, 1.3]].forEach(([x, z, s]) => tree(x, z, s));

// fog boundary: ring of dark pines so the edge vanishes into mist
for (let a = 0; a < 40; a++) {
  const ang = a / 40 * Math.PI * 2;
  const R = 150 + Math.random() * 12;
  const x = Math.cos(ang) * R, z = Math.sin(ang) * R;
  const h = 14 + Math.random() * 10;
  const pine = new THREE.Mesh(new THREE.ConeGeometry(5 + Math.random() * 2, h, 6), flat(0x1e1826));
  pine.position.set(x, h / 2, z);
  scene.add(pine);
}

// glowing pumpkins along roads (Burton lights)
const pumpkinGlows = [];
function pumpkin(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), flat(0xc95a2e));
  body.position.y = 0.45; g.add(body);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.25), flat(0x3a4a2e));
  stem.position.y = 1.05; g.add(stem);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  face.position.set(0, 0.5, 0.62); g.add(face);
  const l = new THREE.PointLight(0xff8c3a, 0.9, 14);
  l.position.set(x, 1.6, z); scene.add(l);
  pumpkinGlows.push(l);
  g.position.set(x, 0, z); scene.add(g);
}
for (let i = -4; i <= 4; i++) {
  if (!i) continue;
  pumpkin(i * 22, 7); pumpkin(i * 22, -7); pumpkin(7, i * 22); pumpkin(-7, i * 22);
}
pumpkin(-64, 66); pumpkin(-62, 68); // breadcrumb trail to hidden Biscuit
// crooked iron fences
const fenceMat = flat(0x1e1826);
for (let i = -8; i <= 8; i++) {
  [[i * 2.2, 80], [i * 2.2, -80]].forEach(([x, z]) => {
    const f = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 1.3, 0.25), fenceMat));
    f.position.set(x, 0.65, z); f.rotation.z = (Math.random() - 0.5) * 0.08; scene.add(f);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), fenceMat);
    spike.position.set(x, 1.5, z); scene.add(spike);
  });
}
// coffin crates to climb
[[-8, -14], [-6, -14], [8, 20], [24, -8], [-24, 8], [-58, 60], [60, -56]].forEach(([x, z]) => {
  const c = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2.4),
    new THREE.MeshLambertMaterial({ map: pixelTex('#4a3646', '#33262f') })));
  c.position.set(x, 1, z); c.rotation.y = 0.2; scene.add(c);
  solid(x, z, 2, 2.4, 2);
});
// street lamps: orange gaslight glow
for (let i = -2; i <= 2; i++) {
  if (!i) continue;
  [[i * 34, 8], [i * 34, -8], [8, i * 34], [-8, i * 34]].forEach(([x, z]) => {
    const pole = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), flat(0x14101c)));
    pole.position.set(x, 3.5, z); pole.rotation.z = 0.04; scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), new THREE.MeshBasicMaterial({ color: 0xffb154 }));
    lamp.position.set(x, 7.2, z); scene.add(lamp);
    const glow = new THREE.PointLight(0xff8c3a, 1.0, 26);
    glow.position.set(x, 7.2, z); scene.add(glow);
    solid(x, z, 0.6, 0.6, 0.5);
  });
}
// murky pond + benches
const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 24), flat(0x2e3a4a));
pond.rotation.x = -Math.PI / 2; pond.position.set(-16, 0.07, -40); pond.receiveShadow = true; scene.add(pond);
const rim = new THREE.Mesh(new THREE.RingGeometry(7, 8.2, 24), flat(0xc9bda2));
rim.rotation.x = -Math.PI / 2; rim.position.set(-16, 0.07, -40); scene.add(rim);
[[-9, -36, 0.5], [-23, -36, -0.5]].forEach(([x, z, r]) => {
  const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 1), flat(0x8a6640)));
  b.position.set(x, 0.9, z); b.rotation.y = r; scene.add(b);
  [[-1.2], [1.2]].forEach(([o]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.9), flat(0x5d4a3a));
    leg.position.set(x + o, 0.45, z); scene.add(leg);
  });
  solid(x, z, 3, 1, 1.1);
});

// low Halloween clouds + circling bats
const clouds = [];
for (let i = 0; i < 10; i++) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(5 + Math.random() * 4, 1.4, 2.5 + Math.random()), flat(0x3a3040));
    b.position.set(j * 3 - 4, Math.random() * 0.8, Math.random()); c.add(b);
  }
  c.position.set(Math.random() * 240 - 120, 30 + Math.random() * 10, Math.random() * 240 - 120);
  scene.add(c); clouds.push(c);
}
const bats = [];
for (let i = 0; i < 18; i++) {
  const b = new THREE.Group();
  const s = 0.8 + Math.random() * 0.9; // mixed sizes, a few big ones
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), flat(0x14101c));
  b.add(body);
  const wL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.4), flat(0x14101c));
  wL.position.x = -0.55; b.add(wL);
  const wR = wL.clone(); wR.position.x = 0.55; b.add(wR);
  b.scale.setScalar(s);
  b.userData = { wL, wR, r: 15 + Math.random() * 55, h: 12 + Math.random() * 16,
    sp: 0.25 + Math.random() * 0.55, ph: Math.random() * 9,
    cx: (Math.random() - 0.5) * 80, cz: (Math.random() - 0.5) * 80 };
  scene.add(b); bats.push(b);
}

// ---------- DETAILED GOOFY CHARACTERS (small vs houses) ----------
function eyes(head, y, spread, sL, sR) {
  [[-1, sL], [1, sR]].forEach(([s, sz]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(sz * 1.5, sz * 1.5, 0.1), flat(0xfbf8ef));
    w.position.set(s * spread, y, 0.46); head.add(w);
    const p = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.62, sz * 0.85, 0.06), flat(0x1d1d22));
    p.position.set(s * spread + s * 0.05, y - 0.03, 0.52); head.add(p);
    const glint = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), flat(0xffffff));
    glint.position.set(s * spread + s * 0.02, y + 0.04, 0.56); head.add(glint);
  });
}
function whiskers(head, color = 0xf2efe6) {
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), flat(color));
      w.position.set(s * 0.62, -0.08 + i * 0.1, 0.4);
      w.rotation.z = s * -0.12 * (i - 1);
      head.add(w);
    }
  });
}
function makeCat(color = 0x2b2b31, belly = 0x4a4a52) {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 1.2), flat(color)));
  body.position.y = 0.55; g.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.3), flat(belly));
  chest.position.set(0, 0.45, 0.55); g.add(chest);
  // back stripes
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.1, 0.14), flat(belly));
    st.position.set(0, 0.82, -0.25 + i * 0.3); g.add(st);
  }
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.55); g.add(head);
  head.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.8, 0.8), flat(color))));
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.25), flat(belly));
  muzzle.position.set(0, -0.18, 0.42); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), flat(0xb57a8a));
  nose.position.set(0, -0.1, 0.56); head.add(nose);
  eyes(head, 0.1, 0.24, 0.19, 0.23); // uneven = goofy
  whiskers(head);
  // blush
  [-0.34, 0.34].forEach(x => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.03), flat(0xc98a9a));
    b.position.set(x, -0.12, 0.42); head.add(b);
  });
  [-0.34, 0.34].forEach(x => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.4, 4), flat(color));
    ear.position.set(x, 0.55, 0); head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), flat(0xd9a0a8));
    inner.position.set(x, 0.5, 0.08); head.add(inner);
  });
  // collar + bell: ring around the neck in BODY space so it sits under the chin
  const collar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.13, 1.0), flat(0x8e2f2f));
  collar.position.set(0, 0.72, 0.5); g.add(collar);
  const bell = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), flat(0xd9b64a));
  bell.position.set(0, 0.58, 0.73); g.add(bell);
  // tail with light tip
  const tail = new THREE.Group(); tail.position.set(0, 0.7, -0.6); g.add(tail);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), flat(color));
  t1.position.z = -0.3; tail.add(t1);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.3), flat(belly));
  t2.position.z = -0.75; tail.add(t2);
  tail.rotation.x = -0.55;
  g.userData = { head, tail, legs: [] };
  [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.4], [0.3, -0.4]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), flat(color));
    l.position.set(x, 0.21, z); g.add(l);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.3), flat(belly));
    paw.position.set(x, 0.06, z + 0.03); g.add(paw);
    g.userData.legs.push(l);
  });
  return g;
}
function makeDog(color = 0x9a7448, spot = 0x7a5230) {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 1.6), flat(color)));
  body.position.y = 0.6; g.add(body);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.4, 0.7), flat(spot));
  patch.position.set(0, 0.72, -0.3); g.add(patch);
  const head = new THREE.Group(); head.position.set(0, 1.15, 0.8); g.add(head);
  head.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.8), flat(color))));
  // heavy brow = aloof
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.2), flat(spot));
  brow.position.set(0, 0.32, 0.43); head.add(brow);
  eyes(head, 0.08, 0.22, 0.17, 0.17);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.45), flat(0xd9c39a));
  snout.position.set(0, -0.18, 0.55); head.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.1), flat(0x2b2b31));
  nose.position.set(0, -0.1, 0.8); head.add(nose);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), flat(0xc98a9a));
  tongue.position.set(0.08, -0.48, 0.62); tongue.rotation.z = 0.14; head.add(tongue);
  [-0.52, 0.52].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.18), flat(spot));
    e.position.set(x, 0.1, 0); e.rotation.z = x * 0.55; head.add(e);
  });
  const collar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.13, 0.9), flat(0x4a6b8a));
  collar.position.set(0, 0.95, 0.55); g.add(collar);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.7), flat(color));
  tail.position.set(0, 0.8, -1.05); g.add(tail);
  g.userData = { head, tail, legs: [] };
  [[-0.32, 0.55], [0.32, 0.55], [-0.32, -0.55], [0.32, -0.55]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.24), flat(color));
    l.position.set(x, 0.2, z); g.add(l); g.userData.legs.push(l);
  });
  return g;
}

// ---------- PLAYER ----------
const playerMesh = makeCat(0x2b2b31, 0x55555e);
playerMesh.scale.setScalar(0.9);
scene.add(playerMesh);
const player = { pos: new THREE.Vector3(0, 0, 12), velY: 0, onGround: true, yaw: 0, hp: 5, legT: 0 };

// ---------- NPCS ----------
const npcs = [];
const catDefs = [
  [0xc98a4a, 'Sir Hissalot'], [0xd9d3c5, 'Chairman Meow'],
  [0x8a8a95, 'Stinky Pete'], [0xb57a8a, 'Duchess Fluff'], [0x7fa8b8, 'Baron Puke']
];
catDefs.forEach(([c, name], i) => {
  const m = makeCat(c);
  m.scale.setScalar(0.92);
  const x = (Math.random() * 200 - 100), z = (Math.random() * 200 - 100);
  m.position.set(x, 0, z); scene.add(m);
  npcs.push({ mesh: m, type: 'cat', name, x, z, dir: Math.random() * 6.28, timer: 2, hp: 3, cooldown: 5 + i * 2, phase: Math.random() * 9, flee: 0 });
});
const dogDefs = [[0x8a6240, 'Bark Twain'], [0x5d5d66, 'Chewbarka'], [0xc9b48a, 'Sir Poops']];
dogDefs.forEach(([c, name]) => {
  const m = makeDog(c);
  const x = (Math.random() * 200 - 100), z = (Math.random() * 200 - 100);
  m.position.set(x, 0, z); scene.add(m);
  npcs.push({ mesh: m, type: 'dog', name, x, z, dir: Math.random() * 6.28, timer: 2, hp: 4, cooldown: 8, phase: Math.random() * 9, flee: 0 });
});
// Biscuit hides far NW in the dead grove, away from spawn (0,12)
const biscuitMesh = makeDog(0xc99a4a, 0xa87a34);
biscuitMesh.scale.setScalar(1.15);
biscuitMesh.position.set(-72, 0, 76);
scene.add(biscuitMesh);
const biscuit = { mesh: biscuitMesh, type: 'biscuit', name: 'Biscuit', x: -72, z: 76, dir: 0, timer: 99, hp: 999, cooldown: 9999, phase: 0, flee: 0 };
npcs.push(biscuit);
// faint marker above Biscuit (lost in fog until close)
const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffb154 }));
marker.position.set(-72, 3.4, 76); scene.add(marker);
// Biscuit's den: ring of dead trees + pumpkins so it reads as a hidden spot
tree(-68, 72, 1.3); tree(-76, 72, 1.2); tree(-72, 81, 1.4);

// ---------- BOSS: Gormley, Dumpster King (far SE throne) ----------
(function bossArena() {
  const dumpMat = new THREE.MeshLambertMaterial({ map: pixelTex('#2e4a3e', '#243a30') });
  [[83, -80], [89.5, -80]].forEach(([x, z]) => {
    const d = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 2.4), dumpMat));
    d.position.set(x, 1.25, z); scene.add(d);
    solid(x, z, 3.2, 2.4, 2.5);
  });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.6), flat(0x1e2e26));
  lid.position.set(83, 2.65, -80); lid.rotation.z = 0.08; scene.add(lid);
  for (let i = 0; i < 8; i++) { // scattered trash
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 0.5, 0.4, 0.5), flat(0x5a5a62));
    tr.position.set(80 + Math.random() * 13, 0.2, -76 + Math.random() * 5);
    tr.rotation.y = Math.random() * 3; scene.add(tr);
  }
  pumpkin(80, -74); pumpkin(93, -74);
})();
const bossMesh = makeCat(0x3a3a44, 0x55555e);
bossMesh.scale.setScalar(1.8);
(function crownAndScar() {
  const scar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), flat(0x8e2f2f));
  scar.position.set(-0.16, 0.14, 0.42); scar.rotation.z = 0.45;
  bossMesh.userData.head.add(scar);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 5), flat(0xd9b64a));
  crown.position.set(0, 0.58, 0); bossMesh.userData.head.add(crown);
  const gem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), flat(0x8e2f45));
  gem.position.set(0, 0.55, 0.26); bossMesh.userData.head.add(gem);
})();
bossMesh.position.set(86.2, 0, -76);
scene.add(bossMesh);
const bossNpc = { mesh: bossMesh, type: 'cat', name: 'Gormley, Dumpster King',
  x: 86.2, z: -76, home: { x: 86.2, z: -78 }, dir: 0, timer: 2, hp: 12,
  cooldown: 0, phase: 1, flee: 0, boss: true, beaten: false,
  atkInt: 2.2, dmg: 2, baseScale: 1.8 };
npcs.push(bossNpc);

// ---------- MICE: skittish snacks (sneak with Shift, pounce with F) ----------
function makeMouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.6), flat(0x8a8a95));
  body.position.y = 0.2; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.3), flat(0x8a8a95));
  head.position.set(0, 0.24, 0.4); g.add(head);
  [-0.11, 0.11].forEach(x => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.05), flat(0xd9a0a8));
    ear.position.set(x, 0.4, 0.35); g.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), flat(0xd9a0a8));
  tail.position.set(0, 0.18, -0.55); g.add(tail);
  [-0.08, 0.08].forEach(x => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), flat(0x111111));
    eye.position.set(x, 0.28, 0.56); g.add(eye);
  });
  return g;
}
const mice = [];
for (let i = 0; i < 6; i++) {
  const m = makeMouse();
  const [x, z] = freeSpot();
  m.position.set(x, 0, z); scene.add(m);
  mice.push({ mesh: m, x, z, dir: Math.random() * 6.28, timer: 1, phase: Math.random() * 9,
    sq: Math.random() * 2, rs: Math.random() * 2, caught: 0 });
}
function tryPounce() {
  if (fight || !letterWrap.classList.contains('hidden')) return;
  let best = null, bd = 3.4;
  for (const m of mice) {
    if (m.caught > 0) continue;
    const d = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
    if (d < bd) { bd = d; best = m; }
  }
  if (!best) return;
  player.yaw = Math.atan2(best.x - player.pos.x, best.z - player.pos.z);
  pawSwing();
  slapSnd();
  setTimeout(() => {
    if (best.caught > 0 || fight) return;
    const d = Math.hypot(player.pos.x - best.x, player.pos.z - best.z);
    if (d < 2.9) {
      best.caught = 9; best.mesh.visible = false;
      squeak(0.2);
      player.hp = Math.min(5, player.hp + 1); miceCaught++;
      toast('Caught a mouse! +1 health (' + miceCaught + ' caught)');
      updateHUD();
    }
  }, 130);
}

// ---------- COLLECTIBLES ----------
function freeSpot() {
  for (let t = 0; t < 90; t++) {
    const x = Math.random() * 240 - 120, z = Math.random() * 240 - 120;
    if (Math.hypot(x, z) < 10) continue;
    if (Math.abs(x) < 7 || Math.abs(z) < 7) continue;
    let bad = false;
    for (const c of colliders) if (x > c.minX - 2.5 && x < c.maxX + 2.5 && z > c.minZ - 2.5 && z < c.maxZ + 2.5) { bad = true; break; }
    if (!bad) return [x, z];
  }
  return [Math.random() * 180 - 90, Math.random() * 180 - 90];
}
const pickups = [];
for (let i = 0; i < 10; i++) {
  const [x, z] = freeSpot();
  const g = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), flat(0x6b5138));
  soil.position.y = 0.12; g.add(soil);
  for (let k = 0; k < 5; k++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 5), flat(k % 2 ? 0x4d7a4d : 0x5d8a5f));
    leaf.position.set((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8);
    leaf.rotation.z = (Math.random() - 0.5) * 0.5;
    g.add(leaf);
  }
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), flat(0xd9e8a8));
  glow.position.y = 1.0; g.add(glow);
  g.position.set(x, 0, z); scene.add(g);
  pickups.push({ mesh: g, glow, kind: 'catnip', x, z, taken: false });
}
for (let i = 0; i < 10; i++) {
  const [x, z] = freeSpot();
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.18, 10), flat(0xe8e2cc));
  plate.position.y = 0.1; g.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.34, 0.36), flat(0x7fa8b8));
  body.position.y = 0.45; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.38), flat(0x5b7fa6));
  stripe.position.set(0.1, 0.45, 0); g.add(stripe);
  const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), flat(0x5b7fa6));
  tailF.rotation.z = -Math.PI / 2; tailF.position.set(-0.65, 0.45, 0); g.add(tailF);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), flat(0x1d1d22));
  eye.position.set(0.3, 0.52, 0.19); g.add(eye);
  g.position.set(x, 0, z); scene.add(g);
  pickups.push({ mesh: g, kind: 'tuna', x, z, taken: false });
}
// Golden tuna on Gormley's throne (worth 3, guarded until he falls)
(function goldenTuna() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.2, 10), flat(0x3a3a42));
  plate.position.y = 0.1; g.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  body.position.y = 0.55; g.add(body);
  const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xd9a04a }));
  tailF.rotation.z = -Math.PI / 2; tailF.position.set(-0.9, 0.55, 0); g.add(tailF);
  g.position.set(86.2, 2.5, -80); scene.add(g);
  pickups.push({ mesh: g, kind: 'goldtuna', x: 86.2, z: -80, taken: false, guardedBy: bossNpc });
})();

// ---------- SNIFF MODE (hold the trail: press T) ----------
let sniffing = false, sniffT = 0;
const sniffPuffs = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xa8e6a1, transparent: true, opacity: 0 }));
  m.visible = false; scene.add(m);
  sniffPuffs.push({ mesh: m, life: 0 });
}
function sniffTarget() {
  let best = null, bd = 1e9;
  for (const p of pickups) {
    if (p.taken) continue;
    const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
    if (d < bd) bd = d, best = { x: p.x, z: p.z, label: p.kind === 'goldtuna' ? 'golden tuna' : p.kind, d };
  }
  if (best) return best;
  if (!letterRead) {
    const d = Math.hypot(player.pos.x - biscuit.x, player.pos.z - biscuit.z);
    return { x: biscuit.x, z: biscuit.z, label: 'the sealed letter', d };
  }
  if (bossNpc && !bossNpc.beaten) {
    const d = Math.hypot(player.pos.x - bossNpc.x, player.pos.z - bossNpc.z);
    return { x: bossNpc.x, z: bossNpc.z, label: 'Gormley', d };
  }
  return null;
}
function compass(dx, dz) {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = Math.atan2(dx, -dz);
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
function toggleSniff() {
  sniffing = !sniffing;
  if (sniffing) {
    const tgt = sniffTarget();
    if (tgt) toast('Sniffing: ' + tgt.label + ', about ' + Math.round(tgt.d) + 'm ' + compass(tgt.x - player.pos.x, tgt.z - player.pos.z) + '. Follow the green wisps.');
    else { toast('Nothing left to sniff. Nap time.'); sniffing = false; }
  }
}

// ---------- INPUT / CAMERA ----------
const keys = {};
let camYaw = 0, camPitch = 0.32, locked = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyM') { meow(0.7 + Math.random() * 0.3); fightHit('meow'); }
  if (e.code === 'KeyF') { if (fight) fightHit('slap'); else tryPounce(); }
  if (e.code === 'KeyT') toggleSniff();
  if (e.code === 'KeyE') interact();
  if (['Space', 'ArrowUp'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousemove', e => {
  if (!locked) return;
  camYaw -= e.movementX * 0.0024;
  camPitch += e.movementY * 0.002;
  camPitch = Math.max(-0.35, Math.min(1.0, camPitch));
});
renderer.domElement.addEventListener('click', () => {
  audio(); startMusic();
  renderer.domElement.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  document.getElementById('prompt').style.display = locked ? 'none' : 'block';
});
document.getElementById('play').onclick = () => {
  try {
    document.getElementById('start').classList.add('hidden');
    audio(); startMusic(); meow(0.8);
    renderer.domElement.requestPointerLock?.();
    toast('Find 10 catnip and 10 tuna. Biscuit hides far from the square — follow the pumpkins.');
  } catch (err) {
    const box = document.getElementById('err');
    if (box) {
      box.classList.remove('hidden');
      box.textContent = 'Could not start audio/graphics: ' + (err && err.message ? err.message : err);
    }
  }
};
function openSealed() {
  document.getElementById('sealed').classList.add('hidden');
  document.getElementById('letter').classList.remove('hidden');
  letterRead = true;
  chip(523, 0.3, 'sine', 0.1); chip(784, 0.4, 'sine', 0.08, 0.1);
}
document.getElementById('wax').onclick = (e) => { e.stopPropagation(); openSealed(); };
document.getElementById('close-letter').onclick = () => {
  letterWrap.classList.add('hidden');
  document.getElementById('letter').classList.add('hidden');
  document.getElementById('sealed').classList.remove('hidden');
  renderer.domElement.requestPointerLock?.();
};
// Master volume slider (HUD). Applies live; stored default 70%.
const volSlider = document.getElementById('vol');
const volVal = document.getElementById('volval');
if (volSlider) volSlider.addEventListener('input', () => {
  volume = volSlider.value / 100;
  if (volVal) volVal.textContent = volSlider.value;
  if (masterBus) masterBus.gain.value = volume;
});

// ---------- COLLISION ----------
function supportHeight(x, z, feetY) {
  let s = 0;
  for (const c of colliders) {
    if (x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) {
      if (c.top <= feetY + 0.7 && c.top > s) s = c.top;
    }
  }
  return s;
}
function pushOut(p) {
  for (const c of colliders) {
    if (p.x > c.minX - 0.45 && p.x < c.maxX + 0.45 && p.z > c.minZ - 0.45 && p.z < c.maxZ + 0.45) {
      if (p.y < c.top - 0.4 && p.y > -0.5) {
        const dx1 = p.x - (c.minX - 0.45), dx2 = (c.maxX + 0.45) - p.x;
        const dz1 = p.z - (c.minZ - 0.45), dz2 = (c.maxZ + 0.45) - p.z;
        const m = Math.min(dx1, dx2, dz1, dz2);
        if (m === dx1) p.x = c.minX - 0.45;
        else if (m === dx2) p.x = c.maxX + 0.45;
        else if (m === dz1) p.z = c.minZ - 0.45;
        else p.z = c.maxZ + 0.45;
      }
    }
  }
}

// ---------- FIGHTS (longer, taunting, paw-animated) ----------
const CAT_TAUNTS = [
  ['MREEE-OW!', 'your whiskers are crooked, peasant'],
  ['Mew. Mew MEW!', 'I knocked your tuna off the table in a past life'],
  ['HISSSS!', 'this alley has a dress code and you fail it'],
  ['Mrrp?!', 'my human reads my mind and she says: no'],
  ['MEOW meow mrow!', 'I was napping, this is now a crime scene'],
  ['Prrp. Mreow.', 'nice tail. shame if someone sat on it']
];
const DOG_TAUNTS = [
  ['WOOF WOOF!', 'your scent offends this entire street'],
  ['GRRR-WOOF!', 'I buried better cats than you'],
  ['BARK! Bark bark!', 'the moon told me your secrets and yikes'],
  ['ARF?!', 'sit? you sit. I am the captain now'],
  ['WOOF.', 'professionally speaking: hiss']
];
const BOSS_TAUNTS = [
  ['MRRR-AAAW!', 'I eat alley cats for breakfast. you look like breakfast'],
  ['HISSS-KRA!', 'this dumpster is MY castle. pay the tuna toll'],
  ['Mrow. MROW!', 'nine lives. I spent three on bigger fools than you'],
  ['GRRREOW!', 'run home, kitten. the fog keeps what it catches']
];
let fight = null, fightLunge = 0, shake = 0;
const pawEl = document.getElementById('paw');
const tauntEl = document.getElementById('taunt');
const tauntCry = document.getElementById('taunt-cry');
const tauntTr = document.getElementById('taunt-tr');
function showTaunt(cry, tr, ms = 2300) {
  tauntCry.textContent = cry;
  tauntTr.textContent = '(translation: ' + tr + ')';
  tauntEl.classList.remove('hidden');
  clearTimeout(showTaunt._t);
  showTaunt._t = setTimeout(() => tauntEl.classList.add('hidden'), ms);
}
function pawSwing() {
  pawEl.classList.remove('hidden', 'swipe', 'hitflash');
  void pawEl.offsetWidth;
  pawEl.classList.add('swipe');
  setTimeout(() => pawEl.classList.add('hitflash'), 90);
  setTimeout(() => pawEl.classList.add('hidden'), 320);
  fightLunge = 0.32; // 3D lunge timer, read in animate
  shake = 0.22;       // camera shake timer
}
function startFight(npc) {
  const isMeow = npc.type === 'cat' && !npc.boss && Math.random() < 0.4;
  const maxPhp = 5, maxEhp = npc.boss ? 12 : (npc.type === 'dog' ? 8 : 7);
  fight = { npc, kind: isMeow ? 'meow' : 'slap', php: maxPhp, ehp: maxEhp, maxPhp, maxEhp, tauntT: 1.2,
    atkInt: npc.atkInt || 1.8, dmg: npc.dmg || 1, enraged: false };
  fightEl.classList.remove('hidden');
  enemyNameEl.textContent = npc.name;
  fightTitle.textContent = npc.boss ? 'Boss: Dumpster King' : (isMeow ? 'Meow-off' : (npc.type === 'dog' ? 'Bark dispute' : 'Paw fight'));
  fightSub.textContent = npc.boss ? 'Spam F — watch his heavy swipes' : (isMeow ? 'Spam M to out-meow (long bout)' : 'Spam F or click to slap (long bout)');
  const pool = npc.boss ? BOSS_TAUNTS : (npc.type === 'dog' ? DOG_TAUNTS : CAT_TAUNTS);
  const [cry, tr] = pool[Math.floor(Math.random() * pool.length)];
  if (npc.boss) { bark(0.5); hiss(); } else if (npc.type === 'cat') hiss(); else bark();
  showTaunt(cry, tr + ' — ' + npc.name + ' wants to argue');
  updateFightUI();
}
function updateFightUI() {
  if (!fight) return;
  phpEl.style.width = (fight.php / fight.maxPhp * 100) + '%';
  ehpEl.style.width = (fight.ehp / fight.maxEhp * 100) + '%';
}
function fightHit(kind) {
  if (!fight) return;
  if (fight.kind === 'meow' && kind !== 'meow') return;
  if (fight.kind === 'slap' && kind !== 'slap') return;
  fight.ehp -= 1;
  slapSnd();
  pawSwing();
  if (fight.kind === 'meow') meow(0.8 + Math.random() * 0.25);
  fight.npc.x += (fight.npc.x - player.pos.x) * 0.12;
  fight.npc.z += (fight.npc.z - player.pos.z) * 0.12;
  fight.npc.squash = 0.3;
  updateFightUI();
  if (fight.ehp <= 0) endFight(true);
}
addEventListener('mousedown', () => { if (fight && locked) fightHit('slap'); });
let enemyTick = 0;
function enemyTaunt() {
  const npc = fight.npc;
  const pool = npc.boss ? BOSS_TAUNTS : (npc.type === 'dog' ? DOG_TAUNTS : CAT_TAUNTS);
  const [cry, tr] = pool[Math.floor(Math.random() * pool.length)];
  if (npc.boss) { bark(0.5); hiss(); }
  else if (npc.type === 'cat') { if (fight.kind === 'meow') meow(0.65 + Math.random() * 0.3); else hiss(); }
  else bark(0.85 + Math.random() * 0.4);
  npc.squash = 0.35;
  showTaunt(cry, tr);
}
function endFight(won) {
  const npc = fight.npc;
  fightEl.classList.add('hidden');
  tauntEl.classList.add('hidden');
  if (won) {
    if (npc.boss) {
      npc.beaten = true;
      player.hp = 5;
      toast('Gormley is dethroned! The golden tuna is yours.');
      pickupSnd();
      showTaunt('mrrrow...', 'take the shiny fish. this is not over. it is over.');
      npc.flee = 10; npc.cooldown = 60;
    } else {
      toast('You settled it with ' + npc.name + '.');
      pickupSnd();
      showTaunt(npc.type === 'dog' ? 'whine...' : 'mrrp...', 'fine. you win this round. I live here though.');
      npc.flee = 6; npc.cooldown = 25;
    }
  } else {
    toast(npc.name + ' got the better of you. Walk it off.');
    player.hp = 5;
    npc.cooldown = 12;
    player.pos.x += (player.pos.x - npc.x) * 0.4;
    player.pos.z += (player.pos.z - npc.z) * 0.4;
  }
  fight = null;
  updateHUD();
}

function interact() {
  if (Math.hypot(player.pos.x - biscuit.x, player.pos.z - biscuit.z) < 5.5) {
    letterWrap.classList.remove('hidden');
    document.getElementById('sealed').classList.remove('hidden');
    document.getElementById('letter').classList.add('hidden');
    document.exitPointerLock?.();
    bark(1.3);
    toast('Biscuit has a sealed letter. Click the heart seal.');
    return;
  }
  for (const p of pickups) {
    if (!p.taken && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 3) {
      collect(p); break;
    }
  }
}
function collect(p) {
  if (p.guardedBy && !p.guardedBy.beaten) {
    if (!p.warned) {
      p.warned = true;
      toast('Gormley guards the golden tuna. Beat him first.');
      setTimeout(() => p.warned = false, 3500);
    }
    return;
  }
  p.taken = true; scene.remove(p.mesh);
  pickupSnd();
  if (p.kind === 'catnip') { catnip++; toast('Catnip found: ' + catnip + ' of 10'); }
  else if (p.kind === 'goldtuna') {
    tuna = Math.min(10, tuna + 3); player.hp = 5;
    toast('GOLDEN TUNA! Counts as 3, health fully restored (' + tuna + ' of 10)');
  }
  else {
    tuna++;
    let heal = '';
    if (player.hp < 5) { player.hp++; heal = ', +1 health'; }
    toast('Tuna found: ' + tuna + ' of 10' + heal);
  }
  updateHUD();
}

// ---------- LOOP ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  let ix = 0, iz = 0;
  if (keys.KeyW) iz += 1;
  if (keys.KeyS) iz -= 1;
  if (keys.KeyA) ix -= 1;
  if (keys.KeyD) ix += 1;
  const letterOpen = !letterWrap.classList.contains('hidden');
  const moving = (ix !== 0 || iz !== 0) && !letterOpen;
  const sneaking = !!(keys.ShiftLeft || keys.ShiftRight);
  const speed = sneaking ? 3.2 : 9; // tiptoe: mice notice you much later
  {
    const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
    const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
    const mx = rightX * ix + fwdX * iz;
    const mz = rightZ * ix + fwdZ * iz;
    const l = Math.hypot(mx, mz) || 1;
    if (moving) {
      player.pos.x += mx / l * speed * dt;
      player.pos.z += mz / l * speed * dt;
      player.pos.x = Math.max(-WORLD_R, Math.min(WORLD_R, player.pos.x));
      player.pos.z = Math.max(-WORLD_R, Math.min(WORLD_R, player.pos.z));
      player.yaw = Math.atan2(mx, mz);
      player.legT += dt * 11;
    }
  }
  pushOut(player.pos);
  player.velY -= 26 * dt;
  player.pos.y += player.velY * dt;
  const sup = supportHeight(player.pos.x, player.pos.z, player.pos.y);
  if (player.pos.y <= sup) {
    player.pos.y = sup; player.velY = 0; player.onGround = true;
  } else player.onGround = player.pos.y <= 0.01;
  if (keys.Space && player.onGround && !letterOpen) { player.velY = 12; player.onGround = false; }
  if (player.pos.y < 0) { player.pos.y = 0; player.velY = 0; player.onGround = true; }

  // slap lunge: player hops toward rival right after F
  if (fightLunge > 0) fightLunge -= dt;
  if (shake > 0) shake -= dt;
  const lungeK = fightLunge > 0 ? Math.sin((fightLunge / 0.32) * Math.PI) : 0;

  playerMesh.position.copy(player.pos);
  playerMesh.rotation.y = player.yaw;
  playerMesh.position.y += moving ? Math.abs(Math.sin(player.legT)) * 0.07 : Math.sin(t * 3) * 0.025;
  playerMesh.userData.tail.rotation.y = Math.sin(t * 5) * 0.45;
  playerMesh.userData.head.rotation.z = Math.sin(t * 2.2) * 0.07;
  playerMesh.userData.head.rotation.y = Math.sin(t * 1.3) * 0.1;
  playerMesh.userData.legs.forEach((leg, i) => leg.position.y = 0.21 + (moving ? Math.sin(player.legT + i * 1.7) * 0.1 : 0));
  if (fight && lungeK > 0) { // lean into the slap
    playerMesh.position.x += (fight.npc.x - player.pos.x) * 0.12 * lungeK;
    playerMesh.position.z += (fight.npc.z - player.pos.z) * 0.12 * lungeK;
    playerMesh.userData.head.rotation.x = -0.4 * lungeK;
  }

  const dist = 9.5, h = 3.6 + camPitch * 4.5;
  const cx = player.pos.x + Math.sin(camYaw) * dist;
  const cz = player.pos.z + Math.cos(camYaw) * dist;
  camera.position.set(cx + (shake > 0 ? (Math.random() - 0.5) * 0.5 : 0), player.pos.y + h, cz + (shake > 0 ? (Math.random() - 0.5) * 0.5 : 0));
  camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);

  for (const n of npcs) {
    if (n === biscuit) {
      n.mesh.position.set(n.x, 0, n.z);
      n.mesh.scale.setScalar(1.15 + Math.sin(t * 4.2) * 0.045);
      n.mesh.rotation.z = Math.sin(t * 3.2) * 0.07;
      n.mesh.rotation.y = Math.sin(t * 0.5) * 0.5 + 2.4;
      n.mesh.userData.tail.rotation.x = Math.sin(t * 8) * 0.5;
      marker.position.set(n.x, 3.6 + Math.sin(t * 2.5) * 0.25, n.z);
      marker.rotation.y = t * 1.4;
      continue;
    }
    n.cooldown -= dt;
    if (n.flee > 0) {
      n.flee -= dt;
      const dx = n.x - player.pos.x, dz = n.z - player.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      n.x += dx / l * 7 * dt; n.z += dz / l * 7 * dt;
    } else if (!fight || fight.npc !== n) {
      n.timer -= dt;
      if (n.timer <= 0) { n.timer = 2 + Math.random() * 3; n.dir = Math.random() * 6.28; }
      if (n.boss && n.home) { // leashed to his dumpster throne
        const hx = n.home.x - n.x, hz = n.home.z - n.z;
        if (Math.hypot(hx, hz) > 14) n.dir = Math.atan2(hx, hz);
      }
      n.x += Math.sin(n.dir) * 2.1 * dt;
      n.z += Math.cos(n.dir) * 2.1 * dt;
      if (Math.abs(n.x) > WORLD_R - 5 || Math.abs(n.z) > WORLD_R - 5) n.dir += Math.PI;
    } else {
      n.dir = Math.atan2(player.pos.x - n.x, player.pos.z - n.z);
    }
    n.mesh.position.x = n.x; n.mesh.position.z = n.z;
    n.mesh.rotation.y = n.dir;
    n.mesh.position.y = Math.abs(Math.sin(t * 6 + n.phase)) * 0.05;
    n.mesh.rotation.z = Math.sin(t * 3.6 + n.phase) * 0.05;
    n.mesh.userData.tail.rotation.y = Math.sin(t * 6 + n.phase) * 0.45;
    if (n.squash > 0) { // bonk recoil
      n.squash -= dt;
      const k = Math.max(0, n.squash) * 2.2;
      n.mesh.scale.set(1 + k * 0.35, 1 - k * 0.3, 1 + k * 0.35);
    } else n.mesh.scale.setScalar(n.baseScale || (n.type === 'dog' ? 1 : 0.92));
    const d = Math.hypot(player.pos.x - n.x, player.pos.z - n.z);
    if (!fight && n.flee <= 0 && n.cooldown <= 0 && d < 3.0 && !letterOpen) startFight(n);
  }
  if (fight) {
    enemyTick += dt;
    fight.tauntT -= dt;
    if (fight.tauntT <= 0) { // mid-bout trash talk, no damage
      fight.tauntT = 3.2 + Math.random() * 2;
      enemyTaunt();
    }
    // boss enrages at half health: faster, meaner
    if (fight.npc.boss && !fight.enraged && fight.ehp <= fight.maxEhp / 2) {
      fight.enraged = true;
      fight.atkInt = 1.25;
      showTaunt('GRRREOW!!!', 'oh. OH. now it is personal.');
      bark(0.45); hiss();
      shake = 0.3;
    }
    if (enemyTick > fight.atkInt) { // slower, heavier exchanges
      enemyTick = 0;
      fight.php -= fight.dmg; hurtSnd(); updateFightUI();
      player.hp = Math.max(0, fight.php);
      updateHUD();
      fight.npc.squash = 0.35;
      shake = 0.18;
      enemyTaunt();
      if (fight.php <= 0) endFight(false);
    }
  }

  // --- mice: wander, flee loud cats, squeak/rustle as audio radar ---
  for (const m of mice) {
    if (m.caught > 0) {
      m.caught -= dt;
      if (m.caught <= 0) {
        const [nx, nz] = freeSpot();
        m.x = nx; m.z = nz; m.mesh.visible = true;
      }
      continue;
    }
    const dp = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
    const fleeR = sneaking ? 2.5 : 7;
    m.timer -= dt;
    if (dp < fleeR && moving) { m.dir = Math.atan2(m.x - player.pos.x, m.z - player.pos.z); m.timer = 0.5; }
    else if (m.timer <= 0) { m.timer = 1 + Math.random() * 2.5; m.dir = Math.random() * 6.28; }
    const scamper = dp < fleeR ? 6 : 2.5 + Math.sin(t * 3 + m.phase) * 1.2;
    m.x += Math.sin(m.dir) * Math.max(0.5, scamper) * dt;
    m.z += Math.cos(m.dir) * Math.max(0.5, scamper) * dt;
    if (Math.abs(m.x) > WORLD_R - 3 || Math.abs(m.z) > WORLD_R - 3) m.dir += Math.PI;
    m.mesh.position.set(m.x, Math.abs(Math.sin(t * 9 + m.phase)) * 0.14, m.z);
    m.mesh.rotation.y = m.dir;
    m.sq -= dt;
    if (dp < 11 && m.sq <= 0) {
      squeak(Math.min(0.2, Math.max(0.02, 0.14 * (1 - dp / 11)) * (sniffing ? 1.5 : 1)));
      m.sq = 0.5 + dp * 0.3 + Math.random();
    }
    m.rs -= dt;
    if (dp < 14 && m.rs <= 0) {
      noiseBurst(0.09, 'lowpass', 700, Math.max(0.02, 0.1 * (1 - dp / 14)));
      m.rs = 0.8 + Math.random();
    }
  }

  // --- sniff wisps drift toward the current objective ---
  if (sniffing && !letterOpen) {
    const tgt = sniffTarget();
    if (!tgt) { toast('Nothing left to sniff. Nap time.'); sniffing = false; }
    else {
      sniffT -= dt;
      if (sniffT <= 0) {
        sniffT = 0.3;
        const dx = tgt.x - player.pos.x, dz = tgt.z - player.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        const puff = sniffPuffs.find(p => p.life <= 0);
        if (puff && tgt.d > 4) {
          puff.life = 1.1;
          puff.mesh.visible = true;
          puff.mesh.position.set(
            player.pos.x + dx / l * 2.5 + (Math.random() - 0.5),
            player.pos.y + 0.9, player.pos.z + dz / l * 2.5 + (Math.random() - 0.5));
          puff.mesh.material.opacity = 0.7;
        }
      }
    }
  }
  for (const p of sniffPuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.y += dt * 0.8;
    p.mesh.material.opacity = Math.max(0, p.life * 0.6);
    if (p.life <= 0) p.mesh.visible = false;
  }

  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y = t * 1.4;
    p.mesh.position.y = Math.sin(t * 2.4 + p.x) * 0.15;
    if (p.glow) p.glow.rotation.y = -t * 2;
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 2.1 && Math.abs(player.pos.y) < 3) collect(p);
  }
  clouds.forEach((c, i) => { c.position.x += dt * (0.5 + i * 0.08); if (c.position.x > 160) c.position.x = -160; });
  bats.forEach((b) => {
    const u = b.userData;
    const a = t * u.sp + u.ph;
    b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 1.7 + u.ph) * 1.5, u.cz + Math.sin(a) * u.r);
    b.rotation.y = -a;
    const flap = Math.sin(t * 14 + u.ph) * 0.6;
    u.wL.rotation.z = flap; u.wR.rotation.z = -flap;
  });
  pumpkinGlows.forEach((l, i) => { l.intensity = 0.85 + Math.sin(t * 7 + i * 2.1) * 0.15; });
  warm.intensity = 1.0 + Math.sin(t * 2.3) * 0.1;

  renderer.render(scene, camera);
}
updateHUD();
animate();
window.__gameBooted = true;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
