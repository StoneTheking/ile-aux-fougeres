'use strict';
/* ============ L'Île aux Fougères — jeu : joueur, bras, objets, interface, sons (v2) ============ */
const $ = id => document.getElementById(id);
const G = { mode: 'walk', started: false, hour: 8.6, speed: 1, t: 0, windAuto: true, windBearing: 40, windStr: 0.6, wheel: false, menu: false, fragments: 0 };

/* ---------- jour / nuit (palette en couches façon Firewatch : horizon chaud, ombres froides) ---------- */
const NIGHT = { top: '#050a2a', mid: '#0e1c4a', hor: '#1f3468', sun: '#8aa4f0', sI: 0.36, hs: '#4a62b8', hg: '#22305a', hI: 0.72, glow: '#3a4a90', tint: '#3d4d95', cloud: '#1c2850', lit: '#46589a', star: 1, cov: 0.56 };
const KF = [
  Object.assign({ h: 0 }, NIGHT), Object.assign({ h: 4.6 }, NIGHT),
  { h: 6.0, top: '#2c4cb0', mid: '#f08a9a', hor: '#ffbe7a', sun: '#ffa060', sI: 0.8, hs: '#a090e8', hg: '#8a5c50', hI: 0.75, glow: '#ff8a50', tint: '#e0a0b0', cloud: '#8a5a90', lit: '#ffb48a', star: 0.1, cov: 0.53 },
  { h: 8.2, top: '#1466e0', mid: '#55b4f8', hor: '#f2ecc8', sun: '#ffe9b8', sI: 1.05, hs: '#b4d4ff', hg: '#a89858', hI: 0.78, glow: '#fff0c0', tint: '#ffffff', cloud: '#a8bce0', lit: '#ffffff', star: 0, cov: 0.56 },
  { h: 13, top: '#0f5fdc', mid: '#4eaef8', hor: '#eef0d4', sun: '#fff2d2', sI: 1.1, hs: '#bcdcff', hg: '#b0a25c', hI: 0.82, glow: '#fff4d0', tint: '#ffffff', cloud: '#b0c4e6', lit: '#ffffff', star: 0, cov: 0.57 },
  { h: 16.8, top: '#2a5cc8', mid: '#f8b070', hor: '#ffd070', sun: '#ffb45c', sI: 1.1, hs: '#a890e8', hg: '#a07050', hI: 0.75, glow: '#ffa040', tint: '#ffe4c4', cloud: '#a878a8', lit: '#ffd098', star: 0, cov: 0.54 },
  { h: 18.5, top: '#28247c', mid: '#d0468a', hor: '#ff7030', sun: '#ff6a38', sI: 0.85, hs: '#9a70e0', hg: '#8a4a68', hI: 0.9, glow: '#ff4a20', tint: '#e088a0', cloud: '#5a3078', lit: '#ff7a5a', star: 0.12, cov: 0.53 },
  { h: 20.0, top: '#0c144a', mid: '#2a2a78', hor: '#52388a', sun: '#8094e0', sI: 0.28, hs: '#5a6ac0', hg: '#2a3460', hI: 0.75, glow: '#52388a', tint: '#4a5598', cloud: '#221c50', lit: '#4a4690', star: 0.8, cov: 0.55 },
  Object.assign({ h: 24 }, NIGHT)
];
const CN = ['top', 'mid', 'hor', 'sun', 'hs', 'hg', 'glow', 'tint', 'cloud', 'lit'];
KF.forEach(k => { for (const n of CN) k[n] = new THREE.Color(k[n]); });
const SKY = { night: 0 }; CN.forEach(n => SKY[n] = new THREE.Color());
const sunDir = new V3(), moonDir = new V3(), _wc = new THREE.Color(1, 1, 1), _fc = new THREE.Color();
function updateSky(dt) {
  G.hour = (G.hour + dt * 24 / 720 * G.speed) % 24;
  let i = 0; while (i < KF.length - 2 && KF[i + 1].h <= G.hour) i++;
  const a = KF[i], b = KF[i + 1], t = clamp((G.hour - a.h) / (b.h - a.h), 0, 1);
  for (const n of CN) SKY[n].copy(a[n]).lerp(b[n], t);
  const sI = lerp(a.sI, b.sI, t), hI = lerp(a.hI, b.hI, t); SKY.night = lerp(a.star, b.star, t); SU.uCover.value = lerp(a.cov, b.cov, t);
  const hh = G.hour, ang = hh >= 5.7 && hh < 18.7 ? (hh - 5.7) / 13 * Math.PI : Math.PI + (((hh - 18.7) % 24 + 24) % 24) / 11 * Math.PI; // jour 13 h, nuit 11 h : aucune coupure à 0 h
  sunDir.set(Math.cos(ang), Math.sin(ang), 0.42).normalize(); moonDir.set(-Math.cos(ang), -Math.sin(ang), -0.3).normalize();
  // le soleil et la lune se relaient sans saut : chacun s'éteint en passant sous l'horizon
  const up = sunDir.y > 0, ld = up ? sunDir : moonDir, sv = smooth(-0.1, 0.03, sunDir.y);
  SU.uTop.value.copy(SKY.top); SU.uMid.value.copy(SKY.mid); SU.uHor.value.copy(SKY.hor); SU.uGlow.value.copy(SKY.glow);
  SU.uSun.value.copy(sv > 0.01 ? sunDir : moonDir); SU.uGlowK.value = sv > 0.01 ? sv : smooth(0.0, 0.2, moonDir.y) * 0.5 * smooth(-0.1, -0.3, sunDir.y); SU.uLitK.value = smooth(0.0, 0.16, Math.abs(sunDir.y));
  scene.fog.color.copy(SKY.hor).lerp(SKY.mid, 0.35); WU.uFog.value.copy(scene.fog.color); FOGU.uFSun.value.copy(SU.uSun.value); FOGU.uFSunCol.value.copy(scene.fog.color).lerp(_fc.copy(SKY.glow).lerp(SKY.hor, 0.35), SU.uGlowK.value); WU.uSunD.value.copy(ld); WU.uSunC.value.copy(SKY.sun).multiplyScalar(sI * smooth(0.0, 0.13, ld.y));
  SU.uSunP.value.copy(sunDir); SU.uMoonP.value.copy(moonDir); SU.uDiscC.value.copy(SKY.glow).lerp(_wc, 0.65); SU.uMoonK.value = smooth(0.05, 0.5, SKY.night); SU.uLightD.value.copy(ld); SU.uCloudLit.value.copy(SKY.lit); SU.uCloudShade.value.copy(SKY.cloud); WU.uTint.value.copy(SKY.tint); WU.uSky.value.copy(SKY.mid);
  sunLight.color.copy(SKY.sun).convertSRGBToLinear(); sunLight.intensity = sI * smooth(0.0, 0.13, ld.y);
  hemi.color.copy(SKY.hs).convertSRGBToLinear(); hemi.groundColor.copy(SKY.hg).convertSRGBToLinear(); hemi.intensity = hI;
  sunLight.target.position.copy(P.pos); sunLight.position.copy(P.pos).addScaledVector(ld, 220);
  const cp = camera.position;
  sky.position.copy(cp); stars.position.copy(cp); stars.material.opacity = SKY.night; stars.rotation.y = G.t * 0.0015;
  const w = U.wind.value; SU.uOff.value.x -= w.x * 0.011 * dt; SU.uOff.value.y -= w.y * 0.011 * dt; // les nuages filent dans le sens du vent (décalage de texture opposé au mouvement)
}
const BEAR = ['le nord', 'le nord-est', 'l\'est', 'le sud-est', 'le sud', 'le sud-ouest', 'l\'ouest', 'le nord-ouest'];
function updateWind() {
  const t = G.t;
  if (G.windAuto) G.windBearing = ((40 + 70 * Math.sin(t * 0.011) + 110 * Math.sin(t * 0.0043 + 1) + t * 0.3) % 360 + 360) % 360;
  G.windStr = clamp(0.58 + 0.3 * Math.sin(t * 0.017 + 2) + 0.14 * Math.sin(t * 0.05), 0.15, 1);
  const b = G.windBearing * Math.PI / 180, dx = Math.sin(b), dz = -Math.cos(b);
  U.wind.value.set(dx * G.windStr, dz * G.windStr); WU.uWind.value.set(dx, dz, G.windStr);
}

/* ---------- joueur et entrées ---------- */
const P = { pos: new V3(), vel: new V3(), vy: 0, yaw: 0, pitch: 0, ground: true, run: false, speed: 0, ph: 0, stepD: 0, eye: 1.66 };
const keys = {}, inp = { use: false, useHeld: false, act: false, jump: false, jumpHeld: false, down: false };
const look = { x: 0, y: 0 }, joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }, lookT = { id: -1, x: 0, y: 0 };
let locked = false, canLock = !TOUCH, lockFails = 0, drag = null, runToggle = false;
const camDir = new V3();
function setupInput() {
  addEventListener('keydown', e => {
    if (!G.started) return;
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) openWheel(); return; }
    if (e.repeat) return;
    if (BJ.on) return;
    if (VIL.talk && talkKey(e.code)) { e.preventDefault(); return; }
    if (TF.on && TF.mode === 'obj' && e.code === 'KeyR') { TF.ory += Math.PI / 8; return; }
    if (TF.on && e.ctrlKey && (e.key || '').toLowerCase() === 'z') { e.preventDefault(); undoTerra(); return; } // Ctrl+Z : annuler le dernier coup de pinceau
    keys[e.code] = true;
    if (G.started && G.mode && G.mode !== 'walk' && modeKey(e.code)) { e.preventDefault(); return; }
    if (e.code === 'KeyE') inp.act = true;
    if (e.code === 'Space') { inp.jump = true; e.preventDefault(); }
    if (e.code === 'KeyF') toggleTerra();
    if (e.code === 'KeyL' && !TF.on) toggleLantern();
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (TF.on) { const tb = $('tools').children[n]; if (tb) tb.click(); } else { const s = slots(); if (s[n]) equip(s[n].id); } }
  });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') closeWheel(true); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; inp.useHeld = false; });
  canvas.addEventListener('mousedown', e => {
    if (!G.started || TOUCH) return;
    if (!locked && canLock) { // juste après Échap, le navigateur refuse le verrouillage ~1 s : on réessaiera au clic suivant ; on n'abandonne qu'après 3 refus d'affilée
      const fail = () => { if (++lockFails >= 3) canLock = false; };
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch (_) { fail(); } drag = { d: 0, lockClick: true }; return; }
    if (!locked) { drag = { d: 0 }; if (TF.on && e.shiftKey) inp.useHeld = true; }
    else if (e.button === 0) { inp.use = true; inp.useHeld = true; }
  });
  addEventListener('mouseup', () => { if (drag && !drag.lockClick && drag.d < 6 && !locked) inp.use = true; drag = null; inp.useHeld = false; });
  addEventListener('mousemove', e => {
    if (G.wheel && locked) { wheelVec.x = clamp(wheelVec.x + e.movementX, -90, 90); wheelVec.y = clamp(wheelVec.y + e.movementY, -90, 90); wheelPick(); return; }
    if (locked || drag) { look.x += clamp(e.movementX, -120, 120); look.y += clamp(e.movementY, -120, 120); if (drag) drag.d += Math.abs(e.movementX) + Math.abs(e.movementY); }
  });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) lockFails = 0; if (!locked) { inp.useHeld = false; closeWheel(false); } });
  document.addEventListener('pointerlockerror', () => { canLock = false; });
  addEventListener('wheel', e => { if (!G.started || BJ.on) return; if (TF.on && TF.mode === 'obj') { TF.osz = clamp(TF.osz * (e.deltaY > 0 ? 0.9 : 1.1), 0.2, 4); $('osz').value = TF.osz; $('oszTxt').textContent = '×' + TF.osz.toFixed(2); return; } if (TF.on) { const s = $('sz'); s.value = clamp(+s.value - Math.sign(e.deltaY) * 2, 3, 60); s.oninput(); } else cycle(Math.sign(e.deltaY)); }, { passive: true });
  addEventListener('contextmenu', e => e.preventDefault());
  // tactile (coordonnées converties quand l'écran est tourné)
  const tz = $('touch'), jb = $('joy'), jk = jb.firstElementChild;
  tz.addEventListener('pointerdown', e => {
    const p = PT(e), vw = ROT ? innerHeight : innerWidth;
    if (p.x < vw * 0.42 && joy.id < 0) { joy.id = e.pointerId; joy.ox = p.x; joy.oy = p.y; joy.x = joy.y = 0; jb.style.display = 'block'; jb.style.left = p.x + 'px'; jb.style.top = p.y + 'px'; jk.style.transform = ''; }
    else if (lookT.id < 0) { lookT.id = e.pointerId; lookT.x = p.x; lookT.y = p.y; }
  });
  tz.addEventListener('pointermove', e => {
    const p = PT(e);
    if (e.pointerId === joy.id) { let dx = p.x - joy.ox, dy = p.y - joy.oy; const d = Math.hypot(dx, dy), m = 52; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; jk.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookT.id) { look.x += clamp(p.x - lookT.x, -80, 80) * 2.2; look.y += clamp(p.y - lookT.y, -80, 80) * 2.2; lookT.x = p.x; lookT.y = p.y; }
  });
  const end = e => { if (e.pointerId === joy.id) { joy.id = -1; joy.x = joy.y = 0; jb.style.display = 'none'; } if (e.pointerId === lookT.id) lookT.id = -1; };
  tz.addEventListener('pointerup', end); tz.addEventListener('pointercancel', end);
  const hold = (id, dn, up) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dn(el); }); const u = e => { e.stopPropagation(); up && up(el); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', u); };
  hold('bUse', () => { inp.use = true; inp.useHeld = true; }, () => { inp.useHeld = false; });
  hold('bJump', () => { inp.jump = true; inp.jumpHeld = true; }, () => { inp.jumpHeld = false; });
  hold('bDown', () => { inp.down = true; }, () => { inp.down = false; });
  hold('bAct', () => { inp.act = true; });
  hold('bInv', () => { G.wheel ? closeWheel(false) : openWheel(); });
  hold('bRun', el => { runToggle = !runToggle; el.classList.toggle('on', runToggle); });
}
const WADE = -0.85; // profondeur maximale : on ne nage pas
function updatePlayer(dt) {
  if (!G.wheel) { const s = (TOUCH ? 0.0024 : 0.0021) * (camera.fov / 68); P.yaw -= look.x * s; P.pitch = clamp(P.pitch - look.y * s, -1.5, 1.5); }
  look.x = look.y = 0;
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y, s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const il = Math.hypot(f, s); if (il > 1) { f /= il; s /= il; }
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const gh = heightAt(P.pos.x, P.pos.z), wl = waterLevel(P.pos.x, P.pos.z), onFloor = floorAt(P.pos.x, P.pos.z) > -Infinity;
  P.run = (keys.ShiftLeft || keys.ShiftRight || runToggle) && il > 0.1;
  if (TF.on) {
    const sp = (P.run ? 60 : 22) * dt, cp = Math.cos(P.pitch);
    P.pos.x += (-sy * cp * f + cy * s) * sp; P.pos.z += (-cy * cp * f - sy * s) * sp;
    P.pos.y += (Math.sin(P.pitch) * f + ((keys.Space || inp.jumpHeld) ? 1 : 0) - ((keys.KeyC || inp.down) ? 1 : 0)) * sp;
    P.pos.y = Math.max(P.pos.y, Math.max(gh, 0) + 0.3); P.speed = 0; P.vy = 0;
    camera.position.set(P.pos.x, P.pos.y + P.eye, P.pos.z);
  } else {
    const base = P.run ? 8.2 : 4.5; let sp = base;
    const wet = gh < wl - 0.3 && !onFloor; if (wet) sp *= lerp(0.75, 0.45, smooth(-0.3, WADE, gh));
    if (il > 0.05 && !onFloor) { const ah = heightAt(P.pos.x + (-sy * f + cy * s) * 0.8, P.pos.z + (-cy * f - sy * s) * 0.8), g = (ah - gh) / 0.8; if (g > 0.85) sp *= clamp(1.65 - g * 0.6, 0.12, 1); }
    const k = 1 - Math.exp(-(P.ground ? 11 : 3) * dt);
    P.vel.x += ((-sy * f + cy * s) * sp - P.vel.x) * k; P.vel.z += ((-cy * f - sy * s) * sp - P.vel.z) * k;
    const ox = P.pos.x, oz = P.pos.z;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
    collide(P.pos, 0.35); collideWalls(P.pos, 0.35);
    // pente trop raide : on ne monte pas (on peut toujours descendre)
    const steep = (x, z) => { const d = Math.hypot(x - ox, z - oz); return d > 1e-5 && floorAt(x, z) === -Infinity && (heightAt(x, z) - heightAt(ox, oz)) / d > 0.95 && heightAt(x, z) > P.pos.y + 0.02; };
    if (steep(P.pos.x, P.pos.z)) { if (!steep(P.pos.x, oz)) { P.pos.z = oz; P.vel.z *= 0.3; } else if (!steep(ox, P.pos.z)) { P.pos.x = ox; P.vel.x *= 0.3; } else { P.pos.x = ox; P.pos.z = oz; P.vel.x *= 0.2; P.vel.z *= 0.2; } }
    if (P.ground && floorAt(P.pos.x, P.pos.z) === -Infinity) { const e = 0.6, gx = (heightAt(P.pos.x + e, P.pos.z) - heightAt(P.pos.x - e, P.pos.z)) / (2 * e), gz = (heightAt(P.pos.x, P.pos.z + e) - heightAt(P.pos.x, P.pos.z - e)) / (2 * e), gm = Math.hypot(gx, gz); if (gm > 1.05) { const k2 = (gm - 1.05) * 14 * dt; P.vel.x -= gx / gm * k2; P.vel.z -= gz / gm * k2; } }
    if (heightAt(P.pos.x, P.pos.z) < WADE && floorAt(P.pos.x, P.pos.z) === -Infinity) { // l'eau profonde arrête le joueur
      if (heightAt(P.pos.x, oz) >= WADE) { P.pos.z = oz; P.vel.z = 0; } else if (heightAt(ox, P.pos.z) >= WADE) { P.pos.x = ox; P.vel.x = 0; } else { P.pos.x = ox; P.pos.z = oz; P.vel.x = P.vel.z = 0; }
      hint('deep', '« La mer est profonde ici. Il faudra un bateau. »');
    }
    const g2 = groundAt(P.pos.x, P.pos.z);
    if (inp.jump && P.ground) { P.vy = 6.6; P.ground = false; sfxStep('jump'); }
    P.vy -= 21 * dt; P.pos.y += P.vy * dt;
    if (P.pos.y <= g2) { if (!P.ground && P.vy < -6) sfxStep('land'); P.pos.y = g2; P.vy = 0; P.ground = true; }
    else if (P.ground && P.pos.y - g2 < 0.5) P.pos.y = g2; else P.ground = false;
    P.speed = Math.hypot(P.vel.x, P.vel.z);
    if (P.speed > 0.5) { P.ph += dt * (P.run ? 11 : 7.4) * clamp(P.speed / base, 0.4, 1.2); P.stepD += P.speed * dt; }
    if (P.stepD > (P.run ? 2.4 : 1.55) && P.ground) { P.stepD = 0; sfxStep(onFloor ? 'wood' : gh < wl + 0.05 ? 'water' : gh < 2.5 ? 'sand' : slopeAt(P.pos.x, P.pos.z) > 0.6 || gh > 60 ? 'rock' : 'grass'); }
    const bob = P.ground && P.speed > 0.5 ? Math.sin(P.ph * 2) * (P.run ? 0.05 : 0.028) : 0;
    camera.position.set(P.pos.x, P.pos.y + P.eye + bob, P.pos.z);
  }
  inp.jump = false;
  camera.rotation.set(P.pitch, P.yaw, P.ground && P.speed > 0.5 && !TF.on ? Math.sin(P.ph) * 0.004 : 0);
  camera.getWorldDirection(camDir);
  WU.uCam.value.copy(camera.position);
}

/* ---------- bras et objets ---------- */
const FR = { apple: 0, cherry: 0, orange: 0, lemon: 0, berry: 0, pebble: 0, shell: 0, scallop: 0, star: 0 };
const PICK = [{ id: 'pebble', veg: 'Galet', hs: 0.13, hy: 0.03 }, { id: 'shell', veg: 'Coquillage spiralé', hs: 1.4, hy: 0.03 }, { id: 'scallop', veg: 'Coquille en éventail', hs: 1.3, hy: 0.02 }, { id: 'star', veg: 'Étoile de mer', hs: 1.3, hy: 0.02 }];
const ITEMS = {
  hands: { name: 'Mains libres', icon: '✋' },
  shovel: { name: 'Pelle', icon: '<svg viewBox="0 0 32 32"><path d="M21 3l8 8-3 3-2-2-9 9 2 2c2 3 1 7-3 9-4 1-9 0-11-2s-3-7-2-11c2-4 6-5 9-3l2 2 9-9-2-2z" fill="currentColor"/></svg>' },
  compass: { name: 'Boussole', icon: '🧭' },
  apple: { name: 'Pomme', icon: '🍎', un: 'une pomme' }, cherry: { name: 'Cerises', icon: '🍒', un: 'des cerises' }, orange: { name: 'Orange', icon: '🍊', un: 'une orange' },
  lemon: { name: 'Citron', icon: '🍋', un: 'le citron' }, berry: { name: 'Baies', icon: '🫐', un: 'des baies' },
  pebble: { name: 'Galet', icon: '🪨', un: 'le galet' }, shell: { name: 'Coquillage', icon: '🐚', un: 'le coquillage' }, scallop: { name: 'Coquille', icon: '🐚', un: 'la coquille' }, star: { name: 'Étoile de mer', icon: '⭐', un: 'l\'étoile de mer' },
  spyglass: { name: 'Longue-vue', icon: '🔭' }, lantern: { name: 'Lanterne', icon: '🏮' }
};
let held = 'hands', pendingHeld = null, equipT = 0, digT = 0, throwT = 0, digDone = false, throwDone = false;
let armW, armL2, lantern, lanternLight, spyG; const WATCH = {}; let watchK = 0, zoomK = 0, lanternOn = false, lanternK = 0;
let armR, armL, fistR, openR, anchorF, anchorO, needle, compassG; const HELD = {};
const POSE = { spyglass: [0.2, -0.24, -0.42, 0.1, 0.25, 0.1], hidden: [0.36, -0.9, -0.25, 0.9, 0.3, 0], shovel: [0.25, -0.2, -0.5, -0.05, 0.3, 0.3], compass: [0.09, -0.25, -0.42, 0.22, 0.25, 0], fruit: [0.25, -0.27, -0.5, 0.3, 0.35, 0] };
const curR = POSE.hidden.slice(), curL = POSE.hidden.slice();
// mains façon Firewatch : grandes formes lisses, doigts épais et effilés, manche de chemise retroussée
const SKIN = '#e3a77f', SKIN2 = '#cf8e6a', CLOTH = '#a8915c', CLOTH2 = '#8a7546';
function rbox(sx, sy, sz, e = 0.4) { // boîte arrondie (super-ellipsoïde)
  const g = new THREE.SphereGeometry(1, 22, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = v => Math.sign(v) * Math.pow(Math.abs(v), e); p.setXYZ(i, f(p.getX(i)) * sx, f(p.getY(i)) * sy, f(p.getZ(i)) * sz); }
  g.computeVertexNormals(); return g;
}
function finger(gb, pts, r0, r1) {
  const P2 = new THREE.CatmullRomCurve3(pts).getPoints(LOW ? 6 : 12), n = P2.length - 1;
  tube(gb, P2, i => lerp(r0, r1 === undefined ? r0 * 0.82 : r1, i / n) * (1 + 0.07 * Math.sin(i / n * Math.PI * 2.6)), i => i > n * 0.8 ? '#e8ad8a' : SKIN, 12, 0.02);
  const a = P2[0], e = P2[n]; gb.add(SPH, SKIN, M(a.x, a.y, a.z, r0 * 1.02), 0.25); gb.add(SPH, '#e8ad8a', M(e.x, e.y, e.z, (r1 === undefined ? r0 * 0.82 : r1) * 1.0), 0.25);
}
function forearm(gb, w0, w1, el, watch) {
  const pts = new THREE.CatmullRomCurve3([w0, w1, w1.clone().lerp(el, 0.45).add(new V3(0, 0.006, 0)), el]).getPoints(16);
  tube(gb, pts, i => { const t = i / 16; return t < 0.12 ? lerp(0.028, 0.03, t / 0.12) : 0.03 + 0.019 * smooth(0.15, 0.85, t) + 0.004 * Math.sin(t * 3.14); }, SKIN, 16, 0.02);
  const d = new V3().subVectors(el, w1).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d), tm = (p, s2) => new THREE.Matrix4().compose(p, q, new V3(s2, s2, s2));
  if (watch) { // bracelet en cuir + boîtier (le cadran vivant est ajouté à part)
    const wp = w1.clone().addScaledVector(d, 0.03);
    gb.add(new THREE.TorusGeometry(0.033, 0.0075, 8, 20), '#4a3020', tm(wp, 1).multiply(new THREE.Matrix4().makeScale(1, 1, 1.6)), 0.25);
  }
  const sp = el.clone().addScaledVector(d, -0.04), se = el.clone().addScaledVector(d, 0.6); se.y -= 0.05; // manche retroussée en deux plis
  gb.add(new THREE.TorusGeometry(0.052, 0.02, 10, 22), CLOTH2, tm(sp, 1), 0.3); gb.add(new THREE.TorusGeometry(0.056, 0.019, 10, 22), CLOTH, tm(sp.clone().addScaledVector(d, 0.032), 1), 0.3);
  tube(gb, [sp.clone().addScaledVector(d, 0.04), sp.clone().addScaledVector(d, 0.3), se], i => [0.068, 0.078, 0.09][i], CLOTH, 14, 0.04);
}
function buildFistGeo(watch) { // poing fermé autour d'un manche vertical passant par l'origine
  const gb = new GB();
  gb.add(rbox(0.021, 0.05, 0.043), SKIN, M(0.038, -0.002, 0.012), 0.3);
  for (let i = 0; i < 4; i++) { const y = 0.037 - i * 0.025, r = i === 3 ? 0.0112 : 0.0128; finger(gb, [new V3(0.044, y, -0.024), new V3(0.026, y + 0.002, -0.046), new V3(-0.004, y, -0.05), new V3(-0.026, y - 0.002, -0.028), new V3(-0.024, y - 0.003, -0.002)], r, r * 0.9); }
  gb.add(SPH, SKIN2, M(0.034, -0.006, 0.042, 0.018, 0.034, 0.02), 0.3); // éminence du pouce
  finger(gb, [new V3(0.036, 0.022, 0.044), new V3(0.016, 0.052, 0.026), new V3(-0.006, 0.058, 0.002), new V3(-0.02, 0.054, -0.016)], 0.0145, 0.012);
  forearm(gb, new V3(0.04, -0.002, 0.03), new V3(0.05, -0.02, 0.1), new V3(0.09, -0.1, 0.42), watch);
  return gb.build();
}
function buildOpenGeo(arm = true) { // main ouverte, paume vers le haut, doigts légèrement repliés
  const gb = new GB();
  gb.add(rbox(0.048, 0.017, 0.052), SKIN, M(0, 0, -0.004), 0.3);
  gb.add(SPH, SKIN2, M(-0.03, 0.006, 0.014, 0.022, 0.016, 0.028), 0.25);
  [[-0.033, 0.88], [-0.011, 1], [0.011, 0.96], [0.032, 0.78]].forEach(([x, L], i) => finger(gb, [new V3(x, 0.003, -0.046), new V3(x * 1.04, 0.011, -0.046 - 0.036 * L), new V3(x * 1.07, 0.028, -0.046 - 0.062 * L), new V3(x * 1.08, 0.048, -0.046 - 0.074 * L)], i === 3 ? 0.0106 : 0.0122, i === 3 ? 0.0088 : 0.0098));
  finger(gb, [new V3(-0.042, 0.002, 0.004), new V3(-0.064, 0.014, -0.022), new V3(-0.072, 0.03, -0.044), new V3(-0.07, 0.044, -0.058)], 0.0142, 0.0112);
  if (arm) forearm(gb, new V3(0, -0.004, 0.03), new V3(0.012, -0.02, 0.1), new V3(0.07, -0.11, 0.42));
  return gb.build();
}
// cadran de montre dessiné en direct : aiguilles à l'heure du jeu
function watchFace() {
  const g = new THREE.Group(), cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), C = 128;
  x.fillStyle = '#efe6cf'; x.beginPath(); x.arc(C, C, C, 0, 7); x.fill(); x.strokeStyle = '#3a3226';
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.2832, r0 = i % 5 ? 112 : 98; x.lineWidth = i % 5 ? 2 : 6; x.beginPath(); x.moveTo(C + Math.sin(a) * r0, C - Math.cos(a) * r0); x.lineTo(C + Math.sin(a) * 120, C - Math.cos(a) * 120); x.stroke(); }
  x.font = 'bold 40px Georgia,serif'; x.fillStyle = '#2d2620'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [[12, 0], [3, 1], [6, 2], [9, 3]].forEach(([n, k]) => { const a = k * 1.5708; x.fillText(n, C + Math.sin(a) * 74, C - Math.cos(a) * 74); });
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const R = 0.024;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.18, R * 1.22, 0.008, 28), new THREE.MeshLambertMaterial({ color: lin('#b9a46a') })); rim.position.y = -0.003; g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.MeshBasicMaterial({ map: tex })); face.rotation.x = -Math.PI / 2; face.position.y = 0.0012; g.add(face);
  const hand = (len, w, col, y) => { const h = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.z = -len * 0.4; h.add(m); h.position.y = y; g.add(h); return h; };
  g.userData.h = hand(R * 0.62, 0.0032, 0x1e1a16, 0.0016); g.userData.m = hand(R * 0.9, 0.0022, 0x1e1a16, 0.0019); g.userData.s = hand(R * 0.95, 0.0009, 0xa02818, 0.0021);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 10), new THREE.MeshBasicMaterial({ color: 0x1e1a16 })); cap.position.y = 0.0024; g.add(cap);
  return g;
}
function setWatch(w) { const h = G.hour, u = w.userData; u.h.rotation.y = -(h % 12) / 12 * 6.2832; u.m.rotation.y = -(h % 1) * 6.2832; u.s.rotation.y = -((h * 60) % 1) * 6.2832; }
function gridGeo(nu, nv, fn) {
  const p = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const v = fn(i / nu * 2 - 1, j / nv); p.push(v[0], v[1], v[2]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildItems() {
  const am = mat({ ds: true, ga: 0 }), im = mat({ ds: true, ga: 0 });
  armR = new THREE.Group(); armL = new THREE.Group(); camera.add(armR, armL);
  const fg = buildFistGeo(false); fistR = new THREE.Mesh(fg, am); openR = new THREE.Mesh(buildOpenGeo(), am); armR.add(fistR, openR);
  const fl = new THREE.Mesh(buildFistGeo(true), am); armL.add(fl); armL.scale.x = -1;
  // montre au poignet gauche (cadran vivant)
  { const wf = watchFace(), d = new V3(0.04, -0.08, 0.32).normalize(), wp = new V3(0.05, -0.02, 0.1).addScaledVector(d, 0.03); wf.position.copy(wp).add(new V3(0.024, 0.016, 0)); wf.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(0.85, 0.53, 0).normalize()); wf.scale.setScalar(0.85); armL.add(wf); WATCH.small = wf; }
  // bras levé pour lire l'heure (touche M)
  armW = new THREE.Group(); camera.add(armW);
  { const gb = new GB(); forearm(gb, new V3(0.035, 0, 0), new V3(-0.02, 0, 0), new V3(-0.44, -0.02, 0.0), true); const fa = new THREE.Mesh(gb.build(), am); fa.rotation.set(0, 0, 0); armW.add(fa);
    const hm = new THREE.Mesh(buildOpenGeo(false), am); hm.rotation.set(Math.PI, Math.PI / 2, 0, 'YXZ'); hm.position.set(0.075, 0.004, 0); hm.rotation.z = -0.25; armW.add(hm);
    const wf = watchFace(); wf.position.set(-0.05, 0.047, 0); wf.rotation.z = 0; armW.add(wf); WATCH.big = wf;
    armW.position.set(0.02, -0.5, -0.36); armW.rotation.set(1.05, 0.5, 0.15, 'YXZ'); armW.visible = false; }
  anchorF = new THREE.Group(); anchorO = new THREE.Group(); anchorO.position.set(0, 0.02, -0.03); armR.add(anchorF, anchorO);
  // pelle : manche en frêne, poignée en D, douille rivetée, fer galbé à bout arrondi
  let gb = new GB();
  limb(gb, new V3(0, -0.62, 0), new V3(0, 0.4, 0), 0.0165, 0.0185, '#a07a4c', 9, 0.1);
  limb(gb, new V3(0, -0.6, 0), new V3(0.055, -0.71, 0), 0.012, 0.01, '#5d646b', 6, 0.05); limb(gb, new V3(0, -0.6, 0), new V3(-0.055, -0.71, 0), 0.012, 0.01, '#5d646b', 6, 0.05);
  limb(gb, new V3(-0.066, -0.72, 0), new V3(0.066, -0.72, 0), 0.016, 0.016, '#7d5a36', 8, 0.1); gb.add(SPHL, '#7d5a36', M(-0.066, -0.72, 0, 0.016), 0.2); gb.add(SPHL, '#7d5a36', M(0.066, -0.72, 0, 0.016), 0.2);
  limb(gb, new V3(0, 0.34, 0), new V3(0, 0.5, 0.006), 0.021, 0.027, '#59616a', 9, 0.06); gb.add(SPHL, '#3f454c', M(0, 0.4, 0.024, 0.006), 0);
  const bw = v => 0.108 * (v < 0.12 ? lerp(0.8, 1, v / 0.12) : v < 0.55 ? 1 : Math.pow(Math.cos((v - 0.55) / 0.45 * Math.PI / 2), 0.55));
  gb.add(gridGeo(8, 9, (u, v) => [u * bw(v), 0.47 + v * 0.34, 0.012 - 0.042 * u * u * (1 - v * 0.4) + v * 0.035 + (v < 0.1 ? 0.012 * (1 - v / 0.1) : 0)]), '#a9b1b8', M(0, 0, 0), 0.25, 0.07);
  { const cb = []; for (let i = 0; i <= 12; i++) { const u = i / 6 - 1; cb.push(new V3(u * 0.098, 0.476, 0.028 - 0.042 * u * u)); } tube(gb, cb, 0.0075, '#8a929a', 8, 0.03, () => 0); gb.add(SPHL, '#8a929a', M(cb[0].x, cb[0].y, cb[0].z, 0.0075), 0.2); gb.add(SPHL, '#8a929a', M(cb[12].x, cb[12].y, cb[12].z, 0.0075), 0.2); } // barre d'appui qui suit la courbe du fer limb(gb, new V3(0, 0.48, 0.01), new V3(0, 0.64, 0.024), 0.024, 0.006, '#7c858d', 7, 0.05);
  HELD.shovel = new THREE.Mesh(gb.build(), im); HELD.shovel.rotation.set(-0.55, 0, 0); HELD.shovel.userData.a = anchorF;
  // boussole : boîtier en laiton, couvercle ouvert, rose des vents, aiguille sur pivot
  compassG = new THREE.Group(); gb = new GB();
  gb.add(lathe([[0.001, -0.012], [0.056, -0.012], [0.063, -0.006], [0.064, 0.008], [0.06, 0.013], [0.056, 0.013], [0.055, 0.006]], 28), '#b8923f', M(0, 0, 0), 0.3, 0.05);
  gb.add(new THREE.TorusGeometry(0.057, 0.0045, 6, 28), '#dcbc68', M(0, 0.013, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.2);
  gb.add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), '#8f6f2c', M(0, 0.008, -0.066, 1, 1, 1, 0, 0, Math.PI / 2), 0.2);
  const lidM = new THREE.Matrix4().makeTranslation(0, 0.008, -0.066).multiply(new THREE.Matrix4().makeRotationX(-1.95)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.064));
  gb.add(lathe([[0.001, 0.006], [0.058, 0.006], [0.064, 0], [0.058, -0.004], [0.001, -0.004]], 28), '#b8923f', lidM, 0.3, 0.05);
  gb.add(new THREE.CircleGeometry(0.05, 24), '#e9dcb8', lidM.clone().multiply(M(0, -0.0045, 0, 1, 1, 1, Math.PI / 2, 0, 0)), 0.1);
  gb.add(new THREE.TorusGeometry(0.013, 0.0035, 5, 12), '#dcbc68', M(0, 0, 0.076, 1, 1, 1, Math.PI / 2, 0, 0), 0.2);
  compassG.add(new THREE.Mesh(gb.build(), im));
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), C = 128;
  x.fillStyle = '#f3ead0'; x.beginPath(); x.arc(C, C, C, 0, 7); x.fill();
  const gr = x.createRadialGradient(C, C, 40, C, C, C); gr.addColorStop(0, '#f3ead000'); gr.addColorStop(1, '#b89a5a66'); x.fillStyle = gr; x.beginPath(); x.arc(C, C, C, 0, 7); x.fill();
  x.strokeStyle = '#5a4a30';
  for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36, r0 = i % 9 === 0 ? 100 : i % 3 === 0 ? 108 : 113; x.lineWidth = i % 9 === 0 ? 3 : 1.2; x.beginPath(); x.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); x.lineTo(C + Math.cos(a) * 120, C + Math.sin(a) * 120); x.stroke(); }
  x.lineWidth = 1.5; x.beginPath(); x.arc(C, C, 121, 0, 7); x.stroke(); x.beginPath(); x.arc(C, C, 62, 0, 7); x.stroke();
  const star = (len, wid, rot, fill) => { for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; x.fillStyle = fill[i % 2]; x.beginPath(); x.moveTo(C + Math.cos(a) * len, C + Math.sin(a) * len); x.lineTo(C + Math.cos(a + 1.57) * wid, C + Math.sin(a + 1.57) * wid); x.lineTo(C, C); x.fill(); x.fillStyle = fill[(i + 1) % 2]; x.beginPath(); x.moveTo(C + Math.cos(a) * len, C + Math.sin(a) * len); x.lineTo(C + Math.cos(a - 1.57) * wid, C + Math.sin(a - 1.57) * wid); x.lineTo(C, C); x.fill(); } };
  star(58, 9, Math.PI / 4, ['#9a8a62', '#cbbd92']); star(84, 12, 0, ['#4a3f2a', '#b5a476']);
  x.font = 'bold 30px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#b0301f'; x.fillText('N', C, 32); x.fillStyle = '#3f3524'; x.fillText('S', C, 226); x.fillText('E', 226, C + 1); x.fillText('O', 30, C + 1);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.0545, 32), new THREE.MeshLambertMaterial({ map: tex }));
  face.rotation.x = -Math.PI / 2; face.position.y = 0.0065; compassG.add(face);
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute([-0.006, 0, 0, 0.006, 0, 0, 0, 0, -0.044, 0.006, 0, 0, -0.006, 0, 0, 0, 0, 0.044], 3));
  ng.setAttribute('color', new THREE.Float32BufferAttribute([0.75, 0.08, 0.06, 0.75, 0.08, 0.06, 0.95, 0.2, 0.12, 0.25, 0.3, 0.42, 0.25, 0.3, 0.42, 0.4, 0.46, 0.6], 3));
  needle = new THREE.Group(); needle.add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshLambertMaterial({ color: lin('#dcbc68') })); needle.add(cap); needle.position.y = 0.011; compassG.add(needle);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.055, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0135; compassG.add(glass);
  compassG.position.set(0, 0.022, -0.03); compassG.userData.a = anchorO; HELD.compass = compassG;
  // longue-vue : trois tubes en laiton, gaine de cuir, oculaire
  gb = new GB();
  tube(gb, [new V3(0, 0, 0.12), new V3(0, 0, -0.06)], 0.026, '#6b3f22', 16, 0.05, () => 0);
  tube(gb, [new V3(0, 0, -0.06), new V3(0, 0, -0.2)], 0.022, '#c9a24a', 16, 0.03, () => 0);
  tube(gb, [new V3(0, 0, -0.2), new V3(0, 0, -0.32)], 0.0185, '#d8b45a', 16, 0.03, () => 0);
  [[0.12, 0.027], [-0.06, 0.028], [-0.2, 0.024], [-0.32, 0.021]].forEach(([z, r]) => gb.add(new THREE.TorusGeometry(r, 0.004, 6, 18), '#e2c46a', M(0, 0, z), 0.2));
  gb.add(new THREE.CircleGeometry(0.019, 18), '#1d2a35', M(0, 0, -0.322, 1, 1, 1, Math.PI, 0, 0), 0); gb.add(new THREE.CircleGeometry(0.02, 18), '#2a2420', M(0, 0, 0.123), 0);
  spyG = new THREE.Mesh(gb.build(), im); spyG.position.set(0, 0.0, -0.05); spyG.rotation.set(-1.45, 0, 0); spyG.userData.a = anchorF; HELD.spyglass = spyG;
  // lanterne (main gauche, touche L) : cage de laiton, verre lumineux, flamme
  lantern = new THREE.Group(); gb = new GB();
  gb.add(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 16), '#3a3632', M(0, -0.12, 0), 0.3); gb.add(new THREE.ConeGeometry(0.07, 0.06, 16), '#3a3632', M(0, 0.07, 0), 0.3);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; limb(gb, new V3(Math.cos(a) * 0.055, -0.11, Math.sin(a) * 0.055), new V3(Math.cos(a) * 0.05, 0.045, Math.sin(a) * 0.05), 0.0045, 0.0045, '#2e2a26', 5, 0); }
  gb.add(new THREE.TorusGeometry(0.035, 0.005, 6, 16, Math.PI), '#2e2a26', M(0, 0.1, 0), 0.2); gb.add(SPHL, '#2e2a26', M(0, 0.135, 0, 0.012), 0.2);
  lantern.add(new THREE.Mesh(gb.build(), im));
  const lglass = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.15, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); lglass.position.y = -0.03; lantern.add(lglass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); flame.scale.set(1, 1.9, 1); flame.position.y = -0.04; lantern.add(flame); lantern.userData.flame = flame; lantern.userData.glass = lglass;
  lantern.position.set(0.012, -0.17, -0.01);
  armL2 = new THREE.Group(); camera.add(armL2); const fl2 = new THREE.Mesh(buildFistGeo(true), am); armL2.add(fl2, lantern); armL2.scale.x = -1; armL2.visible = false;
  { const wf = watchFace(), d = new V3(0.04, -0.08, 0.32).normalize(), wp = new V3(0.05, -0.02, 0.1).addScaledVector(d, 0.03); wf.position.copy(wp).add(new V3(0.024, 0.016, 0)); wf.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(0.85, 0.53, 0).normalize()); wf.scale.setScalar(0.85); armL2.add(wf); WATCH.lan = wf; }
  lanternLight = new THREE.PointLight(0xffb060, 0, 16, 1.6); lanternLight.position.set(-0.3, -0.25, -0.4); camera.add(lanternLight);
  for (const t of PICK) { const e = VEG.find(q => q.key === t.veg); const m = new THREE.Mesh(e.geo, im); m.scale.setScalar(t.hs); m.position.set(0, t.hy, -0.03); m.userData.a = anchorO; HELD[t.id] = m; }
  for (const t in FR) { if (HELD[t]) continue; const m = new THREE.Mesh(gFruit(t), im); m.scale.setScalar(0.8); m.position.set(0, t === 'cherry' ? 0.07 : t === 'berry' ? 0.035 : 0.085, -0.03); if (t === 'lemon') m.position.y = 0.07; m.userData.a = anchorO; HELD[t] = m; }
  for (const k in HELD) { HELD[k].visible = false; HELD[k].userData.a.add(HELD[k]); }
  setHandMesh();
}
function setHandMesh() { const open = held === 'compass' || FR[held] !== undefined; openR.visible = open; fistR.visible = !open; }
function slots() { const l = ['hands', 'shovel', 'compass', 'spyglass', 'lantern']; if (G.hasRod) l.push('rod'); for (const t in FR) if (FR[t] > 0) l.push(t); return l.map(id => ({ id, ...ITEMS[id], n: FR[id] })); }
function equip(id) { if (id === 'lantern') { toggleLantern(); return; } if (id === held && !pendingHeld) return; pendingHeld = id; equipT = 1; sfx('equip'); }
function toggleLantern() { lanternOn = !lanternOn; sfx(lanternOn ? 'lanternOn' : 'equip'); }
function cycle(d) { const s = slots(), i = s.findIndex(q => q.id === (pendingHeld || held)); equip(s[(i + d + s.length) % s.length].id); }
function showItemLabel() { }
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e1 = new THREE.Euler();
let needleA = 0, needleV = 0;
function updateArms(dt) {
  if (G.mode && G.mode !== 'walk' && G.mode !== 'turtle') { armR.visible = armL.visible = armL2.visible = armW.visible = false; lanternLight.intensity = G.mode === 'dive' ? 0 : lanternLight.intensity; return; }
  const mv = P.speed > 0.6, run = P.run && mv && P.ground, sw = Math.sin(P.ph), cw = Math.cos(P.ph), hid = POSE.hidden;
  let tR = hid, tL = hid;
  const runR = [0.27, -0.3 + 0.035 * cw, -0.42 + 0.1 * sw, 0.42 - 0.3 * sw, 0.28, 0.25], runL = [0.27, -0.3 - 0.035 * cw, -0.42 - 0.1 * sw, 0.42 + 0.3 * sw, 0.28, 0.25];
  if (TF.on) { }
  else if (held !== 'hands') {
    tR = (POSE[held] || POSE.fruit).slice();
    const br = Math.sin(G.t * 1.6) * 0.004; tR[1] += br;
    if (mv) { tR[1] += Math.sin(P.ph * 2) * 0.012; tR[0] += sw * 0.008; }
    if (run) { tR[2] += sw * 0.035; tR[3] += sw * 0.08; tR[1] -= 0.03; tL = runL; }
  } else if (run) { tR = runR; tL = runL; }
  if (digT > 0) tL = [0.0, -0.33, -0.44, 0.1, 0.7, 0.5];
  const k = 1 - Math.exp(-13 * dt);
  for (let i = 0; i < 6; i++) { curR[i] += (tR[i] - curR[i]) * k; curL[i] += (tL[i] - curL[i]) * k; }
  const o = [0, 0, 0, 0, 0, 0];
  if (equipT > 0) {
    equipT -= dt * 3.4; o[1] -= 0.55 * Math.sin(Math.PI * clamp(equipT, 0, 1));
    if (pendingHeld && equipT < 0.5) { held = pendingHeld; pendingHeld = null; for (const h in HELD) HELD[h].visible = h === held; setHandMesh(); showItemLabel(); }
  }
  if (digT > 0) {
    digT -= dt * (G.up.shovel ? 2.6 : 1.6); const t = 1 - Math.max(digT, 0); let py, pz, rx;
    if (t < 0.35) { const u = smooth(0, 0.35, t); py = 0.14 * u; pz = 0.08 * u; rx = 0.35 * u; }
    else if (t < 0.52) { const u = smooth(0.35, 0.52, t); py = 0.14 - 0.34 * u; pz = 0.08 - 0.3 * u; rx = 0.35 - 0.95 * u; }
    else { const u = smooth(0.52, 1, t); py = -0.2 * (1 - u) + 0.05 * Math.sin(u * Math.PI); pz = -0.22 * (1 - u); rx = -0.6 * (1 - u) + 0.25 * Math.sin(u * Math.PI); }
    o[1] += py; o[2] += pz; o[3] += rx;
    if (t > 0.5 && !digDone) { digDone = true; digImpact(); }
  }
  if (throwT > 0) {
    throwT -= dt * 2.6; const t = 1 - Math.max(throwT, 0);
    if (t < 0.4) { const u = smooth(0, 0.4, t); o[1] += 0.14 * u; o[2] += 0.2 * u; o[3] -= 0.6 * u; }
    else if (t < 0.58) { const u = smooth(0.4, 0.58, t); o[1] += 0.14 - 0.2 * u; o[2] += 0.2 - 0.5 * u; o[3] += -0.6 + 1.3 * u; }
    else { const u = smooth(0.58, 1, t); o[1] -= 0.06 * (1 - u); o[2] -= 0.3 * (1 - u); o[3] += 0.7 * (1 - u); }
    if (t > 0.5 && !throwDone) { throwDone = true; releaseThrow(); }
  }
  armR.position.set(curR[0] + o[0], curR[1] + o[1], curR[2] + o[2]); armR.rotation.set(curR[3] + o[3], curR[4], curR[5]);
  const dl = digT > 0 ? 1 : 0;
  armL.position.set(-curL[0], curL[1] + o[1] * dl, curL[2] + o[2] * dl); armL.rotation.set(curL[3] + o[3] * dl * 0.5, -curL[4], -curL[5]);
  armR.visible = armR.position.y > -0.85; armL.visible = armL.position.y > -0.85;
  const kk = 1 - Math.exp(-9 * dt);
  // longue-vue : clic maintenu pour viser, le champ se resserre
  const wantZ = held === 'spyglass' && inp.useHeld && !TF.on && !G.wheel && equipT <= 0 && !BJ.on;
  zoomK += ((wantZ ? 1 : 0) - zoomK) * (1 - Math.exp(-6 * dt));
  const fov = lerp(68, G.up.spyglass ? 6 : 13, smooth(0.15, 1, zoomK)); if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  $('spy').style.opacity = smooth(0.45, 0.85, zoomK).toFixed(3);
  if (held === 'spyglass') { const z = smooth(0, 0.6, zoomK); armR.position.x = lerp(armR.position.x, 0.03, z); armR.position.y = lerp(armR.position.y, -0.06, z); armR.position.z = lerp(armR.position.z, -0.12, z); armR.rotation.x = lerp(armR.rotation.x, 0.0, z); if (zoomK > 0.6) armR.visible = false; }
  // lanterne dans la main gauche
  lanternK += ((lanternOn ? 1 : 0) - lanternK) * kk;
  armL2.visible = lanternK > 0.02 && watchK < 0.5 && !BJ.on; if (armL2.visible) armL.visible = false;
  if (armL2.visible) { const b = mv ? Math.sin(P.ph * 2) * 0.012 : Math.sin(G.t * 1.5) * 0.004; armL2.position.set(-0.24, lerp(-0.95, -0.2, lanternK) + b - (run ? 0.04 : 0), -0.48); armL2.rotation.set(0.05, -0.3, 0.05); lantern.rotation.z = (mv ? Math.sin(P.ph) * 0.18 : 0) + Math.sin(G.t * 1.1) * 0.04 - P.vel.x * 0.0; lantern.rotation.x = -0.05 + (mv ? Math.cos(P.ph) * 0.1 : 0); }
  const fl = 0.85 + 0.1 * Math.sin(G.t * 23) * Math.sin(G.t * 7.3) + 0.05 * Math.sin(G.t * 41);
  lanternLight.intensity = lanternK * fl * (0.5 + 1.2 * SKY.night) * (G.up.lantern ? 1.8 : 1); lanternLight.distance = G.up.lantern ? 30 : 16; lantern.userData.flame.scale.set(1, 1.9 * fl, 1); lantern.userData.glass.material.opacity = 0.3 + 0.25 * fl;
  // montre : maintenir M
  const wantW = !!keys.KeyM && !TF.on && !BJ.on && !G.wheel;
  watchK += ((wantW ? 1 : 0) - watchK) * kk; armW.visible = watchK > 0.01;
  if (armW.visible) { const w = smooth(0, 1, watchK); armW.position.set(lerp(-0.12, 0.0, w), lerp(-0.62, -0.17, w), -0.34); armW.rotation.set(lerp(0.5, 1.02, w), lerp(0.9, 0.42, w), lerp(0.5, 0.12, w), 'YXZ'); if (watchK > 0.3) { armL.visible = false; armL2.visible = false; } setWatch(WATCH.big); }
  setWatch(WATCH.small); setWatch(WATCH.lan);
  if (held === 'compass') {
    _q1.copy(armR.quaternion).invert(); compassG.quaternion.copy(_q1).multiply(_q2.setFromEuler(_e1.set(0.9, 0, 0)));
    let tgA = 0; if (G.up.compass) { let bd = 1e9; for (const dg of DIGS) if (!dg.done) { const dd = Math.hypot(dg.x - P.pos.x, dg.z - P.pos.z); if (dd < bd) { bd = dd; tgA = Math.atan2(-(dg.x - P.pos.x), -(dg.z - P.pos.z)); } } }
    let d = tgA - P.yaw - needleA; d = Math.atan2(Math.sin(d), Math.cos(d));
    needleV += (d * 50 - needleV * 6) * dt; needleA += needleV * dt; needle.rotation.y = needleA;
  }
}

/* ---------- fruits lancés, creusage, particules ---------- */
const shots = [], parts = [], DIGS = [];
const POEM = [
  'Sous le sable, la mer garde ses lettres.', 'Chaque fougère est une main ouverte vers la pluie.', 'Le vent ne possède rien, et pourtant tout lui obéit.',
  'Les marées sont la respiration d\'un géant qui rêve.', 'Celui qui creuse trouve d\'abord le silence.', 'La montagne se souvient d\'avoir été une île plus petite.',
  'Aucune carte ne dit où commence le soir.', 'Tu es arrivé à la nage ; tu repartiras plus léger.'
];
function buildDigs() {
  const defs = [[1.25, 1.3, 2.0], [0.3, 4, 9], [2.6, 4, 10], [3.6, 1.3, 2.2], [4.4, 12, 22], [5.3, 5, 12], [1.9, 24, 36], [4.9, 44, 60]];
  const gb = new GB(); gb.add(ICO, '#5d412a', M(0, 0.04, 0, 0.78, 0.26, 0.78), 0.4, 0.15);
  for (let i = 0; i < 7; i++) gb.add(ICO0, '#4f3724', M(Math.cos(i * 0.9) * 0.55, 0.1, Math.sin(i * 0.9) * 0.55, 0.12 + (i % 3) * 0.04), 0.4, 0.1);
  gb.add(new THREE.BoxGeometry(0.9, 0.045, 0.12), '#c9ad78', M(0, 0.32, 0, 1, 1, 1, 0, 0.78, 0.05), 0.2, 0.1); gb.add(new THREE.BoxGeometry(0.9, 0.045, 0.12), '#b89a66', M(0, 0.355, 0, 1, 1, 1, 0, -0.78, -0.05), 0.2, 0.1);
  const geo = gb.build(), m = mat({ grain: 6, ga: 0.4 });
  defs.forEach((d, i) => {
    const s = findSpot(d[0], d[1], d[2], 0.45), me = new THREE.Mesh(geo, m); me.castShadow = true;
    me.position.set(s.x, heightAt(s.x, s.z), s.z); me.rotation.y = i; scene.add(me); DIGS.push({ x: s.x, z: s.z, mesh: me, hits: 0, done: false, i });
  });
  const pg = new THREE.IcosahedronGeometry(0.06, 0), pm = new THREE.MeshLambertMaterial({ color: lin('#5d412a') });
  for (let i = 0; i < 26; i++) { const me = new THREE.Mesh(pg, pm); me.visible = false; scene.add(me); parts.push({ m: me, v: new V3(), life: 0 }); }
}
function burst(p, n, up) { let c = 0; for (const q of parts) { if (q.life > 0) continue; q.life = 0.9; q.m.visible = true; q.m.position.copy(p); q.m.scale.setScalar(0.6 + Math.random() * 1.2); q.v.set((Math.random() - 0.5) * 3, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 3); if (++c >= n) break; } }
function nearDig() { for (const d of DIGS) if (!d.done && Math.hypot(d.x - P.pos.x, d.z - P.pos.z) < 2.7) return d; return null; }
function digImpact() {
  const p = new V3(P.pos.x - Math.sin(P.yaw) * 1.1, 0, P.pos.z - Math.cos(P.yaw) * 1.1); p.y = heightAt(p.x, p.z) + 0.1;
  const d = nearDig(); sfx('dig');
  if (!d) { burst(p, 4, 2.5); hint('dig', '« La terre est trop dure ici. Cherche la terre meuble, marquée d\'une croix. »'); return; }
  d.hits++; burst(d.mesh.position.clone().setY(d.mesh.position.y + 0.2), 9, 4.5);
  d.mesh.scale.setScalar(1 - d.hits * 0.22); d.mesh.position.y -= 0.05;
  if (d.hits >= 3) {
    d.done = true; d.mesh.visible = false; G.fragments++;
    brushAt(d.x, d.z, 2.4, (k, f) => { H[k] -= 0.55 * f; }); reseatAll(); sfx('found');
    toast('« ' + POEM[d.i] + ' »<small>Fragment ' + G.fragments + ' / ' + POEM.length + '</small>', 7000);
  }
}
function releaseThrow() {
  if (FR[held] === undefined || FR[held] <= 0) return;
  const type = held; FR[type]--; sfx('throw');
  const m = new THREE.Mesh(HELD[type].geometry, HELD[type].material); m.scale.setScalar({ pebble: 0.22, shell: 1.1, scallop: 1.0, star: 1.0 }[type] || 1.2); /* galets et coquillages à leur taille au sol */ m.castShadow = true;
  m.position.copy(camera.position).addScaledVector(camDir, 0.6); m.position.y -= 0.12; scene.add(m);
  shots.push({ m, type, v: camDir.clone().multiplyScalar(15).add(new V3(P.vel.x, 3.2, P.vel.z)), rest: false, wet: false, life: 40 });
  if (shots.length > 26) scene.remove(shots.shift().m);
  if (FR[type] <= 0) equip('hands'); else showItemLabel();
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; if (s.life <= 0) { scene.remove(s.m); shots.splice(i, 1); continue; }
    const p = s.m.position, gh = heightAt(p.x, p.z), wl = waterLevel(p.x, p.z);
    if (s.wet) { p.y += (wl - 0.03 - p.y) * Math.min(1, dt * 5); p.x += U.wind.value.x * dt * 0.3; p.z += U.wind.value.y * dt * 0.3; if (gh > wl - 0.05) { s.wet = false; s.rest = true; p.y = gh + 0.09; } continue; }
    if (s.rest) { p.y = gh + 0.09; continue; }
    s.v.y -= 20 * dt; p.addScaledVector(s.v, dt); s.m.rotation.x += dt * 9; s.m.rotation.z += dt * 6;
    if (p.y < wl && gh < wl - 0.25) { s.wet = true; s.life = Math.min(s.life, 25); sfx('splash'); }
    else if (p.y < gh + 0.09) { p.y = gh + 0.09; if (s.v.length() > 3) { s.v.y = Math.abs(s.v.y) * 0.34; s.v.x *= 0.55; s.v.z *= 0.55; sfx('thud'); } else { s.rest = true; } }
  }
  for (const q of parts) { if (q.life <= 0) continue; q.life -= dt; q.v.y -= 14 * dt; q.m.position.addScaledVector(q.v, dt); if (q.life <= 0) q.m.visible = false; }
  if (G.t % 1 < dt) for (const f of FRUITS) if (f.picked && G.t > f.regrow) setFruit(f, false);
}
let target = null;
function findTarget() {
  const cp = camera.position; let best = null, bs = 0.9;
  if (TF.on) return null;
  for (const s of shots) { if (!s.rest) continue; const dx = s.m.position.x - cp.x, dy = s.m.position.y - cp.y, dz = s.m.position.z - cp.z, d = Math.hypot(dx, dy, dz); if (d > 2.9) continue; const dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / d; if (dot > bs - 0.12) { bs = dot + 0.12; best = { shot: s, type: s.type }; } }
  for (const f of FRUITS) { if (f.picked) continue; const dx = f.x - cp.x, dz = f.z - cp.z; if (dx * dx + dz * dz > 16) continue; const dy = f.y - cp.y, d = Math.hypot(dx, dy, dz); if (d > 3.9) continue; const dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / d; if (dot > bs) { bs = dot; best = { fruit: f, type: f.type }; } }
  if (!TF.on) for (const t of PICK) { const e = VEG.find(q => q.key === t.veg); for (const tl of e.tiles) { if (Math.hypot(tl.cx - cp.x, tl.cz - cp.z) > tl.rad + 4) continue; tl.list.forEach((it, i) => { if (it.dead) return; const dx = it.x - cp.x, dz = it.z - cp.z; if (dx * dx + dz * dz > 9) return; const dy = heightAt(it.x, it.z) + 0.05 - cp.y, d = Math.hypot(dx, dy, dz), dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / d; if (dot > bs) { bs = dot; best = { veg: e, item: it, tile: tl, idx: i, type: t.id }; } }); } }
  { const vt = villageTarget(); if (vt) return vt; }
  if (boatObj && !TF.on && Math.hypot(BOAT.pos.x - P.pos.x, BOAT.pos.z - P.pos.z) < 4.6) return { boat: 1 };
  if (!best) { const d = nearDig(); if (d) best = { dig: d }; }
  return best;
}
function updateInteract() {
  target = findTarget(); const pr = $('prompt'), ba = $('bAct');
  let txt = '';
  if (target && target.npc) txt = VIL.talk ? '' : '<b>E</b>Parler à ' + target.npc.name;
  else if (target && target.banjo) txt = '<b>E</b>Jouer du banjo';
  else if (target && target.boat) txt = '<b>E</b>Monter à bord';
  else if (target && target.type) txt = '<b>E</b>' + (target.shot || target.veg ? 'Ramasser ' : 'Cueillir ') + ITEMS[target.type].un;
  else if (target && target.dig) txt = held === 'shovel' ? '<b>Clic</b>Creuser' : 'Prends ta pelle pour creuser ici';
  if (TF.on) txt = '';
  if (pr.dataset.t !== txt) { pr.dataset.t = txt; pr.innerHTML = txt; pr.style.opacity = txt ? 1 : 0; }
  ba.classList.toggle('show', !!(target && (target.type || target.npc || target.banjo || target.boat)));
  if (inp.act && target && !VIL.talk && target.npc) { openTalk(target.npc); inp.act = false; }
  else if (inp.act && VIL.talk) { chooseTalk(); inp.act = false; }
  if (inp.act && target && target.banjo) { startBanjo(); inp.act = false; }
  if (inp.act && target && target.boat) { boardBoat(); inp.act = false; return; }
  if (inp.use && held === 'rod' && !G.wheel && equipT <= 0 && !TF.on) FISH.click = true;
  if (inp.act && target && target.type) {
    if (target.fruit) { setFruit(target.fruit, true); target.fruit.regrow = G.t + 150; } else if (target.veg) { target.item.dead = true; target.tile.mesh.setMatrixAt(target.idx, _im.makeScale(0, 0, 0)); target.tile.mesh.instanceMatrix.needsUpdate = true; } else { scene.remove(target.shot.m); shots.splice(shots.indexOf(target.shot), 1); }
    FR[target.type]++; sfx('pick'); equip(target.type); if (held === target.type) showItemLabel();
    if (target.type === 'lemon') hint('lemon', '« Il n\'y a qu\'un citronnier sur l\'île. Il le sait. »');
  }
  if (inp.use && !TF.on && !G.wheel && equipT <= 0) {
    if (held === 'spyglass') { }
    else if (held === 'shovel' && digT <= 0) { digT = 1; digDone = false; sfx('swing'); }
    else if (FR[held] > 0 && throwT <= 0) { throwT = 1; throwDone = false; }
  }
  inp.act = false; inp.use = false;
}

/* ---------- interface ---------- */
let toastTimer = 0; const hinted = {};
function toast() { }
function hint() { }
const wheelVec = { x: 0, y: 0 }; let wheelSlots = [], wheelSel = -1;
function openWheel() {
  if (!G.started || TF.on || G.wheel) return; G.wheel = true; wheelVec.x = wheelVec.y = 0; wheelSlots = slots(); wheelSel = -1;
  const ring = $('ring'); ring.querySelectorAll('.slot').forEach(e => e.remove());
  wheelSlots.forEach((s, i) => {
    const a = -Math.PI / 2 + i / wheelSlots.length * Math.PI * 2, el = document.createElement('div');
    el.className = 'slot' + (s.id === held ? ' on' : ''); el.style.left = 150 + Math.cos(a) * 116 + 'px'; el.style.top = 150 + Math.sin(a) * 116 + 'px';
    el.innerHTML = s.icon + (s.n ? '<small>× ' + s.n + '</small>' : '');
    el.addEventListener('pointerdown', e => { e.stopPropagation(); wheelSel = i; closeWheel(true); });
    ring.appendChild(el); s.el = el;
  });
  $('wname').textContent = ITEMS[held].name; $('wheel').style.display = 'flex';
}
function wheelPick() {
  if (Math.hypot(wheelVec.x, wheelVec.y) < 22) return;
  const n = wheelSlots.length, a = Math.atan2(wheelVec.y, wheelVec.x) + Math.PI / 2;
  wheelSel = ((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n;
  wheelSlots.forEach((s, i) => s.el.classList.toggle('on', i === wheelSel)); $('wname').textContent = wheelSlots[wheelSel].name;
}
function closeWheel(sel) { if (!G.wheel) return; G.wheel = false; $('wheel').style.display = 'none'; if (sel && wheelSel >= 0) equip(wheelSlots[wheelSel].id); }
$('wheel').addEventListener('pointerdown', () => closeWheel(false));
function setShadows(on) { sunLight.castShadow = on; renderer.shadowMap.enabled = on; $('shadows').classList.toggle('on', on); scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); }); }
function setupMenu() {
  const menu = $('menu');
  $('menuBtn').onclick = () => { G.menu = !G.menu; menu.style.display = G.menu ? 'block' : 'none'; if (G.menu && document.exitPointerLock) document.exitPointerLock(); };
  $('hour').oninput = e => { G.hour = +e.target.value % 24; };
  $('speed').querySelectorAll('button').forEach(b => b.onclick = () => { G.speed = +b.dataset.v; $('speed').querySelectorAll('button').forEach(q => q.classList.toggle('on', q === b)); });
  $('windAuto').onclick = e => { G.windAuto = !G.windAuto; e.target.classList.toggle('on', G.windAuto); };
  $('windDir').oninput = e => { G.windAuto = false; $('windAuto').classList.remove('on'); G.windBearing = +e.target.value; };
  $('sound').onclick = e => { AU.on = !AU.on; e.target.classList.toggle('on', AU.on); if (AU.master) AU.master.gain.value = AU.on ? 0.9 : 0; };
  renderer.shadowMap.enabled = !LOW; sunLight.castShadow = !LOW; $('shadows').classList.toggle('on', !LOW);
  $('shadows').onclick = () => setShadows(!sunLight.castShadow);
  $('terraBtn').onclick = () => { toggleTerra(); G.menu = false; menu.style.display = 'none'; };
  setInterval(() => {
    if (!G.menu) return; const h = G.hour | 0, m = (G.hour % 1) * 60 | 0; $('hourTxt').textContent = h + ' h ' + String(m).padStart(2, '0');
    if (document.activeElement !== $('hour')) $('hour').value = G.hour; if (G.windAuto) $('windDir').value = G.windBearing;
    $('windTxt').textContent = 'vers ' + BEAR[Math.round(G.windBearing / 45) % 8] + ' · force ' + Math.max(1, Math.round(G.windStr * 5)) + '/5';
  }, 250);
}

/* ---------- terraformation ---------- */
const TF = { mode: 'terre', osel: 0, osz: 1, ory: 0, odel: false, ghost: null, gkey: '', on: false, tool: 'up', size: 14, str: 8, hit: null, flatH: 0, was: false, ring: null, dirty: false, undo: [] };
function brushAt(cx, cz, r, fn) {
  const i0 = Math.max(0, Math.floor((cx - r + TS / 2) / TC)), i1 = Math.min(TN - 1, Math.ceil((cx + r + TS / 2) / TC)), j0 = Math.max(0, Math.floor((cz - r + TS / 2) / TC)), j1 = Math.min(TN - 1, Math.ceil((cz + r + TS / 2) / TC));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(-TS / 2 + i * TC - cx, -TS / 2 + j * TC - cz) / r; if (d < 1) { const f = (1 - d * d) * (1 - d * d); fn(j * TN + i, f, i, j); } }
  refreshTerrain(i0 - 1, i1 + 1, j0 - 1, j1 + 1);
}
function terraRay() {
  const o = camera.position, d = camDir; let prev = 0;
  for (let t = 0.5; t < 700; t += Math.max(0.8, t * 0.03)) {
    if (o.y + d.y * t < Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), -15.9)) { let a = prev, b = t; for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (o.y + d.y * m < heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } return new V3(o.x + d.x * b, 0, o.z + d.z * b); }
    prev = t;
  }
  return null;
}
function undoTerra() { const h = TF.undo.pop(); if (!h) return; H.set(h); refreshTerrain(0, TN - 1, 0, TN - 1); TF.dirty = true; sfx('dig'); }
function toggleTerra() {
  if (!G.started) return; TF.on = !TF.on; $('terra').style.display = TF.on ? 'block' : 'none'; document.body.classList.toggle('terra', TF.on); $('terraBtn').classList.toggle('on', TF.on);
  closeWheel(false); TF.ring.visible = TF.on;
  if (TF.on) { P.pos.y += 6; toast('<small style="font-size:17px">Mode terraformation : tu voles. Vise le sol et maintiens ' + (TOUCH ? '« Utiliser »' : 'le clic') + '.</small>', 5000); }
  else {
    if (TF.dirty) { reseatAll(); buildCoastDist(); DIGS.forEach(d => d.mesh.position.y = heightAt(d.x, d.z)); TF.dirty = false; try { localStorage.setItem('ile-terrain2', encodeIsland()); } catch (_) { } } // sauvegarde automatique
    if (heightAt(P.pos.x, P.pos.z) < WADE) { const s = SPOTS.spawn; P.pos.set(s.x, heightAt(s.x, s.z), s.z); }
    P.vy = 0; P.ground = false;
  }
}
function setupTerra() {
  const pts = new Float32Array(65 * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  TF.ring = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe27a, depthTest: false, transparent: true, fog: false })); TF.ring.frustumCulled = false; TF.ring.visible = false; TF.ring.renderOrder = 5; scene.add(TF.ring);
  $('tools').querySelectorAll('button').forEach(b => b.onclick = () => { TF.tool = b.dataset.t; $('tools').querySelectorAll('button').forEach(q => q.classList.toggle('on', q === b)); });
  $('sz').oninput = () => { TF.size = +$('sz').value; $('szTxt').textContent = TF.size + ' m'; }; $('st').oninput = () => { TF.str = +$('st').value; $('stTxt').textContent = TF.str; };
  $('sz').oninput(); $('st').oninput();
  $('tHint').innerHTML = TOUCH ? 'Joystick pour voler, « Saut » et ▼ pour monter et descendre. Maintiens « Utiliser » pour sculpter au centre de l\'écran.' : 'ZQSD pour voler, Espace et C pour monter et descendre, Maj pour accélérer. Clic maintenu pour sculpter, molette pour la taille, touches 1 à 6 pour l\'outil, Ctrl+Z pour annuler. Échap libère la souris pour ce panneau, F quitte le mode.';
  const code = $('tCode'), say = s => { $('tHint').textContent = s; };
  $('tSave').onclick = () => { try { localStorage.setItem('ile-terrain2', encodeIsland()); say('Île sauvegardée dans ce navigateur.'); } catch (_) { say('Sauvegarde impossible ici : utilise « Copier » pour garder le code de l\'île.'); } };
  $('tCopy').onclick = () => { const s = encodeIsland(); const fb = () => { code.style.display = 'block'; code.value = s; code.select(); say('Copie automatique refusée : sélectionne et copie le code ci-dessus.'); }; try { navigator.clipboard.writeText(s).then(() => say('Code de l\'île copié. Garde-le dans une note pour le recoller plus tard.'), fb); } catch (_) { fb(); } };
  $('tPaste').onclick = () => { if (code.style.display !== 'block') { code.style.display = 'block'; code.value = ''; say('Colle le code dans la zone puis appuie de nouveau sur « Coller ».'); return; } if (decodeIsland(code.value.trim())) { refreshTerrain(0, TN - 1, 0, TN - 1); TF.dirty = true; code.style.display = 'none'; say('Île chargée.'); } else say('Ce code n\'est pas reconnu.'); };
  $('tReset').onclick = () => { generateIsland(); refreshTerrain(0, TN - 1, 0, TN - 1); TF.dirty = true; try { localStorage.removeItem('ile-terrain2'); } catch (_) { } say('Île d\'origine restaurée.'); };
  $('tQuit').onclick = toggleTerra;
  // onglets relief / objets
  const sel = $('oSel'); objList().forEach((e, i) => { const o = document.createElement('option'); o.value = i; o.textContent = e.name; sel.appendChild(o); });
  sel.onchange = () => { TF.osel = +sel.value; };
  $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { TF.mode = b.dataset.m; $('tabs').querySelectorAll('button').forEach(q => q.classList.toggle('on', q === b)); $('pTerre').style.display = TF.mode === 'terre' ? 'block' : 'none'; $('pObj').style.display = TF.mode === 'obj' ? 'block' : 'none'; });
  $('oMode').querySelectorAll('button').forEach(b => b.onclick = () => { TF.odel = b.dataset.d === '1'; $('oMode').querySelectorAll('button').forEach(q => q.classList.toggle('on', q === b)); });
  $('osz').oninput = () => { TF.osz = +$('osz').value; $('oszTxt').textContent = '×' + TF.osz.toFixed(2); }; $('osz').oninput();
  $('oRot').onclick = () => { TF.ory += Math.PI / 8; };
  $('oReset').onclick = () => { EDITS = { add: [], del: [] }; saveEdits(); $('tHint').textContent = 'Les objets d\'origine reviendront au prochain chargement.'; };
  $('oHint').textContent = TOUCH ? '« Utiliser » pour poser ou supprimer au centre de l\'écran.' : 'Clic : poser ou supprimer · R : tourner · molette : taille. Tout est sauvegardé automatiquement.';
  const more = $('tMore'), tt = $('tTitle'); if (TOUCH) more.style.display = 'none';
  tt.onclick = () => { more.style.display = more.style.display === 'none' ? 'block' : 'none'; tt.textContent = 'Terraformation ' + (more.style.display === 'none' ? '▾' : '▴'); }; tt.textContent = 'Terraformation ' + (TOUCH ? '▾' : '▴');
}
function encodeIsland() { const a = new Int16Array(H.length); for (let i = 0; i < H.length; i++) a[i] = clamp(Math.round(H[i] * 100), -32768, 32767); const b = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return 'ILE2:' + btoa(s); }
function decodeIsland(str) { try { if (!str || !str.startsWith('ILE2:')) return false; const s = atob(str.slice(5)); if (s.length !== H.length * 2) return false; const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); const a = new Int16Array(b.buffer); for (let i = 0; i < H.length; i++) H[i] = a[i] / 100; return true; } catch (_) { return false; } }
/* ---------- éditeur d'objets : poser, tourner, redimensionner, supprimer ---------- */
let EDITS = { add: [], del: [] };
function saveEdits() { try { localStorage.setItem('ile-edits1', JSON.stringify(EDITS)); } catch (_) { } }
function vegByKey(k) { return VEG.find(e => e.key === k); }
function addItem(e, x, z, s, ry, sy) { const it = { x, z, s, ry, sy: sy || 1, c: [1, 1, 1], added: 1 }; e.items.push(it); if (e.col) addCol(x, z, e.col * s, e.climb ? e.climb * s * (sy || 1) : Infinity); return it; }
function applyEdits() {
  try { const t = JSON.parse(localStorage.getItem('ile-edits1') || 'null'); if (t && t.add) EDITS = t; } catch (_) { }
  const touched = new Set();
  for (const d of EDITS.del) { const e = vegByKey(d.k); if (!e) continue; let b = null, bd = 0.6; for (const it of e.items) { if (it.dead) continue; const dd = Math.hypot(it.x - d.x, it.z - d.z); if (dd < bd) { bd = dd; b = it; } } if (b) { b.dead = true; if (e.col) removeCol(b.x, b.z); touched.add(e); } }
  for (const a of EDITS.add) { const e = vegByKey(a.k); if (!e) continue; addItem(e, a.x, a.z, a.s, a.ry, a.sy); touched.add(e); }
  touched.forEach(buildE); seatFruits();
}
function objList() { return VEG.filter(e => !/^Herbe/.test(e.name)); }
function setGhost() {
  const e = objList()[TF.osel]; if (!e) return; if (TF.gkey === e.key && TF.ghost) return;
  if (TF.ghost) scene.remove(TF.ghost);
  TF.ghost = new THREE.Mesh(e.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })); TF.ghost.renderOrder = 4; scene.add(TF.ghost); TF.gkey = e.key;
}
function nearestItem(x, z, r) { let best = null, bd = r; for (const e of VEG) { if (/^Herbe/.test(e.name)) continue; for (const it of e.items) { if (it.dead) continue; const d = Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; best = { e, it }; } } } return best; }
function updateObj() {
  const c = TF.hit, pa = TF.ring.geometry.attributes.position;
  if (TF.odel) {
    if (TF.ghost) TF.ghost.visible = false;
    const n = c && nearestItem(c.x, c.z, 3.5); TF.ring.visible = !!n;
    if (n) { const rr = Math.max(0.5, (n.e.col || 0.3) * n.it.s + 0.3); for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.2832, x = n.it.x + Math.cos(a) * rr, z = n.it.z + Math.sin(a) * rr; pa.setXYZ(i, x, heightAt(x, z) + 0.15, z); } pa.needsUpdate = true; TF.ring.material.color.set(0xff6a5a); }
    if (n && inp.use) {
      n.it.dead = true; if (n.e.col) removeCol(n.it.x, n.it.z);
      if (n.it.added) { const k = EDITS.add.findIndex(a => a.k === n.e.key && Math.abs(a.x - n.it.x) < 0.01 && Math.abs(a.z - n.it.z) < 0.01); if (k >= 0) EDITS.add.splice(k, 1); n.e.items.splice(n.e.items.indexOf(n.it), 1); }
      else EDITS.del.push({ k: n.e.key, x: +n.it.x.toFixed(2), z: +n.it.z.toFixed(2) });
      buildE(n.e); seatFruits(); saveEdits(); sfx('dig');
    }
  } else {
    setGhost(); TF.ring.visible = false; if (!TF.ghost) return; TF.ghost.visible = !!c; if (!c) return;
    const e = objList()[TF.osel]; TF.ghost.position.set(c.x, heightAt(c.x, c.z) - e.sink * TF.osz, c.z); TF.ghost.rotation.y = TF.ory; TF.ghost.scale.setScalar(TF.osz);
    if (inp.use) { const it = addItem(e, c.x, c.z, TF.osz, TF.ory, 1); EDITS.add.push({ k: e.key, x: +c.x.toFixed(2), z: +c.z.toFixed(2), s: +TF.osz.toFixed(3), ry: +TF.ory.toFixed(3), sy: 1 }); buildE(e); saveEdits(); sfx('pick'); TF.ory += 0.7 + Math.random(); }
  }
}
function updateTerra(dt) {
  if (!TF.on) { if (TF.ghost) TF.ghost.visible = false; return; }
  if (TF.mode === 'obj') { TF.hit = terraRay(); updateObj(); inp.use = false; return; }
  if (TF.ghost) TF.ghost.visible = false; TF.ring.material.color.set(0xffe27a);
  TF.hit = terraRay(); TF.ring.visible = !!TF.hit; if (!TF.hit) { TF.was = false; return; }
  const c = TF.hit, pa = TF.ring.geometry.attributes.position;
  for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.2832, x = c.x + Math.cos(a) * TF.size, z = c.z + Math.sin(a) * TF.size; pa.setXYZ(i, x, Math.max(heightAt(x, z), 0) + 0.25, z); }
  pa.needsUpdate = true;
  const act = inp.useHeld && !G.menu;
  if (act) {
    if (!TF.was) { TF.flatH = heightAt(c.x, c.z); TF.undo.push(H.slice()); if (TF.undo.length > 20) TF.undo.shift(); }
    const a = TF.str * dt, tool = TF.tool;
    brushAt(c.x, c.z, TF.size, (k, f, i, j) => {
      if (tool === 'up') H[k] += a * f; else if (tool === 'down') H[k] -= a * f;
      else if (tool === 'flat') H[k] += (TF.flatH - H[k]) * Math.min(1, a * 0.35 * f);
      else if (tool === 'noise') { const x = -TS / 2 + i * TC, z = -TS / 2 + j * TC; H[k] += (fbm(x * 0.06 + 31, z * 0.06 - 17, 3) - 0.45) * a * 0.9 * f; } // bosses et creux naturels
      else if (tool === 'terrace') { const st = 2.5, tgt = Math.round(H[k] / st) * st; H[k] += (tgt - H[k]) * Math.min(1, a * 0.3 * f); } // marches tous les 2,5 m
      else if (i > 0 && j > 0 && i < TN - 1 && j < TN - 1) { const m = (H[k - 1] + H[k + 1] + H[k - TN] + H[k + TN]) / 4; H[k] += (m - H[k]) * Math.min(1, a * 0.5 * f); }
      H[k] = clamp(H[k], -16, 150);
    });
    TF.dirty = true;
  }
  TF.was = act; inp.use = false;
}

/* ---------- sons ---------- */
const AU = { ctx: null, on: true, nextBird: 3, nextGull: 8, nextMusic: 6 };
function initAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.9; AU.uw = ctx.createBiquadFilter(); AU.uw.type = 'lowpass'; AU.uw.frequency.value = 22000; AU.master.connect(AU.uw); AU.uw.connect(ctx.destination);
    AU.delay = ctx.createDelay(1); AU.delay.delayTime.value = 0.39; const fb = ctx.createGain(); fb.gain.value = 0.42; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    AU.delay.connect(lp); lp.connect(fb); fb.connect(AU.delay); lp.connect(AU.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
    const loop = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(AU.master); s.start(); return { f, g }; };
    AU.ocean = loop('lowpass', 480, 0.3); AU.hiss = loop('highpass', 3200, 0.3); AU.wind = loop('bandpass', 420, 0.8); AU.leaves = loop('highpass', 2300, 0.4);
    const o = ctx.createOscillator(); o.frequency.value = 4350; const g1 = ctx.createGain(); g1.gain.value = 0.5; const l1 = ctx.createOscillator(); l1.type = 'square'; l1.frequency.value = 26; const lg = ctx.createGain(); lg.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.5; const l2 = ctx.createOscillator(); l2.type = 'square'; l2.frequency.value = 1.4; const lg2 = ctx.createGain(); lg2.gain.value = 0.5;
    AU.crick = ctx.createGain(); AU.crick.gain.value = 0; l1.connect(lg); lg.connect(g1.gain); l2.connect(lg2); lg2.connect(g2.gain); o.connect(g1); g1.connect(g2); g2.connect(AU.crick); AU.crick.connect(AU.master); o.start(); l1.start(); l2.start();
  } catch (_) { AU.ctx = null; }
}
function tone(freqs, dur, type, vol, t0 = 0, echo = 0) {
  const c = AU.ctx; if (!c) return; const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(freqs[0], t); for (let i = 1; i < freqs.length; i++) o.frequency.linearRampToValueAtTime(freqs[i], t + dur * i / (freqs.length - 1));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); if (echo) { const e = c.createGain(); e.gain.value = echo; g.connect(e); e.connect(AU.delay); } o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(type, freq, q, dur, vol, t0 = 0, f2) {
  const c = AU.ctx; if (!c) return; const t = c.currentTime + t0, s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random() * 2, dur + 0.05);
}
function sfx(n) {
  if (!AU.ctx) return;
  if (n === 'pick') { tone([520, 780], 0.09, 'sine', 0.12); noiseHit('highpass', 2500, 0.5, 0.08, 0.05); }
  else if (n === 'equip') noiseHit('bandpass', 900, 1, 0.12, 0.05, 0, 400);
  else if (n === 'swing') noiseHit('bandpass', 500, 1.2, 0.22, 0.06, 0.05, 1400);
  else if (n === 'throw') noiseHit('bandpass', 700, 1.5, 0.2, 0.09, 0, 2200);
  else if (n === 'dig') { noiseHit('lowpass', 900, 0.8, 0.2, 0.3, 0, 200); noiseHit('highpass', 2600, 0.6, 0.28, 0.07, 0.05); tone([110, 60], 0.14, 'sine', 0.25); }
  else if (n === 'thud') { tone([150, 70], 0.1, 'sine', 0.15); noiseHit('lowpass', 500, 0.5, 0.08, 0.1); }
  else if (n === 'splash') { noiseHit('bandpass', 1300, 0.7, 0.45, 0.22, 0, 500); tone([420, 190], 0.16, 'sine', 0.08); }
  else if (n === 'lanternOn') { noiseHit('highpass', 3000, 0.6, 0.06, 0.08); noiseHit('bandpass', 600, 0.8, 0.5, 0.05, 0.05, 1500); }
  else if (n === 'talk') { tone([330, 392], 0.12, 'sine', 0.05); }
  else if (n === 'tick') tone([660], 0.05, 'sine', 0.04);
  else if (n === 'cheer') { for (let i = 0; i < 14; i++) noiseHit('bandpass', 1500 + Math.random() * 1500, 1.5, 0.06, 0.12, i * 0.09 + Math.random() * 0.05); for (let i = 0; i < 3; i++) tone([500 + i * 90, 820 + i * 60], 0.35, 'triangle', 0.035, 0.2 + i * 0.3); }
  else if (n === 'sail') { noiseHit('bandpass', 700, 0.8, 0.35, 0.08, 0, 300); }
  else if (n === 'thud') { tone([90, 60], 0.25, 'sine', 0.2); noiseHit('lowpass', 300, 1, 0.2, 0.15); }
  else if (n === 'plop') { tone([600, 180], 0.12, 'sine', 0.12); noiseHit('bandpass', 1200, 2, 0.1, 0.06); }
  else if (n === 'catch') { noiseHit('highpass', 1800, 0.6, 0.4, 0.12, 0, 600); tone([523, 659, 784], 0.25, 'triangle', 0.06, 0.15); }
  else if (n === 'clunk') { tone([160, 120], 0.2, 'square', 0.06); noiseHit('bandpass', 2200, 4, 0.15, 0.08); }
  else if (n === 'splash') { noiseHit('lowpass', 1400, 0.7, 0.9, 0.3, 0, 300); noiseHit('highpass', 3000, 0.5, 0.5, 0.08, 0.05); }
  else if (n === 'breath') { noiseHit('bandpass', 900, 0.7, 1.4, 0.05, 0, 1300); for (let i = 0; i < 6; i++) tone([220 + Math.random() * 200, 500 + Math.random() * 300], 0.06, 'sine', 0.03, 1.6 + i * 0.09); }
  else if (n === 'whoosh') noiseHit('bandpass', 500, 1, 0.5, 0.08, 0, 1500);
  else if (n === 'bat') { tone([220, 110], 0.12, 'triangle', 0.18); noiseHit('bandpass', 1600, 2, 0.08, 0.2); }
  else if (n === 'batPerfect') { tone([330, 165], 0.15, 'triangle', 0.2); noiseHit('bandpass', 2400, 3, 0.1, 0.25); tone([880, 1320], 0.2, 'sine', 0.06, 0.05); }
  else if (n === 'boing') { tone([180, 420, 260], 0.22, 'sine', 0.1); }
  else if (n === 'toc') { noiseHit('bandpass', 2600, 6, 0.04, 0.25); tone([1200, 900], 0.03, 'square', 0.04); }
  else if (n === 'stroke') { noiseHit('lowpass', 900, 0.8, 0.5, 0.1, 0, 400); }
  else if (n === 'found') [587.33, 739.99, 880, 1174.66].forEach((f, i) => { tone([f], 1.6, 'triangle', 0.09, i * 0.17, 0.6); });
}
function sfxStep(s) {
  if (!AU.ctx) return; const v = P.run ? 1.25 : 1;
  if (s === 'sand') noiseHit('bandpass', 700 + Math.random() * 200, 0.7, 0.16, 0.09 * v, 0, 350);
  else if (s === 'grass') { noiseHit('highpass', 2200 + Math.random() * 600, 0.5, 0.11, 0.05 * v); noiseHit('lowpass', 300, 0.6, 0.07, 0.08 * v); }
  else if (s === 'rock') { noiseHit('bandpass', 1500, 2.5, 0.06, 0.1 * v); tone([190, 110], 0.05, 'sine', 0.05 * v); }
  else if (s === 'water') noiseHit('bandpass', 1100 + Math.random() * 400, 0.8, 0.3, 0.13 * v, 0, 450);
  else if (s === 'wood') { noiseHit('bandpass', 420 + Math.random() * 80, 2.2, 0.09, 0.16 * v); tone([140, 95], 0.07, 'sine', 0.07 * v); }
  else if (s === 'jump') noiseHit('bandpass', 500, 1, 0.12, 0.05, 0, 900);
  else if (s === 'land') { noiseHit('lowpass', 420, 0.6, 0.16, 0.2); tone([120, 60], 0.1, 'sine', 0.12); }
}
const SCALE = [146.83, 196, 220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];
function updateAudio(dt) {
  const c = AU.ctx; if (!c) return; const now = c.currentTime, set = (p, v) => p.setTargetAtTime(v, now, 0.12);
  const gh = heightAt(P.pos.x, P.pos.z), g = swashG(swashPhase(P.pos.x, P.pos.z, G.t)), amp = waveAmp(P.pos.x, P.pos.z);
  const cdist = coastDist(P.pos.x, P.pos.z), seaMode = G.mode === 'boat' || G.mode === 'dive' || G.mode === 'intro', shore = seaMode ? 0.7 : clamp(Math.exp(-cdist / 14) * (1 - smooth(20, 45, cdist)) * (1 - 0.6 * smooth(6, 30, gh)) * (1 - 0.75 * (VIL.inside || 0)), 0, 1), inland = smooth(2.5, 7, gh), gust = 0.55 + 0.45 * Math.sin(G.t * 0.7) * Math.sin(G.t * 0.23 + 1);
  set(AU.ocean.g.gain, 0.32 * shore * (0.3 + 0.7 * g) * (0.55 + 0.9 * amp)); set(AU.ocean.f.frequency, 330 + 800 * g);
  set(AU.hiss.g.gain, 0.045 * shore * shore * smooth(0.25, 0.9, g) * (0.5 + amp));
  set(AU.wind.g.gain, (0.025 + 0.1 * G.windStr * gust) * (1 + smooth(25, 70, gh) * 1.2)); set(AU.wind.f.frequency, 280 + 380 * G.windStr * gust);
  set(AU.leaves.g.gain, 0.04 * inland * G.windStr * gust * (1 - smooth(55, 75, gh)));
  set(AU.crick.gain, 0.012 * SKY.night * inland);
  AU.nextBird -= dt; AU.nextGull -= dt; AU.nextMusic -= dt;
  if (AU.nextBird < 0) { AU.nextBird = 1.5 + Math.random() * 6; if (SKY.night < 0.3 && inland > 0.3) { const b = 2300 + Math.random() * 2200, n = 2 + (Math.random() * 4 | 0), v = 0.012 + Math.random() * 0.02; for (let i = 0; i < n; i++) tone([b, b * (1.15 + Math.random() * 0.3), b * 0.95], 0.07 + Math.random() * 0.06, 'sine', v, i * (0.1 + Math.random() * 0.05), 0.25); } }
  if (AU.nextGull < 0) { AU.nextGull = 8 + Math.random() * 16; if (SKY.night < 0.4 && shore > 0.3) for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) tone([950, 1350, 820], 0.32, 'sawtooth', 0.012, i * 0.42, 0.3); }
  if (AU.nextMusic < 0) {
    AU.nextMusic = 16 + Math.random() * 22; const n = 3 + (Math.random() * 4 | 0); let i0 = 2 + (Math.random() * 5 | 0), t = 0; const nt = SKY.night > 0.5;
    tone([SCALE[Math.random() * 2 | 0] * (nt ? 0.5 : 1)], 3.2, 'sine', 0.05, 0, 0.5);
    for (let i = 0; i < n; i++) { i0 = clamp(i0 + (Math.random() * 5 | 0) - 2, 2, SCALE.length - 1); const f = SCALE[i0] * (nt ? 0.5 : 1); tone([f], 1.9, 'triangle', 0.07, t, 0.7); tone([f * 2], 0.5, 'sine', 0.02, t); t += 0.42 + Math.random() * 0.6; }
  }
}

/* ---------- vie ---------- */
function updateLife(dt) {
  const bk = smooth(0.8, 0.35, SKY.night);
  for (const g of birds) {
    const u = g.userData; g.visible = bk > 0.002; if (!g.visible) continue; g.scale.setScalar(u.sc * bk); let amp, rate;
    if (u.kind === 'gull') {
      u.a += dt * u.sp; const cx = Math.cos(u.ca) * 210, cz = Math.sin(u.ca) * 210;
      g.position.set(cx + Math.cos(u.a) * u.rad, u.h + Math.sin(u.a * 2) * 3, cz + Math.sin(u.a) * u.rad); g.rotation.set(0, -u.a, -0.3, 'YXZ');
      amp = 0.12 + 0.45 * Math.max(0, Math.sin(G.t * 0.35 + u.ph)); rate = 5;
    } else {
      const f = u.fl; if (u.back < 1.5) { f.a += dt * f.sp; }
      const sg = Math.sign(f.sp), ca = Math.cos(f.a), sa = Math.sin(f.a), dx = -sa * sg, dz = ca * sg, px = dz, pz = -dx;
      g.position.set(f.cx + ca * f.rad - dx * u.back + px * u.side, f.h + Math.sin(f.a * 3 + f.wob) * 7 + u.up + Math.sin(G.t * 0.8 + u.ph) * 0.4, f.cz + sa * f.rad - dz * u.back + pz * u.side);
      g.rotation.set(0, Math.atan2(-dx, -dz), -0.18 * sg, 'YXZ'); amp = 0.5; rate = 7.5;
    }
    u.ph += dt * rate; const fl = Math.sin(u.ph) * amp;
    u.L.a.rotation.z = fl; u.R.a.rotation.z = -fl; const tip = Math.sin(u.ph - 0.9) * amp * 0.9; u.L.b.rotation.z = tip; u.R.b.rotation.z = tip;
  }
  const fm = fireflies.material; fm.opacity = SKY.night * 0.95;
  if (fm.opacity > 0.02) { const pa = fireflies.geometry.attributes.position, wr = (v, c) => c + ((((v - c) % 60) + 90) % 60) - 30; fireflies.userData.seed.forEach((s, i) => { const x = wr(s[0] * 2 + Math.sin(G.t * 0.4 + s[2]) * 2, P.pos.x), z = wr(s[1] * 2 + Math.cos(G.t * 0.33 + s[2] * 2) * 2, P.pos.z), h = heightAt(x, z); pa.setXYZ(i, x, h < 2.5 ? -50 : h + s[3] + Math.sin(G.t * 0.9 + s[2]) * 0.4, z); }); pa.needsUpdate = true; }
  const w = U.wind.value, wl = Math.hypot(w.x, w.y) || 1, dx = w.x / wl, dz = w.y / wl;
  const dayK = 1 - SKY.night, cp = camera.position, wrap = (v, c, s) => c + ((((v - c) % s) + s * 1.5) % s) - s * 0.5;
  pollen.material.opacity = 0.4 * dayK;
  { const pa = pollen.geometry.attributes.position; pollen.userData.seed.forEach((s, i) => { const t = G.t * (0.3 + s[3] * 0.4); pa.setXYZ(i, wrap(s[0] * 44 + w.x * G.t * 1.6 + Math.sin(t + s[1] * 9) * 0.8, cp.x, 44), cp.y - 1.5 + ((s[1] * 9 + Math.sin(t * 0.7 + s[2] * 7) * 0.6 + G.t * 0.03) % 9), wrap(s[2] * 44 + w.y * G.t * 1.6 + Math.cos(t + s[0] * 9) * 0.8, cp.z, 44)); }); pa.needsUpdate = true; }
  petals.material.opacity = 0.9 * (0.35 + 0.65 * dayK);
  { const pa = petals.geometry.attributes.position, c = SPOTS.cherry; petals.userData.seed.forEach((s, i) => { const fall = (G.t * (0.5 + s[3] * 0.5) + s[1] * 40) % 7, a = s[0] * 6.283, rr = Math.sqrt(s[2]) * 27, x = c.x + Math.cos(a) * rr + w.x * fall * 1.3 + Math.sin(G.t * 1.3 + s[3] * 20) * 0.35, z = c.z + Math.sin(a) * rr + w.y * fall * 1.3 + Math.cos(G.t * 1.1 + s[0] * 20) * 0.35; pa.setXYZ(i, x, Math.max(heightAt(x, z) + 0.03, heightAt(c.x, c.z) + 6.5 - fall * 1.15), z); }); pa.needsUpdate = true; }
  for (const b of flies) { const u = b.userData; b.visible = dayK > 0.3; if (!b.visible) continue; b.scale.setScalar(smooth(0.3, 0.6, dayK)); u.ph += dt * u.sp; const x = u.hx + Math.sin(u.ph) * u.rad + Math.sin(u.ph * 2.7) * 0.5, z = u.hz + Math.cos(u.ph * 0.8) * u.rad + Math.cos(u.ph * 3.1) * 0.5; b.position.set(x, heightAt(x, z) + 0.6 + Math.sin(u.ph * 2.2) * 0.35 + Math.abs(Math.sin(G.t * 9 + u.rad)) * 0.06, z); b.rotation.y = -u.ph + 1.2; const f = 0.2 + Math.abs(Math.sin(G.t * 11 + u.rad * 5)) * 1.1; u.l.rotation.z = f; u.rt.rotation.z = -f; }
  for (const l of windLines) {
    const u = l.userData; u.s += dt * (5 + 14 * G.windStr);
    if (u.s > 70 || !u.base) { u.s = 0; u.base = camera.position.clone().add(new V3((Math.random() - 0.5) * 70 - dx * 30, 2 + Math.random() * 12, (Math.random() - 0.5) * 70 - dz * 30)); u.dx = dx; u.dz = dz; }
    const pa = l.geometry.attributes.position;
    for (let k = 0; k < 26; k++) { const a = u.s - k * 0.45, c = Math.sin(a * u.k); pa.setXYZ(k, u.base.x + u.dx * a - u.dz * c * 1.4, u.base.y + Math.cos(a * u.k * 0.8) * 0.9, u.base.z + u.dz * a + u.dx * c * 1.4); }
    pa.needsUpdate = true; l.material.opacity = 0.32 * Math.sin(Math.PI * u.s / 70) * smooth(0.3, 0.65, G.windStr) * (1 - SKY.night * 0.7);
  }
}
let lastPhase = -1;
function updateMoments() {
  const ph = G.hour < 5.5 ? 3 : G.hour < 7 ? 0 : G.hour < 18.2 ? 1 : G.hour < 19.8 ? 2 : 3;
  if (lastPhase >= 0 && ph !== lastPhase && !TF.on) toast(['« L\'aube remonte de la mer, une vague à la fois. »', '« Le jour s\'installe. Tout recommence, sans se répéter. »', '« Le soleil se couche. L\'île retient son souffle. »', '« La nuit n\'éteint rien : elle écoute. »'][ph], 6000);
  lastPhase = ph;
}

/* ---------- démarrage et boucle ---------- */
let lastT = 0, fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - lastT) / 1000 || 0.016, 0.001, 0.05); lastT = now;
  G.t += dt; U.time.value = G.t;
  updateWind();
  if (G.started && BJ.on) { updateBanjo(dt); }
  else if (G.started && G.mode && G.mode !== 'walk') updateMode(dt);
  else if (G.started) { updatePlayer(dt); updateTerra(dt); updateInteract(); updateShots(dt); updateMoments(); }
  else { const a = G.t * 0.03 + 1.9; camera.position.set(Math.cos(a) * 340, 46, Math.sin(a) * 340); camera.lookAt(0, 30, 0); WU.uCam.value.copy(camera.position); P.pos.set(0, 0, 0); }
  updateNearGrass(camera.position.x, camera.position.z); updateVegLOD(camera.position); cullFruits(camera.position); updateVillage(dt); updateAssets(dt); updateArms(dt); updateFishing(dt); postArmsTurtle(); updateLighthouse(dt); updateSky(dt); applyUnder(); updateLife(dt); updateAudio(dt);
  renderFrame();
  // résolution adaptative : si l'image ralentit, on baisse un peu la définition (puis les ombres en dernier recours)
  if (G.started) { fpsAcc += dt; if (++fpsN >= 120) { const ft = fpsAcc / fpsN; fpsAcc = 0; fpsN = 0;
    const pr0 = window.RESK || 1; if (ft > 0.026 && pr0 > 0.6) { window.RESK = Math.max(0.6, pr0 - 0.1); resize(); } else if (ft < 0.014 && pr0 < 1) { window.RESK = Math.min(1, pr0 + 0.05); resize(); } else if (ft > 0.04 && pr0 <= 0.6 && sunLight.castShadow) setShadows(false); } }
}
function updateMode(dt) {
  if (G.mode === 'boat') updateBoat(dt);
  else if (G.mode === 'diveIn') updateDiveIn(dt);
  else if (G.mode === 'dive') updateDive(dt);
  else if (G.mode === 'surfacing') { camera.position.y += dt * 2; }
  else if (G.mode === 'turtle') updateTurtle(dt);
  else if (G.mode === 'intro') updateIntro(dt);
  if (G.mode !== 'boat') $('boatHud').style.opacity = 0;
  if (G.mode !== 'boat' && G.mode !== 'dive') setPrompt('');
  inp.act = false; inp.use = false; inp.jump = false;
}
function boot() {
  let saved = false; try { saved = decodeIsland(localStorage.getItem('ile-terrain2')); } catch (_) { }
  if (!saved) generateIsland();
  buildPost(); buildTerrain(); buildWater(); buildSky(); buildFlora(); buildCoastDist(); buildVillage(); applyEdits(); buildNearGrass(); buildLife(); buildItems(); setupBanjo(); loadAssets(); setupSea(); setupExtra(); loadProg(); buildDigs();
  setupInput(); setupMenu(); setupTerra();
  if (TOUCH) document.body.classList.add('touch');
  $('keys').innerHTML = TOUCH ? 'Pouce gauche pour marcher, pouce droit pour regarder. <b>Sac</b> ouvre la roue d\'objets, <b>Utiliser</b> creuse ou lance.'
    : '<b>ZQSD</b> marcher · <b>Maj</b> courir · <b>Espace</b> sauter · <b>E</b> cueillir · <b>Clic</b> creuser, lancer · <b>Tab</b> roue d\'objets · <b>M</b> montre · <b>L</b> lanterne · <b>F</b> terraformer';
  showItemLabel();
  const play = $('play'); play.textContent = 'Jouer';
  play.onclick = () => {
    if (G.started) return; initAudio(); G.started = true; lastPhase = -1; G.mode = 'walk';
    P.pos.set(SPOTS.spawn.x, SPOTS.spawn.h, SPOTS.spawn.z); P.yaw = Math.atan2(SPOTS.spawn.x, SPOTS.spawn.z); P.pitch = 0;
    const st = $('start'); st.style.opacity = 0; setTimeout(() => st.style.display = 'none', 1200);
    if (TOUCH) { // plein écran + verrouillage paysage quand le navigateur l'autorise ; sinon l'affichage est tourné par le jeu
      try { const el = document.documentElement, p = el.requestFullscreen && el.requestFullscreen(); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (_) { } }).catch(() => { }); } catch (_) { }
    } else if (canLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (_) { } }
    if (!introSeen()) startIntro();
  };
  requestAnimationFrame(frame);
}
boot();
