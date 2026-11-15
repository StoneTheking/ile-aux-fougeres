'use strict';
/* assets gratuits : modèles animés des exemples three.js (licence MIT) — perroquet, flamants roses */
const ASSET = { mixers: [], flam: [] };
function loadAssets() {
  if (!THREE.GLTFLoader || typeof GLB === 'undefined') return;
  const buf = n => { const b = atob(GLB[n]), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; };
  const L = new THREE.GLTFLoader(), fit = (obj, size) => { let b = new THREE.Box3().setFromObject(obj); const s = b.getSize(new V3()); obj.scale.multiplyScalar(size / Math.max(s.x, s.y, s.z)); obj.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(obj); const c = b.getCenter(new V3()); obj.position.sub(c); };
  L.parse(buf('Parrot'), '', gl => {
    const m = gl.scene.children[0]; if (!VIL.parrot) return; fit(m, 0.6); m.position.y += 0.22;
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material.metalness = 0; o.material.roughness = 1; } });
    VIL.parrot.userData.body.visible = false; VIL.parrot.add(m); VIL.parrot.userData.glb = m;
    const mx = new THREE.AnimationMixer(m); const act = mx.clipAction(gl.animations[0]); act.play(); mx.timeScale = 0.25; ASSET.mixers.push(mx); ASSET.parrot = mx;
  });
  L.parse(buf('Flamingo'), '', gl => {
    const base = gl.scene.children[0]; fit(base, 2.6);
    for (let i = 0; i < 7; i++) {
      const m = i ? base.clone() : base; m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = 1; } });
      const g = new THREE.Group(); g.add(m); m.rotation.y = 0; scene.add(g);
      const mx = new THREE.AnimationMixer(m); mx.clipAction(gl.animations[0]).play(); mx.update(i * 0.13); mx.timeScale = 0.9 + Math.random() * 0.2; ASSET.mixers.push(mx);
      ASSET.flam.push({ g, back: (i >> 1) * 3.2 + Math.random(), side: (i % 2 ? 1 : -1) * ((i + 1) >> 1) * 2.6, up: Math.random() * 1.5 });
    }
  });
}
let flamA = 2.1;
function updateAssets(dt) {
  for (const m of ASSET.mixers) m.update(dt);
  if (ASSET.parrot) ASSET.parrot.timeScale = Math.sin(G.t * 0.5) > 0.7 ? 1.2 : 0.06; // bat des ailes de temps en temps
  // vol de flamants au-dessus des lagons, le jour
  flamA += dt * 0.022; const day = smooth(0.8, 0.3, SKY.night), R = 250;
  const cx = Math.cos(flamA) * R, cz = Math.sin(flamA) * R * 0.8, tx = -Math.sin(flamA), tz = Math.cos(flamA) * 0.8, tl = Math.hypot(tx, tz), dx = tx / tl, dz = tz / tl;
  for (const f of ASSET.flam) { f.g.visible = day > 0.05; f.g.scale.setScalar(day); f.g.position.set(cx - dx * f.back - dz * f.side, 34 + f.up + Math.sin(G.t * 0.4 + f.back) * 1.5, cz - dz * f.back + dx * f.side); f.g.rotation.y = Math.atan2(dx, dz); }
}
