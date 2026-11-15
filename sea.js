'use strict';

function saveProg() { try { localStorage.setItem('ile-prog1', JSON.stringify({ fishLog: G.fishLog, up: G.up, hasRod: !!G.hasRod, FR })); } catch (_) { } }
function loadProg() { try { const d = JSON.parse(localStorage.getItem('ile-prog1') || 'null'); if (!d) return; G.fishLog = d.fishLog || {}; G.up = d.up || {}; G.hasRod = d.hasRod; for (const k in d.FR) if (FR[k] !== undefined || k === 'fish') FR[k] = d.FR[k]; } catch (_) { } }
/* ============ la mer : voilier, pêche, scaphandre, vie sous-marine ============ */
const BOAT = { pos: new V3(), yaw: 0, speed: 0, sail: 0, sailK: 0, steer: 0, heel: 0, camYaw: 0, camPitch: 0.28, roll: 0, pitch: 0, bump: 0 };
const _bv = new V3(), _bw = new V3();
const HOSE = () => (G.up && G.up.suit ? 120 : 60);

/* ---------- le voilier ---------- */
function hullGeo(L = 6.4, W = 1.3, D = 1.0, cols) {
  const g = new GB(), NS = 18, NJ = 10, secs = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, z = lerp(L * 0.47, -L * 0.53, t); // de la poupe (+z) à la proue (-z)
    const w = W * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, (t - 0.42) / 0.58), 2.2)), 0.6) * (t < 0.08 ? 0.86 + t * 1.7 : 1), top = 0.85 + 0.45 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2), d = D * (0.75 + 0.25 * Math.sin(t * Math.PI));
    const ring = []; for (let j = 0; j <= NJ; j++) { const a = -Math.PI / 2 + Math.PI * j / NJ; ring.push(new V3(Math.sin(a) * Math.max(w, 0.02), top - d * Math.cos(a) * (1 - 0.15 * Math.abs(Math.sin(a))), z)); }
    secs.push(ring);
  }
  const cL = (p, hi) => lin(p.y < 0.18 ? cols[0] : p.y < (hi - 0.18) ? cols[1] : cols[2]);
  for (let i = 0; i < NS; i++) for (let j = 0; j < NJ; j++) {
    const a = secs[i][j], b = secs[i + 1][j], c = secs[i + 1][j + 1], d = secs[i][j + 1];
    const hi = secs[i][0].y;
    g.tri(a, b, c, cL(a, hi), cL(b, hi), cL(c, hi)); g.tri(a, c, d, cL(a, hi), cL(c, hi), cL(d, hi));
  }
  const tr = secs[0], cz = new V3(0, 0.5, tr[0].z); for (let j = 0; j < NJ; j++) g.tri(cz, tr[j + 1], tr[j], lin(cols[1]), lin(cols[1]), lin(cols[1])); // tableau arrière
  return { g, secs };
}
function sailGeo(N = 10, Mh = 12) { // voile carrée façon Wind Waker, emblème peint
  const geo = new THREE.BufferGeometry(), pos = [], col = [], idx = [], uv = [], W = 3.3, Hh = 4.6;
  for (let j = 0; j <= Mh; j++) for (let i = 0; i <= N; i++) {
    const u = i / N, v = j / Mh; pos.push(0, v * Hh, u * W * (1 - v * 0.12)); uv.push(u, v);
    const cu = u - 0.5, cv = v - 0.55, r = Math.hypot(cu * 1.1, cv * 1.25); let c = [0.95, 0.9, 0.78];
    if (Math.abs(r - 0.25) < 0.035 || (r < 0.17 && Math.abs(cu) < 0.04) || (r < 0.17 && Math.abs(cv + 0.02) < 0.04 && cu > -0.15)) c = [0.72, 0.16, 0.13];
    if (v < 0.08 || v > 0.94) c = [0.8, 0.3, 0.2];
    col.push(...c.map(x => Math.pow(x, 2.2)));
  }
  for (let j = 0; j < Mh; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  geo.userData = { N, Mh, W, Hh, uv }; return geo;
}
function helmetGeo() { // casque de scaphandre en laiton
  const g = new GB();
  g.add(SPH, '#c9a24a', M(0, 0.32, 0, 0.3, 0.3, 0.3), 0.35, 0.03);
  g.add(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 20), '#a8823a', M(0, 0.05, 0), 0.3);
  g.add(new THREE.TorusGeometry(0.13, 0.03, 8, 20), '#e2c46a', M(0, 0.32, 0.27), 0.2); g.add(new THREE.CircleGeometry(0.12, 20), '#2a4a55', M(0, 0.32, 0.285), 0);
  for (const sx of [-1, 1]) { g.add(new THREE.TorusGeometry(0.075, 0.022, 6, 14), '#e2c46a', M(sx * 0.27, 0.32, 0.05, 1, 1, 1, 0, sx * 1.57, 0), 0.2); g.add(new THREE.CircleGeometry(0.065, 14), '#2a4a55', M(sx * 0.29, 0.32, 0.05, 1, 1, 1, 0, sx * 1.57, 0), 0); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.add(SPHL, '#8a6a2a', M(Math.cos(a) * 0.36, 0.1, Math.sin(a) * 0.36, 0.018), 0.2); }
  g.add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), '#a8823a', M(0.12, 0.6, -0.08, 1, 1, 1, 0.5, 0, 0), 0.2);
  return g.build();
}
function buildBoat(o = {}) {
  const grp = new THREE.Group(), bm = mat({ ds: true, grain: 2.2, ga: 0.25 });
  const { g, secs } = hullGeo(6.4, 1.3, 1.0, o.cols || ['#7a2a24', '#2f7a86', '#a8794a']);
  // pont, bancs, mât, gouvernail
  for (let i = 0; i < 16; i++) { const z = 2.6 - i * 0.32, s = secs[Math.round(clamp((2.98 - z) / 6.4 * 18, 0, 18))], w = Math.max(0.1, s[0].x === undefined ? 1 : Math.abs(s[0].x)) * 0.92; if (w > 0.2) g.add(new THREE.BoxGeometry(w * 2, 0.06, 0.3), i % 2 ? '#b08452' : '#a07848', M(0, 0.55, z), 0.1, 0.06); }
  g.add(new THREE.BoxGeometry(2.0, 0.08, 0.32), '#8a6038', M(0, 0.85, 1.4), 0.2); g.add(new THREE.BoxGeometry(1.6, 0.08, 0.32), '#8a6038', M(0, 0.85, -1.2), 0.2);
  limb(g, new V3(0, 0.5, -0.6), new V3(0, 7.2, -0.6), 0.09, 0.06, '#7a5432', 8, 0.08);
  limb(g, new V3(0, 0.9, 3.05), new V3(0, -0.6, 3.25), 0.05, 0.05, '#6a4426', 5, 0); g.add(new THREE.BoxGeometry(0.06, 0.8, 0.5), '#6a4426', M(0, -0.3, 3.35), 0.2);
  limb(g, new V3(0, 0.95, 3.1), new V3(0, 1.0, 2.2), 0.03, 0.03, '#8a6038', 5, 0); // barre
  if (!o.noSuit) { const cr = new GB(); g.add(new THREE.BoxGeometry(0.7, 0.5, 0.6), '#9a7048', M(0.45, 0.82, 2.0), 0.2, 0.1); }
  if (o.lamp !== false) lampGlass(g, -0.95, 1.4, 2.6, 0.9);
  for (let k = 0; k < 4; k++) { limb(g, new V3(1.15, 0.9 - k * 0.22, 0.4), new V3(1.32, 0.9 - k * 0.22, 0.4), 0.02, 0.02, '#8a6038', 4, 0); } // échelle
  limb(g, new V3(1.3, 1.0, 0.25), new V3(1.36, -0.2, 0.25), 0.025, 0.025, '#8a6038', 4, 0); limb(g, new V3(1.3, 1.0, 0.55), new V3(1.36, -0.2, 0.55), 0.025, 0.025, '#8a6038', 4, 0);
  const hull = new THREE.Mesh(g.build(), bm); hull.castShadow = hull.receiveShadow = true; grp.add(hull);
  // bôme + voile
  const boom = new THREE.Group(); boom.position.set(0, 1.55, -0.6); grp.add(boom);
  { const bg = new GB(); limb(bg, new V3(0, 0, 0), new V3(0, 0, 3.4), 0.05, 0.05, '#7a5432', 6, 0); limb(bg, new V3(0, 4.75, 0), new V3(0, 4.6, 2.95), 0.04, 0.04, '#7a5432', 6, 0); const bmesh = new THREE.Mesh(bg.build(), bm); boom.add(bmesh); }
  const sg = sailGeo(), sail = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); sail.position.y = 0.08; sail.castShadow = true; boom.add(sail);
  sg.userData.base = sg.attributes.position.array.slice();
  // fanion en haut du mât
  const flag = new THREE.Group(); flag.position.set(0, 7.1, -0.6); grp.add(flag);
  { const fg = new GB(); fg.tri(new V3(0, 0.15, 0), new V3(0, -0.15, 0), new V3(0, 0, 0.9), lin('#d8402a'), lin('#d8402a'), lin('#f0d050')); flag.add(new THREE.Mesh(fg.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))); }
  let helmet = null; if (!o.noSuit) { helmet = new THREE.Mesh(helmetGeo(), bm); helmet.position.set(0.45, 1.07, 2.0); helmet.castShadow = true; grp.add(helmet); }
  scene.add(grp);
  return { grp, boom, sail, flag, helmet };
}
let boatObj, wakeP, wakeD = [];
function setupBoat() {
  boatObj = buildBoat();
  // amarré au bout du ponton, parallèle, proue vers le large
  const pe = TAV.pierEnd, side = 3.0; BOAT.pos.set(pe.x + VD.px * side, 0, pe.z + VD.pz * side); BOAT.yaw = Math.atan2(-VD.x, -VD.z); BOAT.home = BOAT.pos.clone();
  boatObj.grp.position.copy(BOAT.pos); boatObj.grp.rotation.y = BOAT.yaw;
  // sillage
  const n = 90, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('a', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  wakeP = new THREE.Points(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uS: { value: 1 } }, vertexShader: 'attribute float a; varying float vA; void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (40.0 + (1.0 - a) * 90.0) / -mv.z * 2.6; gl_Position = projectionMatrix * mv; }', fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, (1.0 - smoothstep(0.25, 0.5, d)) * vA * 0.75); }' }));
  wakeP.frustumCulled = false; scene.add(wakeP); for (let i = 0; i < n; i++) wakeD.push({ x: 0, z: 0, a: 0, vx: 0, vz: 0 });
}
function boatFwd(v) { return v.set(-Math.sin(BOAT.yaw), 0, -Math.cos(BOAT.yaw)); }
function boardBoat() { G.mode = 'boat'; BOAT.speed = 0; BOAT.camYaw = 0; sfx('wood'); setPrompt(''); closeTalk(); }
function nearestLand(p) {
  for (let r = 1; r < 40; r += 1) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; const f = floorAt(x, z); if (f > -Infinity || (heightAt(x, z) > 0.25 && slopeAt(x, z) < 0.7)) return { x, z }; }
  return null;
}
function leaveBoat() {
  const l = nearestLand(BOAT.pos); if (!l) return false;
  G.mode = 'walk'; P.pos.set(l.x, groundAt(l.x, l.z), l.z); P.vel.set(0, 0, 0); P.vy = 0; P.yaw = BOAT.yaw; P.pitch = 0; sfx('land'); return true;
}
let bKeys = { up: 0, dn: 0 };
function modeKey(code) {
  if (G.mode === 'boat') {
    if (code === 'KeyW' || code === 'ArrowUp') { BOAT.sail = Math.min(1, BOAT.sail + 0.5); sfx('sail'); return true; }
    if (code === 'KeyS' || code === 'ArrowDown') { BOAT.sail = Math.max(0, BOAT.sail - 0.5); sfx('sail'); return true; }
    if (code === 'KeyE') { boatAction(); return true; }
    return false;
  }
  if (G.mode === 'dive') { if (code === 'KeyE') { endDive(); return true; } return false; }
  if (G.mode === 'turtle') return turtleKey(code);
  if (G.mode === 'intro') { if (code === 'Escape' || code === 'Enter') { skipIntro(); return true; } return true; }
  return false;
}
function boatContext() {
  const depth = heightAt(BOAT.pos.x, BOAT.pos.z), inDomain = Math.abs(BOAT.pos.x) < 330 && Math.abs(BOAT.pos.z) < 330;
  const land = coastDist(BOAT.pos.x, BOAT.pos.z) < 9 || Math.hypot(BOAT.pos.x - BOAT.home.x, BOAT.pos.z - BOAT.home.z) < 6;
  if (land) return 'land'; if (depth < -3 && depth > -40 && inDomain && BOAT.speed < 1.5) return 'dive'; return '';
}
function boatAction() { const c = boatContext(); if (c === 'land') leaveBoat(); else if (c === 'dive') startDiveIn(); }
function updateBoat(dt) {
  // barre : Q/D (ou joystick), voile : Z/S
  const st = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) + joy.x;
  BOAT.steer += (clamp(st, -1, 1) - BOAT.steer) * Math.min(1, dt * 4);
  if (joy.y < -0.6 && !bKeys.up) { BOAT.sail = Math.min(1, BOAT.sail + 0.5); bKeys.up = 1; } if (joy.y > -0.3) bKeys.up = 0;
  if (joy.y > 0.6 && !bKeys.dn) { BOAT.sail = Math.max(0, BOAT.sail - 0.5); bKeys.dn = 1; } if (joy.y < 0.3) bKeys.dn = 0;
  BOAT.sailK += (BOAT.sail - BOAT.sailK) * Math.min(1, dt * 1.6);
  const f = boatFwd(_bv), wl = Math.hypot(U.wind.value.x, U.wind.value.y) || 1, wx = U.wind.value.x / wl, wz = U.wind.value.y / wl, dot = f.x * wx + f.z * wz;
  const eff = 0.32 + 0.68 * smooth(-0.75, 0.55, dot), tgt = BOAT.sailK * eff * (3.2 + 9 * G.windStr);
  BOAT.speed += (tgt - BOAT.speed) * Math.min(1, dt * 0.45);
  BOAT.yaw -= BOAT.steer * dt * (0.22 + 0.45 * Math.min(1, Math.abs(BOAT.speed) / 4));
  const nx = BOAT.pos.x + f.x * BOAT.speed * dt, nz = BOAT.pos.z + f.z * BOAT.speed * dt;
  // échouage : la proue ou les flancs touchent le fond
  const probe = (x, z) => Math.max(heightAt(x + f.x * 3.2, z + f.z * 3.2), heightAt(x, z)) > -0.75 || floorAt(x + f.x * 3.2, z + f.z * 3.2) > -Infinity && Math.hypot(x - BOAT.home.x, z - BOAT.home.z) > 1;
  if (probe(nx, nz) || Math.hypot(nx, nz) > 1300) { if (Math.abs(BOAT.speed) > 1.2) { sfx('thud'); BOAT.bump = 1; } BOAT.speed *= -0.25; }
  else { BOAT.pos.x = nx; BOAT.pos.z = nz; }
  BOAT.bump = Math.max(0, BOAT.bump - dt * 2);
  // flottaison : houle, gîte au vent et dans les virages
  const t = G.t, side = f.x * wz - f.z * wx;
  BOAT.heel += ((-BOAT.steer * BOAT.speed * 0.025) + side * BOAT.sailK * G.windStr * 0.12 - BOAT.heel) * Math.min(1, dt * 1.5);
  const amp = 0.18 + 0.25 * G.windStr;
  BOAT.pos.y = Math.sin(t * 0.9 + BOAT.pos.x * 0.05) * amp * 0.5 + Math.sin(t * 1.3 + BOAT.pos.z * 0.07) * amp * 0.3 - 0.05;
  const g = boatObj.grp; g.position.copy(BOAT.pos); g.rotation.set(Math.sin(t * 0.8 + 1) * 0.035 + BOAT.speed * 0.004 + BOAT.bump * 0.06 * Math.sin(t * 30), BOAT.yaw, BOAT.heel + Math.sin(t * 0.7) * 0.04, 'YXZ');
  // voile : la bôme passe sous le vent, la toile se gonfle
  const wa = Math.atan2(-wx, -wz), boomA = clamp(angDiff(Math.atan2(wx, wz), BOAT.yaw), -1.3, 1.3) * (0.3 + 0.7 * BOAT.sailK);
  boatObj.boom.rotation.y += (boomA - boatObj.boom.rotation.y) * Math.min(1, dt * 2);
  const fill = BOAT.sailK * (0.35 + 0.65 * eff) * (0.35 + 0.65 * G.windStr) * Math.sign(Math.cos(BOAT.yaw + boatObj.boom.rotation.y) * wx - Math.sin(BOAT.yaw + boatObj.boom.rotation.y) * wz || 1), sg = boatObj.sail.geometry, pa = sg.attributes.position.array, base = sg.userData.base, ud = sg.userData;
  boatObj.sail.scale.y = 0.25 + 0.75 * BOAT.sailK;
  for (let j = 0, k = 0; j <= ud.Mh; j++) for (let i = 0; i <= ud.N; i++, k++) { const u = i / ud.N, v = j / ud.Mh, flap = Math.sin(t * 7 + u * 5 + v * 3) * 0.04 * (1 - BOAT.sailK * 0.7) * u; pa[k * 3] = base[k * 3] + fill * 0.9 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)) + flap; }
  sg.attributes.position.needsUpdate = true; sg.computeVertexNormals();
  boatObj.flag.rotation.y = angDiff(wa + Math.PI, BOAT.yaw) + Math.sin(t * 9) * 0.15;
  // sillage
  updateWake(dt, f);
  // caméra à la troisième personne, orbite à la souris
  BOAT.camYaw -= look.x * 0.0035; BOAT.camPitch = clamp(BOAT.camPitch + look.y * 0.0025, 0.05, 1.1); look.x = look.y = 0;
  BOAT.camYaw *= 1 - Math.min(1, dt * 0.15 * Math.min(1, BOAT.speed));
  const cy = BOAT.yaw + BOAT.camYaw, R = 11, tgtP = _bw.set(BOAT.pos.x, BOAT.pos.y + 2.4, BOAT.pos.z);
  camera.position.set(tgtP.x + Math.sin(cy) * Math.cos(BOAT.camPitch) * R, tgtP.y + Math.sin(BOAT.camPitch) * R, tgtP.z + Math.cos(cy) * Math.cos(BOAT.camPitch) * R);
  camera.position.y = Math.max(camera.position.y, Math.max(heightAt(camera.position.x, camera.position.z), 0) + 0.8);
  camera.lookAt(tgtP); camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  P.pos.set(BOAT.pos.x, 0, BOAT.pos.z); P.speed = 0;
  const c = boatContext();
  setPrompt(c === 'land' ? '<b>E</b>Débarquer' : c === 'dive' ? '<b>E</b>Enfiler le scaphandre et plonger' : '');
  $('boatHud').style.opacity = 1; $('boatHud').innerHTML = 'Voile ' + ['repliée', 'à moitié', 'pleine'][Math.round(BOAT.sail * 2)] + (TOUCH ? '' : ' · <b>Z/S</b> voile · <b>Q/D</b> barre');
}
function updateWake(dt, f) {
  const pa = wakeP.geometry.attributes.position.array, aa = wakeP.geometry.attributes.a.array, sp = Math.abs(BOAT.speed);
  BOAT.wk = (BOAT.wk || 0) + dt * sp * 4;
  for (let i = 0; i < wakeD.length; i++) {
    const d = wakeD[i];
    if (d.a <= 0 && BOAT.wk > 1 && sp > 0.6) { BOAT.wk -= 1; const sd = Math.random() < 0.5 ? -1 : 1, bow = Math.random() < 0.3; d.x = BOAT.pos.x + (bow ? f.x * 3.2 : -f.x * 3.0) + f.z * sd * (bow ? 0.4 : 0.9); d.z = BOAT.pos.z + (bow ? f.z * 3.2 : -f.z * 3.0) - f.x * sd * (bow ? 0.4 : 0.9); d.vx = f.z * sd * 0.6; d.vz = -f.x * sd * 0.6; d.a = 1; }
    if (d.a > 0) { d.a -= dt * 0.35; d.x += d.vx * dt; d.z += d.vz * dt; }
    pa[i * 3] = d.x; pa[i * 3 + 1] = 0.05; pa[i * 3 + 2] = d.z; aa[i] = Math.max(0, d.a);
  }
  wakeP.geometry.attributes.position.needsUpdate = true; wakeP.geometry.attributes.a.needsUpdate = true;
}
function setPrompt(txt) { const pr = $('prompt'); if (pr.dataset.t !== txt) { pr.dataset.t = txt; pr.innerHTML = txt; pr.style.opacity = txt ? 1 : 0; } }

/* ---------- pêche ---------- */
const FISH = { st: 'idle', t: 0, bob: null, line: null, tip: null, catchShow: 0 };
const SPECIES = {
  sardine: { name: 'Sardine argentée', body: '#a8c4d4', belly: '#eef4f6', fin: '#7a9aae', len: [12, 22], s: 0.18 },
  bar: { name: 'Bar rayé', body: '#7a8a8e', belly: '#e0e4e0', fin: '#5a6a6e', stripes: '#3a4448', len: [30, 60], s: 0.42 },
  dore: { name: 'Poisson doré', body: '#f0a020', belly: '#ffe090', fin: '#e07010', len: [15, 32], s: 0.25 },
  clown: { name: 'Poisson-clown', body: '#f07020', belly: '#ff9a40', fin: '#1a1a1a', bands: '#ffffff', len: [8, 12], s: 0.12 },
  merou: { name: 'Mérou géant', body: '#6a5a3a', belly: '#b0a070', fin: '#4a3a2a', spots: 1, len: [60, 110], s: 0.8 },
  lune: { name: 'Poisson-lune', body: '#9aa4b0', belly: '#dfe4ea', fin: '#7a8490', tall: 1, len: [40, 90], s: 0.6 },
  chirurgien: { name: 'Poisson-chirurgien', body: '#2a5ad0', belly: '#3a6ae0', fin: '#f0d020', len: [15, 25], s: 0.22 },
  botte: { name: 'Vieille botte', junk: 1, len: [28, 28], s: 0.3 }
};
function gFish(sp) {
  const g = new GB(), S = SPECIES[sp];
  if (S.junk) { tube(g, [new V3(0, 0, 0.25), new V3(0, 0, -0.1), new V3(0, 0.35, -0.15)], i => [0.1, 0.11, 0.1][i], '#4a3a2a', 10, 0.1, () => 0); g.add(SPHL, '#4a3a2a', M(0, -0.02, 0.3, 0.11, 0.08, 0.14), 0.3); return g.build(); }
  const tall = S.tall ? 1.6 : 1;
  const body = lathe([[0.001, -0.5], [0.07, -0.44], [0.17, -0.25], [0.22, -0.02], [0.2, 0.2], [0.13, 0.38], [0.05, 0.48], [0.001, 0.5]], 14);
  body.applyMatrix4(M(0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0)); body.applyMatrix4(new THREE.Matrix4().makeScale(0.55, tall, 1));
  const p = body.attributes.position, cb = lin(S.body), cl = lin(S.belly), cs = S.stripes ? lin(S.stripes) : null, cbd = S.bands ? lin(S.bands) : null, cols = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); let c = cb.clone().lerp(cl, smooth(0.05, -0.15 * tall, y)); if (cs && y > -0.05 && Math.sin(y * 40) > 0.3) c = c.lerp(cs, 0.6); if (cbd && (Math.abs(z - 0.22) < 0.05 || Math.abs(z + 0.02) < 0.06 || Math.abs(z + 0.3) < 0.04)) c = cbd.clone(); if (S.spots && Math.sin(z * 37) * Math.sin(y * 31) > 0.7) c.multiplyScalar(0.6); cols.push(c.r, c.g, c.b); }
  body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); body.computeVertexNormals();
  const gb2 = new GB(); // nageoires et yeux
  const fc = lin(S.fin);
  gb2.tri(new V3(0, 0, -0.44), new V3(0, 0.26 * tall, -0.72), new V3(0, 0.02, -0.6), fc, fc, fc, 0, 1, 1); gb2.tri(new V3(0, 0, -0.44), new V3(0, -0.02, -0.6), new V3(0, -0.24 * tall, -0.72), fc, fc, fc, 0, 1, 1);
  gb2.tri(new V3(0, 0.2 * tall, 0.15), new V3(0, 0.36 * tall, -0.05), new V3(0, 0.19 * tall, -0.25), fc, fc, fc);
  if (S.tall) gb2.tri(new V3(0, -0.2 * tall, 0.0), new V3(0, -0.4 * tall, -0.15), new V3(0, -0.18 * tall, -0.28), fc, fc, fc);
  for (const sx of [-1, 1]) { gb2.add(SPHL, '#ffffff', M(sx * 0.1, 0.06, 0.3, 0.045), 0); gb2.add(SPHL, '#111111', M(sx * 0.118, 0.065, 0.31, 0.026), 0); gb2.tri(new V3(sx * 0.11, -0.04, 0.12), new V3(sx * 0.22, -0.1, -0.02), new V3(sx * 0.11, -0.08, 0.0), fc, fc, fc); }
  // fusion
  const nb = body.toNonIndexed(), b2 = gb2.build(), out = new THREE.BufferGeometry();
  const merge = (k, n) => { const a = nb.attributes[k].array, b = b2.attributes[k].array, r = new Float32Array(a.length + b.length); r.set(a); r.set(b, a.length); out.setAttribute(k, new THREE.Float32BufferAttribute(r, n)); };
  merge('position', 3); merge('normal', 3); merge('color', 3);
  const aw = new Float32Array(nb.attributes.position.count * 2 + b2.attributes.position.count * 2); out.setAttribute('aW', new THREE.Float32BufferAttribute(aw, 2));
  return out;
}
// matériau des poissons : la queue ondule (phase par individu)
function fishMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 vec4 fp = instanceMatrix[3];
#else
 vec4 fp = modelMatrix[3];
#endif
 float ph = fp.x * 1.7 + fp.z * 2.3;
 transformed.x += sin(uTime * 9.0 + ph + position.z * 3.0) * 0.12 * smoothstep(0.25, -0.75, position.z);`);
  };
  m.customProgramCacheKey = () => 'fish'; return m;
}
function buildRod() {
  const g = new GB();
  tube(g, [new V3(0, 0, 0.12), new V3(0, 0.0, -0.18)], 0.022, '#c9a46a', 10, 0.1, () => 0); // poignée en liège
  tube(g, [new V3(0, 0, -0.18), new V3(0, 0.25, -0.9), new V3(0, 0.62, -1.75)], i => [0.012, 0.008, 0.004][i], '#5a3a22', 8, 0.05, () => 0);
  g.add(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), '#b8b0a0', M(0, -0.05, -0.05, 1, 1, 1, 0, 0, Math.PI / 2), 0.2); g.add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), '#3a3632', M(0.03, -0.05, -0.05, 1, 1, 1, 0, 0, Math.PI / 2), 0.2);
  for (let i = 1; i < 5; i++) { const t = i / 5; g.add(new THREE.TorusGeometry(0.012, 0.003, 4, 8), '#c8c8c8', M(0, lerp(0.0, 0.62, t * t) - 0.012, lerp(-0.18, -1.75, t), 1, 1, 1, Math.PI / 2, 0, 0), 0); }
  const m = new THREE.Mesh(g.build(), mat({ ds: true, ga: 0 })); const tip = new THREE.Object3D(); tip.position.set(0, 0.62, -1.75); m.add(tip); FISH.tip = tip; return m;
}
function setupFishing() {
  const rod = buildRod(); rod.position.set(0, 0.0, -0.02); rod.rotation.set(-0.2, 0, 0); rod.userData.a = anchorF; anchorF.add(rod); rod.visible = false; HELD.rod = rod;
  ITEMS.rod = { name: 'Canne à pêche', icon: '🎣' }; ITEMS.fish = { name: 'Poissons', icon: '🐟', un: 'le poisson' }; FR.fish = FR.fish || 0;
  POSE.rod = [0.24, -0.27, -0.42, 0.28, 0.25, 0.1];
  const bob = new GB(); bob.add(SPH, '#e8e0d0', M(0, -0.03, 0, 0.06, 0.05, 0.06), 0.3); bob.add(SPH, '#d83a2a', M(0, 0.03, 0, 0.062, 0.05, 0.062), 0.3); bob.add(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), '#e8e0d0', M(0, 0.1, 0), 0);
  FISH.bob = new THREE.Mesh(bob.build(), mat({ ga: 0 })); FISH.bob.visible = false; scene.add(FISH.bob);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
  FISH.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf4f0e6, transparent: true, opacity: 0.7 })); FISH.line.frustumCulled = false; FISH.line.visible = false; scene.add(FISH.line);
  FISH.mat = fishMat(); FISH.geos = {}; for (const k in SPECIES) FISH.geos[k] = gFish(k);
  FISH.show = new THREE.Mesh(FISH.geos.sardine, FISH.mat); FISH.show.visible = false; scene.add(FISH.show);
  { const fm = new THREE.Mesh(FISH.geos.sardine, FISH.mat); fm.scale.setScalar(0.32); fm.rotation.set(0, 1.4, 0.3); fm.position.set(0, 0.035, -0.03); fm.userData.a = anchorO; anchorO.add(fm); fm.visible = false; HELD.fish = fm; }
  TALKFX.giveRod = () => { G.hasRod = true; saveProg(); sfx('found'); equip('rod'); };
  TALKFX.giveFish = () => { FR.fish = Math.max(0, FR.fish - 1); sfx('pick'); };
}
const TALKFX = {};
function pickSpecies(p, depth) {
  const r = Math.random(), night = SKY.night > 0.5, rocky = slopeAt(p.x, p.z) > 0.4 || coastDist(p.x, p.z) < 6 && heightAt(p.x, p.z) < -2, south = p.z > 40;
  if (r < 0.05) return 'botte';
  if (night && r < 0.3) return 'lune';
  if (depth < -10 && r < 0.35) return 'merou';
  if (south && !night && r < 0.45) return 'dore';
  if (rocky && r < 0.5) return 'bar';
  if (r < 0.62) return 'chirurgien';
  if (r < 0.68) return 'clown';
  return 'sardine';
}
const _tp = new V3();
function updateFishing(dt) {
  const F = FISH; if (!F.bob) return;
  F.tip.updateWorldMatrix(true, false); const tipW = F.tip.getWorldPosition(_tp), active = held === 'rod' && G.mode === 'walk' && !TF.on;
  if (!active && F.st !== 'idle') { F.st = 'idle'; F.bob.visible = F.line.visible = false; }
  F.t += dt;
  if (active && FISH.click) { FISH.click = false;
    if (F.st === 'idle') {
      const d = new V3(camDir.x, 0, camDir.z).normalize(), dist = 9 + clamp(-P.pitch * 6 + 4, 0, 8), tx = P.pos.x + d.x * dist, tz = P.pos.z + d.z * dist;
      F.st = 'cast'; F.t = 0; F.from = tipW.clone(); F.to = new V3(tx, Math.max(heightAt(tx, tz), waterLevel(tx, tz)), tz); F.water = heightAt(tx, tz) < -0.3; F.castA = 1; sfx('swing');
    } else if (F.st === 'bite') {
      F.st = 'catch'; F.t = 0; const depth = heightAt(F.to.x, F.to.z); F.sp = pickSpecies(F.to, depth); const S = SPECIES[F.sp]; F.size = Math.round(lerp(S.len[0], S.len[1], Math.random()));
      F.show.geometry = F.geos[F.sp]; F.show.scale.setScalar(S.s * 1.6); F.show.visible = true; sfx('catch');
    } else if (F.st === 'wait') { F.st = 'reel'; F.t = 0; sfx('tick'); }
  }
  FISH.click = false;
  if (F.st === 'cast') {
    const k = Math.min(1, F.t / 0.9); F.bob.visible = F.line.visible = true; F.bob.position.lerpVectors(F.from, F.to, k); F.bob.position.y += Math.sin(k * Math.PI) * 3.5;
    if (k >= 1) { if (F.water) { F.st = 'wait'; F.t = 0; F.biteAt = 2.5 + Math.random() * 6 * (SKY.night > 0.5 || Math.abs(G.hour - 7) < 1.5 || Math.abs(G.hour - 19) < 1.5 ? 0.6 : 1); sfx('plop'); } else { F.st = 'reel'; F.t = 0; } }
  } else if (F.st === 'wait' || F.st === 'bite') {
    const wl = Math.max(waterLevel(F.to.x, F.to.z), 0) + Math.sin(G.t * 1.7 + F.to.x) * 0.04; F.bob.position.set(F.to.x, wl, F.to.z);
    if (F.st === 'wait' && F.t > F.biteAt) { F.st = 'bite'; F.t = 0; sfx('plop'); }
    if (F.st === 'bite') { F.bob.position.y -= 0.12 + Math.abs(Math.sin(F.t * 18)) * 0.1; if (F.t > 1.3) { F.st = 'wait'; F.t = 0; F.biteAt = 2 + Math.random() * 5; } }
    if (Math.hypot(F.to.x - P.pos.x, F.to.z - P.pos.z) > 28) { F.st = 'reel'; F.t = 0; }
  } else if (F.st === 'reel') {
    F.bob.position.lerp(tipW, Math.min(1, dt * 6)); if (F.bob.position.distanceTo(tipW) < 0.3) { F.st = 'idle'; F.bob.visible = F.line.visible = false; }
  } else if (F.st === 'catch') {
    const k = Math.min(1, F.t / 0.8); F.bob.position.lerp(tipW, Math.min(1, dt * 5)); F.show.position.copy(F.bob.position).add(_bv.set(0, -0.35 * F.show.scale.y, 0)); F.show.rotation.set(1.4 + Math.sin(G.t * 14) * 0.25, G.t * 2, 0);
    if (F.t > 0.4 && !F.card) { F.card = 1; const S = SPECIES[F.sp]; showCatch(S.name, S.junk ? '' : F.size + ' cm'); }
    if (F.t > 2.2) { F.st = 'idle'; F.card = 0; F.show.visible = F.bob.visible = F.line.visible = false; if (!SPECIES[F.sp].junk) { FR.fish++; G.fishLog[F.sp] = (G.fishLog[F.sp] || 0) + 1; saveProg(); } }
  }
  // ligne : petite chaînette entre le scion et le bouchon
  if (F.line.visible) { const pa = F.line.geometry.attributes.position.array, b = F.bob.position, sag = F.st === 'wait' || F.st === 'bite' ? 0.9 : 0.25; for (let i = 0; i < 16; i++) { const t = i / 15; pa[i * 3] = lerp(tipW.x, b.x, t); pa[i * 3 + 1] = lerp(tipW.y, b.y + 0.08, t) - Math.sin(t * Math.PI) * sag * Math.min(1, tipW.distanceTo(b) / 6); pa[i * 3 + 2] = lerp(tipW.z, b.z, t); } F.line.geometry.attributes.position.needsUpdate = true; }
  // le bras accompagne le lancer
  if (held === 'rod') { if (F.st === 'cast' && F.t < 0.3) armR.rotation.x += Math.sin(F.t / 0.3 * Math.PI) * -0.9; if (F.st === 'bite') armR.position.y += Math.sin(G.t * 30) * 0.004; }
  F.catchShow = Math.max(0, F.catchShow - dt); $('catch').style.opacity = F.catchShow > 0 ? Math.min(1, F.catchShow) : 0;
}
function showCatch(name, size) { const c = $('catch'); c.innerHTML = '<div class="cn">' + name + '</div>' + (size ? '<div class="cs">' + size + '</div>' : ''); FISH.catchShow = 3.2; }

/* ---------- plongée ---------- */
const DIVE = { t: 0, anchor: new V3(), vel: new V3(), vy: 0, life: null, built: false, breath: 0 };
let surfPlane, rays = [];
function startDiveIn() { G.mode = 'diveIn'; DIVE.t = 0; setPrompt(''); $('boatHud').style.opacity = 0; sfx('wood'); }
function updateDiveIn(dt) {
  DIVE.t += dt; const t = DIVE.t, h = boatObj.helmet;
  // vue subjective sur le pont : on regarde le casque, il se soulève et vient se poser sur la tête
  const f = boatFwd(_bv), eye = _bw.set(BOAT.pos.x + f.x * 0.2, BOAT.pos.y + 1.9, BOAT.pos.z + f.z * 0.2);
  camera.position.copy(eye); const hp = h.getWorldPosition(new V3());
  if (!DIVE.h0) DIVE.h0 = hp.clone();
  const k = smooth(0.4, 2.0, t), target = eye.clone().add(_bv.set(0, 0.25, 0));
  const hw = DIVE.h0.clone().lerp(target, k); hw.y += Math.sin(k * Math.PI) * 0.5;
  h.parent.worldToLocal(hw); h.position.copy(hw); h.visible = k < 0.97;
  camera.lookAt(DIVE.h0.clone().lerp(target.clone().add(_bv.set(0, 0.3, 0)), smooth(0.2, 1.8, t))); camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  if (t > 1.9 && !DIVE.c1) { DIVE.c1 = 1; sfx('clunk'); $('helmet').style.opacity = 1; }
  if (t > 2.4 && !DIVE.c2) { DIVE.c2 = 1; sfx('splash'); $('fade').style.background = '#0d4a5a'; $('fade').style.opacity = 1; }
  if (t > 3.1) {
    DIVE.c1 = DIVE.c2 = 0; DIVE.h0 = null; h.position.set(0.45, 1.07, 2.0); h.visible = true;
    G.mode = 'dive'; DIVE.anchor.set(BOAT.pos.x, 0, BOAT.pos.z); const sx = BOAT.pos.x + f.z * 2.5, sz = BOAT.pos.z - f.x * 2.5;
    P.pos.set(sx, heightAt(sx, sz), sz); P.yaw = BOAT.yaw; P.pitch = -0.1; DIVE.vel.set(0, 0, 0); DIVE.vy = 0;
    setUnder(true); placeLife(DIVE.anchor); setTimeout(() => { $('fade').style.opacity = 0; }, 150);
  }
}
function endDive() {
  $('fade').style.background = '#0d4a5a'; $('fade').style.opacity = 1; sfx('splash');
  setTimeout(() => { setUnder(false); $('helmet').style.opacity = 0; G.mode = 'boat'; $('fade').style.opacity = 0; setTimeout(() => $('fade').style.background = '#000', 1500); }, 700);
  G.mode = 'surfacing';
}
let _saved = null;
function setUnder(on) {
  U.under.value = on ? 1 : 0; DIVE.on = on;
  sky.visible = !on; stars.visible = !on; water.visible = !on; if (window.waterOuter) waterOuter.visible = !on;
  surfPlane.visible = on; for (const r of rays) r.visible = on; if (DIVE.life) DIVE.life.visible = on;
  renderer.setClearColor(on ? 0x0e5a6a : 0x000000, 1);
  if (AU.uw && AU.ctx) AU.uw.frequency.setTargetAtTime(on ? 520 : 22000, AU.ctx.currentTime, 0.2);
}
// surcharge de l'ambiance sous l'eau (appelée après la mise à jour du ciel)
function applyUnder() {
  if (!DIVE.on) return;
  const d = Math.max(0, -heightAt(P.pos.x, P.pos.z)), deep = smooth(2, 30, d), day = 1 - SKY.night * 0.85;
  const c = new THREE.Color().setRGB(lerp(0.09, 0.02, deep) * day, lerp(0.42, 0.18, deep) * day, lerp(0.48, 0.3, deep) * day);
  scene.fog.color.copy(c); scene.fog.density = 0.062 + deep * 0.03; WU.uFog.value.copy(c); FOGU.uFSunCol.value.copy(c).multiplyScalar(1.25); renderer.setClearColor(c, 1);
  surfPlane.position.set(camera.position.x, 0.02, camera.position.z); surfPlane.material.uniforms.uC.value.copy(c);
  rays.forEach((r, i) => { const a = i * 2.4 + G.t * 0.05; r.position.set(camera.position.x + Math.cos(a) * (6 + i * 3), -0.2, camera.position.z + Math.sin(a) * (6 + i * 3)); r.rotation.z = Math.sin(G.t * 0.3 + i) * 0.1; r.material.opacity = 0.07 * day; });
}
function updateDive(dt) {
  const sp = (P.run || keys.ShiftLeft ? 3.4 : 2.1) * (G.up.suit ? 1.35 : 1);
  P.yaw -= look.x * 0.0021; P.pitch = clamp(P.pitch - look.y * 0.0021, -1.4, 1.4); look.x = look.y = 0;
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y, s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const il = Math.hypot(f, s); if (il > 1) { f /= il; s /= il; }
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), k = 1 - Math.exp(-2.5 * dt);
  DIVE.vel.x += ((-sy * f + cy * s) * sp - DIVE.vel.x) * k; DIVE.vel.z += ((-cy * f - sy * s) * sp - DIVE.vel.z) * k;
  const ox = P.pos.x, oz = P.pos.z; P.pos.x += DIVE.vel.x * dt; P.pos.z += DIVE.vel.z * dt;
  const bad = (x, z) => heightAt(x, z) > -1.3 || Math.hypot(x - DIVE.anchor.x, z - DIVE.anchor.z) > HOSE() || Math.abs(x) > 345 || Math.abs(z) > 345;
  if (bad(P.pos.x, P.pos.z)) { if (!bad(P.pos.x, oz)) P.pos.z = oz; else if (!bad(ox, P.pos.z)) P.pos.x = ox; else { P.pos.x = ox; P.pos.z = oz; } DIVE.vel.multiplyScalar(0.5); }
  const g = heightAt(P.pos.x, P.pos.z);
  if ((inp.jump || keys.Space) && P.pos.y <= g + 0.05) DIVE.vy = 2.6; inp.jump = false;
  DIVE.vy -= 3.2 * dt; P.pos.y += DIVE.vy * dt; if (P.pos.y < g) { P.pos.y = g; DIVE.vy = 0; } P.pos.y = Math.min(P.pos.y, -1.9);
  P.speed = Math.hypot(DIVE.vel.x, DIVE.vel.z); P.ph += dt * P.speed * 1.8;
  camera.position.set(P.pos.x, P.pos.y + 1.6 + Math.sin(P.ph) * 0.03, P.pos.z); camera.rotation.set(P.pitch, P.yaw, Math.sin(G.t * 0.6) * 0.02, 'YXZ');
  camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  // bulles et respiration
  DIVE.breath += dt; if (DIVE.breath > 4.2) { DIVE.breath = 0; sfx('breath'); emitBubbles(); }
  updateBubbles(dt); updateLife2(dt);
  const far = Math.hypot(P.pos.x - DIVE.anchor.x, P.pos.z - DIVE.anchor.z) / HOSE();
  setPrompt('<b>E</b>Remonter sur le bateau' + (far > 0.85 ? ' · le tuyau d\'air est tendu' : ''));
}
let bubbles, bubD = [];
function emitBubbles() { let n = 0; for (const b of bubD) if (b.a <= 0 && n < 9) { n++; b.a = 1; b.x = camera.position.x + camDir.x * 0.4 + (Math.random() - 0.5) * 0.2; b.y = camera.position.y + 0.25; b.z = camera.position.z + camDir.z * 0.4 + (Math.random() - 0.5) * 0.2; b.v = 0.8 + Math.random() * 0.8; b.d = n * 0.08; } }
function updateBubbles(dt) {
  const pa = bubbles.geometry.attributes.position.array, aa = bubbles.geometry.attributes.a.array;
  bubD.forEach((b, i) => { if (b.a > 0) { if (b.d > 0) b.d -= dt; else { b.y += b.v * dt; b.x += Math.sin(G.t * 5 + i) * dt * 0.1; b.a -= dt * 0.18; if (b.y > -0.1) b.a = 0; } } pa[i * 3] = b.x; pa[i * 3 + 1] = b.y; pa[i * 3 + 2] = b.z; aa[i] = Math.max(0, b.a) * (b.d > 0 ? 0 : 1); });
  bubbles.geometry.attributes.position.needsUpdate = bubbles.geometry.attributes.a.needsUpdate = true;
}

/* ---------- vie sous-marine ---------- */
function gKelp(r) { const g = new GB(); for (let k = 0; k < 3; k++) { const a = r() * 6.28, L = 3 + r() * 4, n = 9; let p = new V3(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15); for (let i = 0; i < n; i++) { const t = i / n, q = p.clone().add(new V3(Math.sin(i * 0.9 + a) * 0.12, L / n, Math.cos(i * 0.7 + a) * 0.12)), w = 0.16 * (1 - t * 0.5); const c1 = lin('#3a6a2a').multiplyScalar(0.8 + t * 0.5), c2 = lin('#6a9a3a').multiplyScalar(0.8 + t * 0.4), f0 = t, f1 = t + 1 / n; g.tri(p.clone().add(new V3(-w, 0, 0)), p.clone().add(new V3(w, 0, 0)), q.clone().add(new V3(w, 0, 0)), c1, c1, c2, f0, f0, f1); g.tri(p.clone().add(new V3(-w, 0, 0)), q.clone().add(new V3(w, 0, 0)), q.clone().add(new V3(-w, 0, 0)), c1, c2, c2, f0, f1, f1); p = q; } } return g.build(); }
function gCoralBranch(r, col) { const g = new GB(), c = col; const br = (p, d, L, rad, dep) => { const q = p.clone().addScaledVector(d, L); limb(g, p, q, rad, rad * 0.75, c, 6, 0.1); g.add(SPHL, c, M(q.x, q.y, q.z, rad * 0.8), 0.2); if (dep > 0) for (let i = 0; i < 2 + (r() * 2 | 0); i++) { const nd = d.clone().add(new V3(r() - 0.5, 0.3 + r() * 0.3, r() - 0.5)).normalize(); br(q, nd, L * 0.72, rad * 0.75, dep - 1); } }; for (let i = 0; i < 3; i++) br(new V3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), new V3(r() - 0.5, 1, r() - 0.5).normalize(), 0.45, 0.07, 3); return g.build(); }
function gBrain(r) { const g = new GB(); const s = new THREE.SphereGeometry(0.6, 18, 12, 0, 6.29, 0, 1.7), p = s.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.06 * Math.sin(x * 14 + Math.sin(z * 11) * 2) ; p.setXYZ(i, x * n, y * n * 0.75, z * n); } s.computeVertexNormals(); g.add(s, '#c8a85a', M(0, -0.05, 0), 0.4, 0.05); return g.build(); }
function gFan(r) { const g = new GB(), c = lin('#a04ac0'); for (let i = 0; i < 14; i++) { const a = -0.9 + i / 13 * 1.8; let p = new V3(0, 0, 0); for (let j = 0; j < 5; j++) { const q = new V3(Math.sin(a) * (j + 1) * 0.22, (j + 1) * 0.24, (r() - 0.5) * 0.04); limb(g, p, q, 0.02, 0.014, '#a04ac0', 3, 0); p = q; } } const s = lin('#c06ad0'); for (let j = 1; j < 5; j++) for (let i = 0; i < 13; i++) { const a0 = -0.9 + i / 13 * 1.8, a1 = -0.9 + (i + 1) / 13 * 1.8, y = j * 0.24; g.tri(new V3(Math.sin(a0) * j * 0.22, y, 0), new V3(Math.sin(a1) * j * 0.22, y, 0), new V3(Math.sin(a1) * (j + 1) * 0.22, y + 0.24, 0), s, s, s); } return g.build(); }
function gTubes(r) { const g = new GB(); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.3, h = 0.4 + r() * 0.9, x = Math.cos(a) * d, z = Math.sin(a) * d; g.add(new THREE.CylinderGeometry(0.09, 0.1, h, 10, 1, true), '#e8c030', M(x, h / 2, z), 0.4); g.add(new THREE.TorusGeometry(0.09, 0.025, 5, 12), '#f8d850', M(x, h, z, 1, 1, 1, Math.PI / 2, 0, 0), 0.2); } return g.build(); }
function gAnemone(r) { const g = new GB(); g.add(SPH, '#c8508a', M(0, 0.12, 0, 0.32, 0.16, 0.32), 0.3); for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = r() * 0.3, x = Math.cos(a) * d, z = Math.sin(a) * d, L = 0.3 + r() * 0.25; limb(g, new V3(x, 0.2, z), new V3(x * 1.5 + (r() - 0.5) * 0.1, 0.2 + L, z * 1.5 + (r() - 0.5) * 0.1), 0.025, 0.015, '#f0a0c8', 3, 0); } return g.build(); }
function gShark() {
  const g = new GB(), body = lathe([[0.001, -1.4], [0.12, -1.1], [0.3, -0.5], [0.38, 0.1], [0.33, 0.6], [0.2, 1.0], [0.06, 1.3], [0.001, 1.38]], 16);
  body.applyMatrix4(M(0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0)); body.applyMatrix4(new THREE.Matrix4().makeScale(0.8, 0.9, 1));
  const p = body.attributes.position, cols = [], top = lin('#5a6a78'), bot = lin('#e0e4e6'); for (let i = 0; i < p.count; i++) { const c = top.clone().lerp(bot, smooth(0.05, -0.18, p.getY(i))); cols.push(c.r, c.g, c.b); } body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const gb = new GB(), tc = lin('#56666f');
  gb.tri(new V3(0, 0.3, 0.2), new V3(0, 0.95, -0.35), new V3(0, 0.3, -0.5), tc, tc, tc); // aileron dorsal
  gb.tri(new V3(0, 0, -1.3), new V3(0, 0.75, -1.85), new V3(0, 0.05, -1.55), tc, tc, tc, 0, 1, 1); gb.tri(new V3(0, 0, -1.3), new V3(0, -0.05, -1.55), new V3(0, -0.45, -1.75), tc, tc, tc, 0, 1, 1);
  for (const sx of [-1, 1]) { gb.tri(new V3(sx * 0.25, -0.12, 0.45), new V3(sx * 0.95, -0.38, -0.05), new V3(sx * 0.25, -0.15, 0.05), tc, tc, tc); gb.add(SPHL, '#111111', M(sx * 0.2, 0.08, 0.95, 0.04), 0); for (let k = 0; k < 4; k++) gb.add(new THREE.BoxGeometry(0.01, 0.16, 0.012), '#3a4650', M(sx * 0.3, 0.0, 0.6 - k * 0.07), 0); }
  const nb = body.toNonIndexed(); nb.computeVertexNormals(); const b2 = gb.build(), out = new THREE.BufferGeometry();
  const merge = (k, n) => { const a = nb.attributes[k].array, b = b2.attributes[k].array, r = new Float32Array(a.length + b.length); r.set(a); r.set(b, a.length); out.setAttribute(k, new THREE.Float32BufferAttribute(r, n)); };
  merge('position', 3); merge('normal', 3); merge('color', 3); return out;
}
function setupSea() {
  G.fishLog = G.fishLog || {}; G.up = G.up || {};
  setupBoat(); setupFishing();
  // plafond d'eau vu d'en dessous
  surfPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.ShaderMaterial({ uniforms: { uTime: U.time, uNoise: U.noise, uC: { value: new THREE.Color() } }, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uTime; uniform sampler2D uNoise; uniform vec3 uC; varying vec3 vW; void main(){ float a = texture2D(uNoise, vW.xz*0.05+uTime*0.01).g, b = texture2D(uNoise, vW.xz*0.07-uTime*0.012+0.4).g; float l = pow(1.0-abs(a-b)*2.0, 6.0); vec3 c = mix(uC*1.7+vec3(0.05,0.12,0.12), vec3(0.6,0.9,0.85), l*0.45); gl_FragColor = vec4(c, 0.9); }' }));
  surfPlane.rotation.x = Math.PI / 2; surfPlane.visible = false; surfPlane.renderOrder = 3; scene.add(surfPlane);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbff0e8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); r.geometry.translate(0, -20, 0); r.visible = false; scene.add(r); rays.push(r); }
  const n = 60, bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); bg.setAttribute('a', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: 'attribute float a; varying float vA; void main(){ vA=a; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 26.0 / -mv.z * 3.0; gl_Position = projectionMatrix*mv; }', fragmentShader: 'varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5||vA<=0.0) discard; float ring = smoothstep(0.3,0.45,d)*(1.0-smoothstep(0.45,0.5,d)) + 0.25*(1.0-smoothstep(0.0,0.2,length(c-vec2(-0.15,-0.15)))); gl_FragColor = vec4(0.85,1.0,1.0, ring*vA); }' }));
  bubbles.frustumCulled = false; scene.add(bubbles); for (let i = 0; i < n; i++) bubD.push({ x: 0, y: -100, z: 0, a: 0, v: 1, d: 0 });
}
// la vie marine est posée autour du point de plongée
function placeLife(c) {
  if (!DIVE.built) {
    DIVE.built = true; const r = mulberry(4242), L = new THREE.Group(); scene.add(L); DIVE.life = L;
    const lm = mat({ ds: true, grain: 2, ga: 0.15, branch: 0.25, freq: 0.6 }), cm = mat({ ds: true, grain: 3, ga: 0.2 });
    const kinds = [['kelp', gKelp(r), lm, 260], ['cb1', gCoralBranch(r, '#f06a5a'), cm, 70], ['cb2', gCoralBranch(r, '#f0a040'), cm, 60], ['brain', gBrain(r), cm, 50], ['fan', gFan(r), cm, 50], ['tubes', gTubes(r), cm, 45], ['anem', gAnemone(r), cm, 18], ['star', gStar(), shM2(), 70], ['rock', gRock(7), cm, 60]];
    DIVE.inst = kinds.map(([k, geo, m, n]) => { const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; L.add(im); return { k, im, n }; });
    DIVE.fish = []; const fsp = [['sardine', 60, 0.2], ['chirurgien', 18, 0.28], ['dore', 14, 0.3], ['clown', 24, 0.14], ['bar', 8, 0.5], ['lune', 2, 1.0], ['merou', 3, 1.0]];
    for (const [sp, n, s] of fsp) { const im = new THREE.InstancedMesh(FISH.geos[sp], FISH.mat, n); im.frustumCulled = false; L.add(im); const arr = []; for (let i = 0; i < n; i++) arr.push({ s: s * (0.8 + r() * 0.4), ph: r() * 6.28, o: new V3(r() - 0.5, r() - 0.5, r() - 0.5) }); DIVE.fish.push({ sp, im, arr }); }
    DIVE.sharks = []; const sg = gShark(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(sg, FISH.mat); m.scale.setScalar(1.3 + i * 0.25); L.add(m); DIVE.sharks.push({ m, a: i * 2.1, R: 18 + i * 7, y: 0, sp: 0.09 - i * 0.015, dir: i % 2 ? -1 : 1 }); }
    L.visible = false;
  }
  const r = mulberry((c.x * 7 + c.z * 13) | 0), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), ps = new V3();
  const spot = (minD = -1.6, maxD = -40, rad = 55) => { for (let k = 0; k < 20; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * rad, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, h = heightAt(x, z); if (h < minD && h > maxD) return new V3(x, h, z); } return null; };
  DIVE.anems = [];
  for (const it of DIVE.inst) {
    for (let i = 0; i < it.n; i++) { const p = spot(it.k === 'kelp' ? -3 : -1.8); if (!p) { it.im.setMatrixAt(i, mt.makeScale(0, 0, 0)); continue; } const s = it.k === 'kelp' ? 0.8 + r() * 0.8 : it.k === 'rock' ? 0.5 + r() * 1.6 : 0.7 + r() * 1.0; q.setFromAxisAngle(_up, r() * 6.28); ps.set(p.x, p.y - 0.05, p.z); sc.set(s, s * (it.k === 'kelp' ? 0.7 + r() * 0.6 : 1), s); it.im.setMatrixAt(i, mt.compose(ps, q, sc)); if (it.k === 'anem') DIVE.anems.push(p.clone()); const cc = 0.8 + r() * 0.4; it.im.setColorAt(i, _ic.setRGB(cc, cc, cc)); }
    it.im.instanceMatrix.needsUpdate = true; if (it.im.instanceColor) it.im.instanceColor.needsUpdate = true;
  }
  // les bancs suivent des leaders qui errent
  DIVE.schools = DIVE.fish.map(f => ({ f, c: (spot(-3) || new V3(c.x, -5, c.z)).clone(), a: r() * 6.28, R: 6 + r() * 14 }));
  for (const s of DIVE.sharks) { s.c = c.clone(); s.y = Math.max(heightAt(c.x, c.z) + 3, -12); }
  DIVE.life.visible = !!DIVE.on;
}
function shM2() { return VIL.shellMat || (VIL.shellMat = mat({ ds: true, grain: 4, ga: 0.2 })); }
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fe = new THREE.Euler(), _fs = new V3(), _fpv = new V3();
function updateLife2(dt) {
  if (!DIVE.schools) return; const t = G.t;
  for (const S of DIVE.schools) {
    const f = S.f, n = f.arr.length, clown = f.sp === 'clown';
    S.a += dt * (clown ? 0 : 0.12 + 0.6 / S.R);
    const gh = heightAt(S.c.x, S.c.z);
    for (let i = 0; i < n; i++) {
      const o = f.arr[i]; let x, y, z, hd;
      if (clown) { const an = DIVE.anems[i % Math.max(1, DIVE.anems.length)] || S.c, a = t * 1.2 + o.ph; x = an.x + Math.cos(a) * 0.45; z = an.z + Math.sin(a) * 0.45; y = an.y + 0.45 + Math.sin(t * 2 + o.ph) * 0.1; hd = -a; }
      else { const a = S.a + o.o.x * (f.sp === 'sardine' ? 0.35 : 1.4); x = S.c.x + Math.cos(a) * (S.R + o.o.z * 3); z = S.c.z + Math.sin(a) * (S.R + o.o.z * 3); const gg = heightAt(x, z); y = clamp(gg + 1.5 + (o.o.y + 0.5) * (f.sp === 'sardine' ? 3 : 4) + Math.sin(t + o.ph) * 0.3, gg + 0.6, -1.2); hd = -a; }
      // les poissons s'écartent du plongeur
      const dx = x - P.pos.x, dz = z - P.pos.z, dd = Math.hypot(dx, dz); if (dd < 2.5) { x += dx / dd * (2.5 - dd); z += dz / dd * (2.5 - dd); }
      _fe.set(0, hd, Math.sin(t * 3 + o.ph) * 0.08); _fq.setFromEuler(_fe); _fs.setScalar(o.s); _fpv.set(x, y, z); f.im.setMatrixAt(i, _fm.compose(_fpv, _fq, _fs));
    }
    f.im.instanceMatrix.needsUpdate = true;
  }
  for (const s of DIVE.sharks) {
    s.a += dt * s.sp * s.dir; const x = s.c.x + Math.cos(s.a) * s.R, z = s.c.z + Math.sin(s.a) * s.R, gg = heightAt(x, z), y = clamp(s.y + Math.sin(t * 0.3 + s.R) * 1.5, gg + 1.5, -2.5);
    const dx = x - P.pos.x, dz = z - P.pos.z, dd = Math.hypot(dx, dz); if (dd < 5) s.R += dt * 2; else if (s.R > 30) s.R -= dt * 0.5; // il garde ses distances
    s.m.position.set(x, y, z); s.m.rotation.set(0, -s.a + (s.dir > 0 ? 0 : Math.PI), Math.sin(t * 0.7) * 0.05);
  }
}
