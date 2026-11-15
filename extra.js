'use strict';
/* ============ mini-jeu de la tortue, phare et savant, scène d'arrivée ============ */

/* ---------- Caramel, la tortue casse-cou ---------- */
const TT = { st: 'off', t: 0, pos: new V3(), vel: new V3(), spin: 0, boosts: 0, lastBounce: -9, best: 0, tee: null, dir: 0, bounces: 0 };
try { TT.best = +localStorage.getItem('ile-turtle') || 0; } catch (_) { }
function gTurtleShell() {
  const g = new GB();
  g.add(SPH, '#4f7a2e', M(0, 0.06, 0, 0.44, 0.32, 0.52), 0.35, 0.04);
  g.add(new THREE.CylinderGeometry(0.47, 0.45, 0.09, 22), '#d8c27a', M(0, 0.03, 0, 1, 1, 1.16), 0.2);
  for (let i = 0; i < 9; i++) { const a = i / 6 * 6.2832, top = i >= 6, r0 = top ? 0.12 * (i - 6) : 0.3, x = Math.cos(a) * r0, z = Math.sin(a) * r0 * 1.15, y = top ? 0.37 : 0.27; g.add(SPHL, i % 2 ? '#7a9a42' : '#6a8a3a', M(x, y, z, 0.13, 0.06, 0.14, Math.atan2(z, 0.4) * 0.5, 0, -x * 1.2), 0.3); }
  return g.build();
}
function buildTurtle() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sk = '#8acb5a', sh = new THREE.Mesh(gTurtleShell(), mat({ ds: true, grain: 2, ga: 0.2 })); sh.castShadow = true; body.add(sh);
  const head = new THREE.Group(); head.position.set(0, 0.12, 0.48); body.add(head);
  head.add(part(g => { g.add(SPH, sk, M(0, 0.05, 0.08, 0.16, 0.14, 0.18), 0.3); for (const sx of [-1, 1]) { g.add(SPHL, '#ffffff', M(sx * 0.07, 0.12, 0.2, 0.05), 0); g.add(SPHL, '#1a1a1a', M(sx * 0.072, 0.125, 0.24, 0.025), 0); g.add(new THREE.TorusGeometry(0.055, 0.014, 6, 14), '#8a5a2a', M(sx * 0.07, 0.15, 0.2), 0.2); g.add(new THREE.CircleGeometry(0.05, 12), '#9ad8e8', M(sx * 0.07, 0.15, 0.21), 0); } g.add(SPH, '#7a4a24', M(0, 0.13, 0.03, 0.17, 0.11, 0.17), 0.3); g.add(new THREE.BoxGeometry(0.12, 0.02, 0.02), '#2a5a2a', M(0, -0.01, 0.25), 0); g.add(SPH, '#d84a3a', M(0, -0.06, -0.05, 0.13, 0.05, 0.1), 0.3); }));
  const legs = []; for (const [x, z] of [[-0.32, 0.28], [0.32, 0.28], [-0.32, -0.3], [0.32, -0.3]]) { const l = part(g => g.add(SPH, sk, M(0, 0, 0, 0.13, 0.06, 0.1), 0.3)); l.position.set(x, 0.03, z); body.add(l); legs.push(l); }
  const tail = part(g => g.add(new THREE.ConeGeometry(0.05, 0.16, 6), sk, M(0, 0, 0, 1, 1, 1, -Math.PI / 2, 0, 0), 0.3)); tail.position.set(0, 0.05, -0.52); body.add(tail);
  root.userData = { body, head, legs, tail }; scene.add(root); return root;
}
function tuck(k) { const u = TT.mesh.userData; u.head.scale.setScalar(1 - k * 0.8); u.head.position.z = 0.48 - k * 0.3; u.legs.forEach(l => l.scale.setScalar(1 - k * 0.85)); u.tail.scale.setScalar(1 - k); }
function gBat() { const g = new GB(); g.add(lathe([[0.001, -0.02], [0.022, -0.02], [0.018, 0.0], [0.014, 0.25], [0.022, 0.45], [0.034, 0.65], [0.036, 0.78], [0.001, 0.8]], 12), '#c9945a', M(0, 0, 0), 0.35, 0.04); g.add(new THREE.CylinderGeometry(0.017, 0.017, 0.18, 10), '#3a2a20', M(0, 0.07, 0), 0.2); return g.build(); }
function setupTurtle() {
  // stand sur la plage, près du village : on cherche une bande de sable dégagée
  let best = null; for (let v = -10; v >= -40; v -= 2) for (let u = 6; u < 40; u += 1) { const p = vp(u, v), h = heightAt(p.x, p.z); if (h > 0.9 && h < 2.2) { let ok = 0; for (let k = 1; k <= 8; k++) { const q = vp(u, v - k * 8), hq = heightAt(q.x, q.z); if (hq > 0.3 && hq < 4) ok++; } if (!best || ok > best.ok) best = { u, v, ok }; break; } }
  const b = best || { u: 16, v: -18 }; const tee = vp(b.u, b.v), ahead = vp(b.u, b.v - 10);
  TT.tee = new V3(tee.x, heightAt(tee.x, tee.z), tee.z); TT.dir = Math.atan2(-(ahead.x - tee.x), -(ahead.z - tee.z));
  const fx = -Math.sin(TT.dir), fz = -Math.cos(TT.dir), rx = Math.cos(TT.dir), rz = -Math.sin(TT.dir); TT.f = new V3(fx, 0, fz); TT.r = new V3(rx, 0, rz);
  // décor : panneau des records, tremplin
  const pm = mat({ ds: true, grain: 2.4, ga: 0.3 }); // (piquets de distance retirés)
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshLambertMaterial({ map: signTex('Le Grand Lancer', '#e8d0a0', '#3a1e10'), side: THREE.DoubleSide }));
  const sp = TT.tee.clone().addScaledVector(TT.r, -3.2); sb.position.set(sp.x, heightAt(sp.x, sp.z) + 1.9, sp.z); sb.rotation.y = TT.dir + Math.PI / 2; scene.add(sb);
  { const pg = new GB(); for (const s of [-0.9, 0.9]) limb(pg, new V3(0, -0.4, s), new V3(0, 1.5, s), 0.06, 0.06, '#6a4a2e', 5, 0); const pp = new THREE.Mesh(pg.build(), pm); pp.position.copy(sb.position).setY(heightAt(sp.x, sp.z)); pp.rotation.y = TT.dir; scene.add(pp); }
  TT.mesh = buildTurtle(); TT.home = TT.tee.clone().addScaledVector(TT.f, 3).addScaledVector(TT.r, 1.6); TT.mesh.position.set(TT.home.x, heightAt(TT.home.x, TT.home.z), TT.home.z); TT.mesh.rotation.y = TT.dir + Math.PI;
  // Bartholomé, l'ami de Caramel
  const bp = TT.tee.clone().addScaledVector(TT.f, 3.2).addScaledVector(TT.r, 2.4); const n = makeNPC({ shirt: '#f0e0b0', vest: '#3a8a7a', pants: '#5a4a3a', hat: 'straw', mous: '#5a3a24', hair: '#5a3a24', belly: 1.15 });
  n.id = 'barth'; n.name = 'Bartholomé'; n.beh = 'idle'; n.ry = TT.dir + Math.PI * 0.75; n.g.position.set(bp.x, heightAt(bp.x, bp.z), bp.z); n.g.rotation.y = n.ry; n.hs = 1; VIL.npcs.push(n); TT.barth = n;
  const bat = new THREE.Mesh(gBat(), mat({ ga: 0 })); bat.rotation.set(-0.3, 0, 0); bat.position.set(0, -0.02, 0); bat.userData.a = anchorF; anchorF.add(bat); bat.visible = false; HELD.bat = bat; ITEMS.bat = { name: 'Batte', icon: '🏏' }; POSE.bat = [0.26, -0.28, -0.42, 0.55, 0.3, 0.35];
  DIALOG.barth = {
    start: { t: () => 'Voici Caramel, la tortue la plus casse-cou de l\'île ! Elle rêve de voler. Tu lui donnes un coup de batte ? Elle adore ça.' + (TT.best ? ' Record actuel : ' + TT.best.toFixed(1).replace('.', ',') + ' m.' : ''), c: [['Lancer Caramel !', null, 'turtle'], ['Elle ne va pas avoir mal ?', 'mal'], ['Plus tard.', null]] },
    mal: { t: 'Sa carapace est plus dure qu\'une ancre, et elle a son casque d\'aviatrice ! Elle rentre la tête, elle roule, elle rebondit... et elle en redemande.', c: [['Allons-y !', null, 'turtle'], ['Une autre fois.', null]] }
  };
  TALKFX.turtle = () => { setTimeout(startTurtle, 50); return 'close'; };
}
function startTurtle() {
  G.mode = 'turtle'; TT.prevHeld = held; held = 'bat'; for (const h in HELD) HELD[h].visible = h === 'bat'; setHandMesh(); fistR.visible = true; openR.visible = false;
  P.pos.copy(TT.tee); P.pos.y = heightAt(TT.tee.x, TT.tee.z); P.yaw = TT.dir; P.pitch = -0.05; P.vel.set(0, 0, 0);
  TT.st = 'ready'; TT.t = 0; $('tt').style.opacity = 1; ttHud();
}
function endTurtle() {
  G.mode = 'walk'; TT.st = 'off'; held = TT.prevHeld || 'hands'; for (const h in HELD) HELD[h].visible = h === held; setHandMesh(); $('tt').style.opacity = 0;
  tuck(0); TT.mesh.position.set(TT.home.x, heightAt(TT.home.x, TT.home.z), TT.home.z); TT.mesh.rotation.set(0, TT.dir + Math.PI, 0);
}
function turtleKey(code) {
  if (code === 'Escape' || code === 'Backspace') { endTurtle(); return true; }
  if (code === 'KeyE' && TT.st === 'done') { TT.st = 'ready'; TT.t = 0; return true; }
  return code === 'KeyE';
}
function ttHud() {
  const el = $('tt'); const d = TT.st === 'fly' || TT.st === 'done' ? TT.dist : 0;
  el.innerHTML = '<div class="big">' + (TT.st === 'fly' || TT.st === 'done' ? d.toFixed(1).replace('.', ',') + ' m' : TT.st === 'miss' ? 'Raté !' : '') + '</div><div class="small">' + (TT.st === 'done' ? (TT.newRec ? 'Nouveau record ! · ' : 'Record ' + TT.best.toFixed(1).replace('.', ',') + ' m · ') + (TOUCH ? 'Bouton E pour relancer' : '<b>E</b> relancer · <b>Échap</b> arrêter') : TT.st === 'fly' ? (TOUCH ? 'Touche « Utiliser » au rebond pour relancer Caramel' : '<b>Clic</b> pile au rebond : super rebond (' + (3 - TT.boosts) + ')') : (TOUCH ? '« Utiliser » quand Caramel passe devant toi' : '<b>Clic</b> quand Caramel passe devant toi') + ' · record ' + TT.best.toFixed(1).replace('.', ',') + ' m') + '</div>';
}
const _tv2 = new V3();
function updateTurtle(dt) {
  TT.t += dt; const t = TT.t, f = TT.f, r = TT.r, g = 12;
  const H = TT.tee.clone().addScaledVector(f, 1.15).addScaledVector(r, 0.35); H.y = heightAt(TT.tee.x, TT.tee.z) + 1.05;
  const click = inp.use; inp.use = false; inp.act = false;
  if (TT.st === 'ready') {
    // Bartholomé lance Caramel en l'air devant le joueur
    const S = TT.barth.g.position.clone().add(_tv2.set(0, 1.4, 0)), T = 1.05;
    TT.v0 = H.clone().sub(S).addScaledVector(new V3(0, -g, 0), -0.5 * T * T).multiplyScalar(1 / T);
    TT.S = S; tuck(0.4); TT.mesh.position.copy(S); TT.st = 'toss'; TT.t = 0; TT.swing = -1; sfx('whoosh');
    TT.barth.armR.rotation.x = -2.2;
  } else if (TT.st === 'toss') {
    const p = TT.S.clone().addScaledVector(TT.v0, t); p.y -= 0.5 * g * t * t; TT.mesh.position.copy(p); TT.mesh.rotation.set(t * 5, TT.dir, t * 2); tuck(Math.min(1, 0.4 + t));
    TT.barth.armR.rotation.x = lerp(-2.2, 0, Math.min(1, t * 2));
    if (click && TT.swing < 0) {
      TT.swing = 0; sfx('swing'); const d = p.distanceTo(H);
      if (d < 0.95) {
        const q = 1 - d / 0.95, perfect = d < 0.18, sp = 13 + 27 * q + (perfect ? 6 : 0), el = clamp(0.42 + (H.y - p.y) * 0.9, 0.15, 0.85), yaw = P.yaw + clamp(angDiff(P.yaw, TT.dir), -0.45, 0.45) * 0;
        const dir = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); const off = angDiff(P.yaw, TT.dir); if (Math.abs(off) > 0.5) dir.set(-Math.sin(TT.dir + Math.sign(off) * 0.5), 0, -Math.cos(TT.dir + Math.sign(off) * 0.5));
        TT.vel.copy(dir).multiplyScalar(sp * Math.cos(el)); TT.vel.y = sp * Math.sin(el); TT.pos.copy(p); TT.st = 'fly'; TT.t = 0; TT.boosts = 0; TT.bounces = 0; TT.dist = 0; TT.newRec = false; TT.spin = sp * 0.6;
        sfx(perfect ? 'batPerfect' : 'bat'); TT.camP = camera.position.clone();
      }
    }
    if (p.y < heightAt(p.x, p.z) && TT.st === 'toss') { TT.st = 'miss'; TT.t = 0; sfx('thud'); }
  } else if (TT.st === 'miss') { if (t > 1.6) { TT.st = 'ready'; TT.t = 0; } }
  else if (TT.st === 'fly') {
    const v = TT.vel, p = TT.pos; v.y -= g * dt; v.multiplyScalar(1 - 0.03 * dt); p.addScaledVector(v, dt);
    const gh = groundAt(p.x, p.z);
    if (click && TT.boosts < 3 && Math.abs(G.t - TT.lastBounce) < 0.22) { TT.boosts++; v.multiplyScalar(1.35); v.y = Math.abs(v.y) + 4; sfx('batPerfect'); TT.lastBounce = -9; }
    else if (click) TT.pendingClick = G.t;
    if (p.y <= gh + 0.25) {
      p.y = gh + 0.25;
      if (heightAt(p.x, p.z) < -0.35 && floorAt(p.x, p.z) === -Infinity) { TT.st = 'done'; TT.t = 0; sfx('splash'); TT.wet = 1; }
      else if (Math.abs(v.y) > 2.2) { v.y = -v.y * 0.5; v.x *= 0.8; v.z *= 0.8; TT.bounces++; TT.lastBounce = G.t; sfx('boing'); if (TT.pendingClick && G.t - TT.pendingClick < 0.18 && TT.boosts < 3) { TT.boosts++; v.multiplyScalar(1.35); v.y = Math.abs(v.y) + 4; sfx('batPerfect'); } TT.pendingClick = 0; }
      else { v.y = 0; const hs = Math.hypot(v.x, v.z), fr = Math.max(0, hs - 5 * dt) / (hs || 1); v.x *= fr; v.z *= fr; if (hs < 0.25) { TT.st = 'done'; TT.t = 0; } }
    }
    const pp = p.clone(); collide(pp, 0.3); if (pp.distanceToSquared(p) > 1e-6) { const nx = pp.x - p.x, nz = pp.z - p.z, nl = Math.hypot(nx, nz); const vn = (v.x * nx + v.z * nz) / nl; if (vn < 0) { v.x -= 1.5 * vn * nx / nl; v.z -= 1.5 * vn * nz / nl; sfx('thud'); } p.copy(pp); }
    TT.spin *= 1 - dt * 0.4; TT.mesh.position.copy(p); TT.mesh.rotation.x += TT.spin * dt; TT.mesh.rotation.y = Math.atan2(v.x, v.z);
    TT.dist = Math.hypot(p.x - TT.tee.x, p.z - TT.tee.z);
    if (TT.st === 'done') { if (TT.dist > TT.best) { TT.best = TT.dist; TT.newRec = true; try { localStorage.setItem('ile-turtle', TT.best.toFixed(2)); } catch (_) { } sfx('cheer'); } else sfx('found'); }
  } else if (TT.st === 'done') {
    // Caramel sort la tête, contente
    tuck(Math.max(0, 1 - t)); TT.mesh.rotation.x *= 1 - Math.min(1, dt * 4); TT.mesh.position.y = groundAt(TT.pos.x, TT.pos.z) + Math.abs(Math.sin(t * 6)) * 0.08 * Math.max(0, 1 - t * 0.3);
  }
  // caméra : à la batte en vue subjective, puis poursuite de la tortue
  if (TT.st === 'fly' || (TT.st === 'done' && t < 99)) {
    const p = TT.mesh.position, v = TT.vel, hs = Math.hypot(v.x, v.z), dx = hs > 0.5 ? v.x / hs : TT.f.x, dz = hs > 0.5 ? v.z / hs : TT.f.z;
    TT.cd = TT.cd || new V3(dx, 0, dz); TT.cd.lerp(_tv2.set(dx, 0, dz), Math.min(1, dt * 2)).normalize();
    const want = new V3(p.x - TT.cd.x * 7 + TT.cd.z * 2, Math.max(p.y, groundAt(p.x, p.z)) + 2.6, p.z - TT.cd.z * 7 - TT.cd.x * 2);
    want.y = Math.max(want.y, groundAt(want.x, want.z) + 1.2, 0.8);
    TT.camP = TT.camP || camera.position.clone(); TT.camP.lerp(want, Math.min(1, dt * 4)); camera.position.copy(TT.camP); camera.lookAt(p.x, p.y + 0.5, p.z);
    armR.visible = armL.visible = false;
  } else {
    P.yaw -= look.x * 0.0021; P.pitch = clamp(P.pitch - look.y * 0.0021, -0.6, 0.6); look.x = look.y = 0;
    camera.position.set(P.pos.x, P.pos.y + P.eye, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); TT.camP = null; TT.cd = null;
    if (TT.swing >= 0) { TT.swing += dt * 5; }
  }
  camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  if (TT.st === 'ready' || TT.st === 'toss' || TT.st === 'miss') { TT.mesh.visible = true; }
  ttHud();
}
// la batte décrit un grand arc pendant l'élan
function postArmsTurtle() {
  if (G.mode !== 'turtle' || !(TT.st === 'toss' || TT.st === 'miss' || TT.st === 'ready')) return;
  armL.visible = false; armR.visible = true;
  const s = TT.swing >= 0 ? Math.min(1, TT.swing) : 0, k = Math.sin(s * Math.PI);
  armR.position.x += -0.25 * s; armR.position.y += 0.05 * k; armR.rotation.y += 1.6 * s; armR.rotation.z += -0.8 * k;
}

/* ---------- le phare et le professeur ---------- */
let beam, lhLamp;
function setupLighthouse() {
  const base = heightAt(CAPE.x, CAPE.z), g = new GB(), pm = mat({ ds: true, grain: 2.4, ga: 0.3 }), Ht = 17;
  // tour rayée rouge et blanc, par anneaux
  for (let i = 0; i < 6; i++) { const y0 = i * Ht / 6, y1 = (i + 1) * Ht / 6, r0 = lerp(2.62, 1.82, y0 / Ht), r1 = lerp(2.62, 1.82, y1 / Ht); g.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, 24, 1, true), i % 2 ? '#e8e2d8' : '#c8402e', M(0, (y0 + y1) / 2, 0), 0.35, 0.03); }
  g.add(new THREE.CylinderGeometry(2.8, 3.0, 0.8, 24), '#8f8a80', M(0, 0.2, 0), 0.3, 0.1);
  g.add(new THREE.CylinderGeometry(2.6, 2.6, 0.25, 24), '#3a3632', M(0, Ht + 0.1, 0), 0.2); // galerie
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832; limb(g, new V3(Math.cos(a) * 2.5, Ht + 0.2, Math.sin(a) * 2.5), new V3(Math.cos(a) * 2.5, Ht + 1.1, Math.sin(a) * 2.5), 0.03, 0.03, '#2e2a26', 3, 0); }
  g.add(new THREE.TorusGeometry(2.5, 0.04, 4, 32), '#2e2a26', M(0, Ht + 1.1, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0);
  g.add(new THREE.CylinderGeometry(1.3, 1.3, 2.0, 16, 1, true), GLOWC, M(0, Ht + 1.25, 0), 0, 0); // lanterne vitrée
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; limb(g, new V3(Math.cos(a) * 1.32, Ht + 0.25, Math.sin(a) * 1.32), new V3(Math.cos(a) * 1.32, Ht + 2.25, Math.sin(a) * 1.32), 0.04, 0.04, '#2e2a26', 3, 0); }
  g.add(new THREE.ConeGeometry(1.6, 1.3, 16), '#c8402e', M(0, Ht + 2.9, 0), 0.3); g.add(SPHL, '#2e2a26', M(0, Ht + 3.6, 0, 0.15), 0.2);
  boxAt(g, '#4a3020', 0, 1.2, 2.62, 1.0, 2.0, 0.12); for (const y of [5.5, 10, 14]) windowAt(g, 0, y, lerp(2.6, 1.8, y / Ht) + 0.04, 0.5, 0.7, '#2e2a26');
  // maison du professeur + atelier
  const hx = -7, hz = 3.5; const hg = new GB(); plankWall(hg, mulberry(5), -3, 3, 0, 2.6, 2.2, '#d8d0c0', { hole: [-0.5, 0.5, 0, 2.0] }); plankWall(hg, mulberry(6), -3, 3, 0, 2.6, -2.2, '#d8d0c0');
  for (const sx of [-1, 1]) { const s2 = new GB(); plankWall(s2, mulberry(7), -2.2, 2.2, 0, 2.6, 0, '#d8d0c0'); hg.addGB(s2, M(sx * 3, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0)); }
  boxAt(hg, '#4a3020', 0, 1.0, 2.26, 0.9, 2.0, 0.08); windowAt(hg, -1.8, 1.0, 2.25, 0.8, 0.8, '#2f5a6e'); windowAt(hg, 1.8, 1.0, 2.25, 0.8, 0.8, '#2f5a6e'); gableEnds(hg, 6, 4.4, 2.6, 1.5, '#d8d0c0'); gableRoof(hg, mulberry(8), 6, 4.4, 2.6, 1.5, '#3f6a8a', 0.4);
  // établi, engrenages, télescope, girouette
  boxAt(hg, '#8a5c34', 0, 0.9, 4.0, 2.4, 0.1, 0.9); for (const x of [-1.1, 1.1]) for (const z of [3.65, 4.35]) limb(hg, new V3(x, 0, z), new V3(x, 0.88, z), 0.04, 0.04, '#6a4426', 4, 0);
  for (let i = 0; i < 3; i++) { hg.add(new THREE.CylinderGeometry(0.18 - i * 0.04, 0.18 - i * 0.04, 0.04, 12), '#c9a24a', M(-0.6 + i * 0.35, 1.0, 4.0, 1, 1, 1, Math.PI / 2, 0, 0), 0.2); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; hg.add(new THREE.BoxGeometry(0.05, 0.05, 0.04), '#c9a24a', M(-0.6 + i * 0.35 + Math.cos(a) * (0.2 - i * 0.04), 1.0 + Math.sin(a) * (0.2 - i * 0.04), 4.0), 0.2); } }
  limb(hg, new V3(0.8, 0.95, 4.0), new V3(1.1, 1.6, 3.7), 0.06, 0.08, '#c9a24a', 10, 0); mug(hg, 0.3, 0.95, 4.2);
  limb(hg, new V3(2.6, 0, 5.2), new V3(2.6, 1.2, 5.2), 0.03, 0.03, '#3a3632', 4, 0); limb(hg, new V3(2.6, 1.2, 5.2), new V3(2.9, 1.7, 4.6), 0.1, 0.07, '#b9a46a', 10, 0);
  const house = new THREE.Mesh(hg.build(), pm); house.castShadow = house.receiveShadow = true;
  const lh = new THREE.Mesh(g.build(), pm); lh.castShadow = lh.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(lh); house.position.set(hx, 0, hz); house.rotation.y = 0.3; grp.add(house); grp.position.set(CAPE.x, base - 0.2, CAPE.z); scene.add(grp);
  addCol(CAPE.x, CAPE.z, 3.0);
  { const F = new Frame(CAPE.x + hx, CAPE.z + hz, 0.3, base); F.wall(-3, 2.2, -0.55, 2.2); F.wall(0.55, 2.2, 3, 2.2); F.wall(-3, -2.2, 3, -2.2); F.wall(-3, -2.2, -3, 2.2); F.wall(3, -2.2, 3, 2.2); F.wall(-1.2, 4.0, 1.2, 4.0, 0.45); F.floor(0, 0, 2.95, 2.15, base + 0.02); }
  // faisceau tournant, visible la nuit
  beam = new THREE.Group(); beam.position.set(CAPE.x, base + Ht + 1.25, CAPE.z); scene.add(beam);
  const bmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uK: { value: 0 } }, vertexShader: 'varying float vL; void main(){ vL = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform float uK; varying float vL; void main(){ float a = (1.0 - smoothstep(0.0, 140.0, -vL)) * uK; gl_FragColor = vec4(1.0, 0.92, 0.7, a * 0.22); }' });
  for (const s of [1, -1]) { const cg = new THREE.CylinderGeometry(0.4, 9, 140, 18, 1, true); cg.translate(0, -70, 0); const c = new THREE.Mesh(cg, bmat); c.rotation.z = s * Math.PI / 2; c.rotation.x = 0.06; beam.add(c); } beam.userData.m = bmat;
  // le professeur Anselme
  const sp = new V3(CAPE.x + hx + 0.2, 0, CAPE.z + hz + 3.3); const n = makeNPC({ shirt: '#f4f0e8', pants: '#3a3a4a', hair: '#f0f0f0', beard: '#f0f0f0', mous: '#f0f0f0', vest: '#8a6a4a', h: 0.95, belly: 1.05 });
  n.head.add(part(gg => { for (const sx of [-1, 1]) { gg.add(new THREE.TorusGeometry(0.05, 0.012, 6, 14), '#c9a24a', M(sx * 0.06, 0.33, 0.12), 0.2); gg.add(new THREE.CircleGeometry(0.045, 12), '#9ad8e8', M(sx * 0.06, 0.33, 0.13), 0); } gg.add(SPH, '#f0f0f0', M(-0.17, 0.3, -0.02, 0.09, 0.12, 0.09), 0.3); gg.add(SPH, '#f0f0f0', M(0.17, 0.3, -0.02, 0.09, 0.12, 0.09), 0.3); }));
  n.id = 'anselme'; n.name = 'Professeur Anselme'; n.beh = 'work'; n.ry = 0.3 + Math.PI; n.g.position.set(sp.x, groundAt(sp.x, sp.z), sp.z); n.g.rotation.y = n.ry; VIL.npcs.push(n);
  const UPG = [
    ['compass', 'Boussole aimantée', 'Son aiguille montre le trésor enterré le plus proche au lieu du nord.', { shell: 2, scallop: 1 }],
    ['lantern', 'Lanterne prismatique', 'Elle éclaire deux fois plus loin.', { fish: 1, lemon: 1 }],
    ['spyglass', 'Longue-vue à double lentille', 'Le zoom est deux fois plus fort.', { pebble: 2, star: 1 }],
    ['shovel', 'Pelle à ressort', 'Elle creuse plus vite et fait scintiller la terre meuble des cachettes.', { apple: 1, orange: 1 }],
    ['suit', 'Scaphandre renforcé', 'Tuyau d\'air deux fois plus long et pas plus légers sous l\'eau.', { fish: 3 }]
  ];
  const nm = { shell: 'coquillage', scallop: 'coquille', fish: 'poisson', lemon: 'citron', pebble: 'galet', star: 'étoile de mer', apple: 'pomme', orange: 'orange' };
  const costTxt = c => Object.entries(c).map(([k, v]) => v + ' ' + nm[k] + (v > 1 && k !== 'fish' ? 's' : v > 1 ? 's' : '')).join(', ');
  const can = c => Object.entries(c).every(([k, v]) => (FR[k] || 0) >= v);
  DIALOG.anselme = {
    start: { t: () => G.metProf ? 'Ah, te revoilà ! Une nouvelle expérience ?' : 'Ah ! Un visiteur ! Je suis le professeur Anselme. Tu tombes bien : j\'ai besoin de quelqu\'un pour essayer mes inventions.', c: [['Quelles inventions ?', 'list', () => { G.metProf = true; }], ['Pourquoi vivre dans un phare ?', 'phare'], ['Au revoir.', null]] },
    phare: { t: 'La lumière est la plus vieille des inventions. Je la fais tourner la nuit pour que les bateaux trouvent leur chemin... et pour me tenir compagnie.', c: [['Montre-moi tes inventions.', 'list'], ['Au revoir.', null]] },
    list: { t: () => UPG.every(u => G.up[u[0]]) ? 'Tu as déjà tout ! Je n\'ai plus rien à t\'apprendre... pour l\'instant.' : 'Apporte-moi de quoi bricoler, et j\'améliore ton matériel. Que veux-tu ?', c: () => [...UPG.filter(u => !G.up[u[0]]).map(u => [u[1] + ' (' + costTxt(u[3]) + ')', null, () => { if (!can(u[3])) { VIL.talk.node = 'manque'; VIL.talk.need = u; renderTalk(); return 'stay'; } for (const [k, v] of Object.entries(u[3])) FR[k] -= v; G.up[u[0]] = true; saveProg(); sfx('found'); VIL.talk.node = 'ok'; VIL.talk.got = u; renderTalk(); return 'stay'; }]), ['Rien pour l\'instant.', null]] },
    manque: { t: () => 'Hmm, pour la ' + VIL.talk.need[1].toLowerCase() + ' il me faut : ' + costTxt(VIL.talk.need[3]) + '. Reviens quand tu les auras !', c: [['D\'accord.', null]] },
    ok: { t: () => 'Bzzt... clic... voilà ! ' + VIL.talk.got[1] + ' : ' + VIL.talk.got[2], c: [['Merci professeur !', 'list'], ['Au revoir.', null]] }
  };
}
function updateLighthouse(dt) {
  if (!beam) return; const k = smooth(0.25, 0.7, SKY.night); beam.rotation.y += dt * 0.6; beam.userData.m.uniforms.uK.value = k; beam.visible = k > 0.01;
}

/* ---------- scène d'arrivée ---------- */
const IN = { t: 0, on: false };
function introSeen() { try { return localStorage.getItem('ile-intro1') === '1'; } catch (_) { return false; } }
function startIntro() {
  G.mode = 'intro'; IN.on = true; IN.t = 0; IN.flags = {};
  const sp = SPOTS.spawn, d = Math.hypot(sp.x, sp.z), ox = sp.x / d, oz = sp.z / d; IN.out = new V3(ox, 0, oz);
  IN.A = new V3(sp.x + ox * 300, 0, sp.z + oz * 300); IN.yawIsland = Math.atan2(ox, oz); // regarder vers l'île = vers -out
  IN.boat = buildBoat({ noSuit: true, cols: ['#3a3a40', '#8a6a4a', '#6a4a2e'] }); IN.boat.grp.position.copy(IN.A); IN.boat.grp.rotation.y = IN.yawIsland + Math.PI / 2; IN.boat.boom.rotation.y = 0.6;
  IN.sailor = makeNPC({ shirt: '#3a4a6a', pants: '#3a3028', hat: 'cap', hatc: '#2a2a3a', beard: '#e0dcd4', hair: '#d0ccc4', belly: 1.2 });
  const sf = new V3(-Math.sin(IN.boat.grp.rotation.y), 0, -Math.cos(IN.boat.grp.rotation.y)); IN.sf = sf; IN.sr = new V3(-sf.z, 0, sf.x);
  IN.sailor.g.position.set(IN.A.x - sf.x * 2.3 + IN.sr.x * 0.55, 0.2, IN.A.z - sf.z * 2.3 + IN.sr.z * 0.55); IN.sailor.g.rotation.y = Math.atan2(sf.x, sf.z); IN.sailor.beh = 'introSit';
  IN.sailor.legL.rotation.x = IN.sailor.legR.rotation.x = -1.45; IN.sailor.hips.position.y = 0.95;
  G.hour = 17.4; G.speed = 0;
  // la fille aux cailloux
  IN.lila = VIL.npcs.find(n => n.id === 'lila');
  IN.hands = []; for (const sx of [-1, 1]) { const h = new THREE.Mesh(buildOpenGeo(true), mat({ ds: true, ga: 0 })); if (sx < 0) h.scale.x = -1; camera.add(h); h.visible = false; IN.hands.push(h); }
  $('skip').style.display = 'block'; $('lids').style.display = 'block'; setLids(0);
  for (const n of VIL.npcs) if (n.id === 'lila') n.hidden = true;
}
function setLids(k) { const v = (k * 50).toFixed(1) + '%'; $('lidT').style.height = v; $('lidB').style.height = v; }
function sub(txt, who) { const el = $('sub'); if (!txt) { el.style.opacity = 0; return; } el.innerHTML = (who ? '<div class="who">' + who + '</div>' : '') + txt; el.style.opacity = 1; }
function finishIntro() {
  IN.on = false; G.mode = 'walk'; G.speed = 1; $('skip').style.display = 'none'; $('lids').style.display = 'none'; sub(''); $('fade').style.opacity = 0; $('fade').style.background = '#000';
  if (IN.boat) { scene.remove(IN.boat.grp); scene.remove(IN.sailor.g); } IN.hands.forEach(h => camera.remove(h));
  const l = IN.lila; if (l) { l.hidden = false; const p = vp(1, 3.5); l.g.position.set(p.x, groundAt(p.x, p.z), p.z); l.beh = 'idle'; l.ry = 0; }
  P.pos.set(SPOTS.spawn.x, groundAt(SPOTS.spawn.x, SPOTS.spawn.z), SPOTS.spawn.z); P.yaw = Math.atan2(SPOTS.spawn.x - VILLAGE.x, SPOTS.spawn.z - VILLAGE.z); P.pitch = 0; P.vel.set(0, 0, 0);
  G.hour = Math.max(G.hour, 8.2); if (G.hour > 9.5 || G.hour < 8) G.hour = 8.2;
  try { localStorage.setItem('ile-intro1', '1'); } catch (_) { }
}
function skipIntro() { if (IN.on) finishIntro(); }
function updateIntro(dt) {
  IN.t += dt; const t = IN.t, F = IN.flags, once = k => F[k] ? false : (F[k] = true);
  const A = IN.A, sf = IN.sf, toIsland = IN.out.clone().negate();
  let cam = new V3(), yaw = 0, pitch = 0, roll = 0;
  const bob = Math.sin(G.t * 0.9) * 0.18;
  if (IN.boat) { IN.boat.grp.position.y = bob - 0.05; IN.boat.grp.rotation.z = Math.sin(G.t * 0.7) * 0.05; IN.sailor.g.position.y = bob + 0.15; }
  if (t < 7.2) {
    // assis à la proue, face au vieux marin
    cam.set(A.x + sf.x * 1.4 - IN.sr.x * 0.6, bob + 1.35, A.z + sf.z * 1.4 - IN.sr.z * 0.6); IN.hands.forEach(h => h.visible = false); const s = IN.sailor.g.position; yaw = Math.atan2(-(s.x - cam.x), -(s.z - cam.z)); pitch = -0.08;
    if (t > 5.2) { const k = smooth(5.2, 7.0, t); yaw = yaw + angDiff(Math.atan2(-toIsland.x, -toIsland.z), yaw) * k; cam.y += k * 0.5; }
    if (t > 1.0 && t < 5.4) sub('« Je ne m\'approche pas plus près que ça de cette île de pirate, le reste c\'est à la nage ! »', 'Le vieux marin'); else sub('');
    const sa = IN.sailor; sa.head.rotation.x = Math.sin(t * 3) * 0.05; sa.armR.rotation.x = t > 2.5 && t < 4.5 ? -1.6 : -0.5; sa.armR.rotation.z = t > 2.5 && t < 4.5 ? -0.6 : 0;
    if (once('talk')) sfx('talk');
  } else if (t < 8.6) {
    // le saut
    sub(''); IN.hands.forEach(h => h.visible = false);
    const k = (t - 7.2) / 1.4, start = new V3(A.x + sf.x * 1.6, bob + 1.85, A.z + sf.z * 1.6);
    cam.copy(start).addScaledVector(toIsland, k * 4); cam.y = start.y + Math.sin(k * Math.PI) * 1.2 - k * 2.6; yaw = Math.atan2(-toIsland.x, -toIsland.z); pitch = -0.2 - k * 0.5;
    if (k > 0.85 && once('splash')) { sfx('splash'); $('fade').style.background = '#1d6f86'; $('fade').style.opacity = 0.85; }
  } else if (t < 13.6) {
    // la nage vers l'île
    sub('');
    if (once('swim')) { $('fade').style.opacity = 0; IN.hands.forEach(h => h.visible = true); scene.remove(IN.boat.grp); scene.remove(IN.sailor.g); }
    const k = t - 8.6, start = new V3(A.x + sf.x * 1.6, 0, A.z + sf.z * 1.6).addScaledVector(toIsland, 4 + k * 9);
    cam.set(start.x, 0.25 + Math.sin(t * 2.4) * 0.08, start.z); yaw = Math.atan2(-toIsland.x, -toIsland.z) + Math.sin(t * 1.2) * 0.04; pitch = 0.02 + Math.sin(t * 2.4) * 0.03; roll = Math.sin(t * 1.2) * 0.04;
    const s = (t * 0.55) % 1, out = Math.sin(s * Math.PI); IN.hands.forEach((h, i) => { const sx = i ? 1 : -1; h.position.set(sx * (0.05 + out * 0.3), -0.26 + out * 0.03, -0.5 + Math.cos(s * Math.PI * 2) * 0.12); h.rotation.set(-0.25, sx * (0.15 + out * 0.5), sx * -2.6); });
    if (Math.floor(t * 0.55) !== IN.stroke) { IN.stroke = Math.floor(t * 0.55); sfx('stroke'); }
    if (t > 12.6 && once('fadeOut')) { $('fade').style.background = '#000'; $('fade').style.opacity = 1; }
  } else if (t < 15.4) {
    cam.set(A.x, 0.3, A.z); IN.hands.forEach(h => h.visible = false);
    if (once('beach')) { G.hour = 18.4; }
  } else if (t < 26) {
    // allongé sur le sable, épuisé : les paupières se ferment
    IN.hands.forEach(h => h.visible = false);
    const sp = SPOTS.spawn, gh = groundAt(sp.x, sp.z); cam.set(sp.x, gh + 0.35, sp.z); yaw = Math.atan2(-toIsland.x, -toIsland.z) + Math.PI; pitch = 1.05; roll = 0.15;
    if (once('wake1')) { $('fade').style.opacity = 0; sfx('breath'); }
    if (t < 21) setLids(lerp(0.45, 1, smooth(17.5, 20.5, t)) - Math.sin(t * 1.5) * 0.05 * (t < 19 ? 1 : 0));
    else { setLids(1); if (once('sleep')) G.hour = 8.0; }
    sub(t > 16.3 && t < 19.8 ? '…' : '');
    if (t > 23.5 && once('peb1')) { sfx('toc'); IN.shake = 0.4; }
  } else if (t < 38) {
    const sp = SPOTS.spawn, gh = groundAt(sp.x, sp.z), lilaP = new V3(sp.x + toIsland.x * -1.6 + toIsland.z * 0.9, 0, sp.z + toIsland.z * -1.6 - toIsland.x * 0.9);
    IN.hands.forEach(h => h.visible = false);
    const l = IN.lila; if (l && once('lilaIn')) { l.hidden = false; l.g.position.set(lilaP.x, groundAt(lilaP.x, lilaP.z), lilaP.z); l.beh = 'introStand'; }
    const sit = smooth(33, 35.5, t); cam.set(sp.x, gh + lerp(0.35, 1.55, sit), sp.z);
    const lp = l ? l.g.position : lilaP; const toL = Math.atan2(-(lp.x - cam.x), -(lp.z - cam.z));
    yaw = toL; pitch = lerp(0.75, 0.05, sit) + (t < 30 ? 0 : 0); roll = lerp(0.12, 0, sit);
    if (l) { l.g.rotation.y = Math.atan2(cam.x - lp.x, cam.z - lp.z); if (t < 29.5) { const c = ((t - 26) % 1.3) / 1.3; l.armR.rotation.x = -1.2 - Math.sin(c * Math.PI) * 1.4; } else l.armR.rotation.x *= 0.9; l.head.rotation.x = 0.35 * (1 - sit); }
    if (t > 26.6 && once('peb2')) { sfx('toc'); IN.shake = 0.3; }
    if (t > 27.9 && once('peb3')) { sfx('toc'); IN.shake = 0.35; }
    setLids(t < 26.7 ? 0.8 : t < 27.8 ? 0.55 : t < 28.6 ? 0.7 : lerp(0.4, 0, smooth(28.6, 29.6, t)));
    if (t > 29.8 && t < 32.6) sub('« Hé ! Tu es vivant ? … Ouf. J\'ai cru que la mer avait rendu un naufragé de plus. »', 'Lila');
    else if (t > 32.8 && t < 36.4) sub('« Bienvenue sur l\'île aux Fougères. Le village est par là : va voir Barbe-Grise, il connaît tout le monde. »', 'Lila');
    else sub('');
    if (t > 36 && l) { const vx = VILLAGE.x - lp.x, vz = VILLAGE.z - lp.z, vl = Math.hypot(vx, vz); l.g.position.x += vx / vl * 1.6 * dt; l.g.position.z += vz / vl * 1.6 * dt; l.g.position.y = groundAt(l.g.position.x, l.g.position.z); l.g.rotation.y = Math.atan2(vx, vz); const w = Math.sin(t * 7); l.legL.rotation.x = w * 0.5; l.legR.rotation.x = -w * 0.5; l.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.2; }
  } else { finishIntro(); return; }
  if (IN.shake > 0) { IN.shake -= dt; cam.x += (Math.random() - 0.5) * IN.shake * 0.08; cam.y += (Math.random() - 0.5) * IN.shake * 0.08; }
  camera.position.copy(cam); camera.rotation.set(pitch, yaw, roll, 'YXZ'); camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  P.pos.set(cam.x, 0, cam.z);
}
function setupExtra() {
  setupTurtle(); setupLighthouse();
  $('skip').onclick = e => { e.stopPropagation(); skipIntro(); };
  $('introBtn').onclick = () => { if (!G.started || G.mode !== 'walk') return; G.menu = false; $('menu').style.display = 'none'; startIntro(); };
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && IN.on && IN.t > 1 && !TOUCH) skipIntro(); });
  // Lila, la fille aux cailloux, vit au village
  const p = vp(1, 3.5), n = makeNPC({ skin: '#c98a5e', shirt: '#e8c04a', pants: '#3a5a7a', hair: '#2a1a10', bun: 1, h: 0.92, sash: '#d84a3a' });
  n.id = 'lila'; n.name = 'Lila'; n.beh = 'idle'; n.ry = 0; n.g.position.set(p.x, groundAt(p.x, p.z), p.z); VIL.npcs.push(n);
  DIALOG.lila = {
    start: { t: 'Alors, naufragé, tu t\'habitues ? Moi je connais tous les recoins de l\'île. Enfin, presque tous.', c: [['Merci de m\'avoir réveillé.', 'merci'], ['Quels recoins ?', 'coins'], ['À plus tard.', null]] },
    merci: { t: 'Avec des cailloux, oui. C\'est plus poli que le seau d\'eau. Je garde le seau pour la deuxième fois.', c: [['Je retiens.', null]] },
    coins: { t: 'Il y a des croix sur l\'île, avec de la terre meuble. Creuse dessous, on y a caché des bouts de poème. Et le citronnier, il n\'y en a qu\'un. Il le sait.', c: [['Je vais chercher.', null]] }
  };
}
