'use strict';
/* ============ village pirate : taverne, maisons, ponton, PNJ, dialogues, banjo ============ */
const VIL = { inside: 0, npcs: [], talk: null, base: 3, built: false };
const WALLS = [], FLOORS = [];
const VD = { x: 0, z: 0, px: 0, pz: 0 };
// repère du village : u vers la mer, v le long de la côte
function vp(u, v) { return { x: VILLAGE.x + VD.x * u + VD.px * v, z: VILLAGE.z + VD.z * u + VD.pz * v }; }
function floorAt(x, z) {
  let h = -Infinity;
  for (const f of FLOORS) { const dx = x - f.cx, dz = z - f.cz, a = dx * f.c + dz * f.s, b = -dx * f.s + dz * f.c; if (Math.abs(a) <= f.hx && Math.abs(b) <= f.hz) h = Math.max(h, f.h); }
  return h;
}
function groundAt(x, z) { return Math.max(heightAt(x, z), floorAt(x, z), rockTop(x, z)); }
function addWall(ax, az, bx, bz, th) { WALLS.push({ ax, az, bx, bz, th: th || 0.18 }); }
function collideWalls(p, rad) {
  for (const w of WALLS) {
    const ex = w.bx - w.ax, ez = w.bz - w.az, l2 = ex * ex + ez * ez, t = clamp(((p.x - w.ax) * ex + (p.z - w.az) * ez) / l2, 0, 1);
    const qx = w.ax + ex * t, qz = w.az + ez * t, dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz), rr = rad + w.th;
    if (d < rr && d > 1e-6) { p.x = qx + dx / d * rr; p.z = qz + dz / d * rr; }
  }
  for (const n of VIL.npcs) { const dx = p.x - n.g.position.x, dz = p.z - n.g.position.z, d = Math.hypot(dx, dz), rr = rad + 0.3; if (d < rr && d > 1e-6) { p.x = n.g.position.x + dx / d * rr; p.z = n.g.position.z + dz / d * rr; } }
}
// bâtiment : repère local (x largeur, z profondeur, façade en +z) → monde
function Frame(cx, cz, ang, base) { this.cx = cx; this.cz = cz; this.c = Math.cos(ang); this.s = Math.sin(ang); this.ang = ang; this.base = base; }
Frame.prototype.w = function (x, z) { return { x: this.cx + x * this.c + z * this.s, z: this.cz - x * this.s + z * this.c }; };
Frame.prototype.wall = function (x0, z0, x1, z1, th) { const a = this.w(x0, z0), b = this.w(x1, z1); addWall(a.x, a.z, b.x, b.z, th); };
Frame.prototype.floor = function (x, z, hx, hz, h) { const p = this.w(x, z); FLOORS.push({ cx: p.x, cz: p.z, c: this.c, s: -this.s, hx, hz, h }); };

/* ---------- géométrie : planches, toits, meubles ---------- */
const GLOW = '#ffc070'; // couleur > 1 après multiplication : fenêtres et lanternes qui s'allument la nuit
const GLOWC = new THREE.Color(2.0, 1.4, 0.6);
function plankWall(g, r, x0, x1, y0, y1, z, col, opts = {}) { // mur de planches horizontales entre x0 et x1, face +z
  { const hb = opts.hole, bc = lin(col).multiplyScalar(0.55); if (hb) { g.add(new THREE.BoxGeometry(hb[0] - x0, y1 - y0, 0.04), bc, M((x0 + hb[0]) / 2, (y0 + y1) / 2, z - 0.05), 0); g.add(new THREE.BoxGeometry(x1 - hb[1], y1 - y0, 0.04), bc, M((x1 + hb[1]) / 2, (y0 + y1) / 2, z - 0.05), 0); if (hb[2] > y0 + 0.05) g.add(new THREE.BoxGeometry(hb[1] - hb[0], hb[2] - y0, 0.04), bc, M((hb[0] + hb[1]) / 2, (y0 + hb[2]) / 2, z - 0.05), 0); g.add(new THREE.BoxGeometry(hb[1] - hb[0], y1 - hb[3], 0.04), bc, M((hb[0] + hb[1]) / 2, (hb[3] + y1) / 2, z - 0.05), 0); } else g.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.04), bc, M((x0 + x1) / 2, (y0 + y1) / 2, z - 0.05), 0); }
  const n = Math.max(1, Math.round((y1 - y0) / 0.32)), hh = (y1 - y0) / n, c0 = lin(col), th = opts.th || 0.12;
  for (let i = 0; i < n; i++) {
    const y = y0 + (i + 0.5) * hh, k = 0.86 + r() * 0.24, cc = c0.clone().multiplyScalar(k), segs = opts.hole && y > opts.hole[2] && y < opts.hole[3] ? [[x0, opts.hole[0]], [opts.hole[1], x1]] : [[x0, x1]];
    if (i === 0 && !opts.nob) { const segs0 = opts.hole ? [[x0, opts.hole[0]], [opts.hole[1], x1]] : [[x0, x1]]; } 
    for (const [a, b] of segs) if (b - a > 0.02) g.add(new THREE.BoxGeometry(b - a, hh * 1.12, th), cc, M((a + b) / 2, y, z + (r() - 0.5) * 0.02, 1, 1, 1, (r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.01), 0.15, 0.05);
  }
}
function boxAt(g, col, x, y, z, sx, sy, sz, ry = 0, sh = 0.2, j = 0.05) { g.add(new THREE.BoxGeometry(sx, sy, sz), col, M(x, y, z, 1, 1, 1, 0, ry, 0), sh, j); }
function gableRoof(g, r, W, D, y, rise, col, over = 0.5) { // faîtage le long de x
  const hw = W / 2 + over, hd = D / 2 + over, sl = Math.hypot(hd, rise), ang = Math.atan2(rise, hd), c = lin(col), rows = Math.max(3, Math.round(sl / 0.45));
  for (const sg of [1, -1]) for (let i = 0; i < rows; i++) { const t = (i + 0.5) / rows, zz = sg * hd * (1 - t), yy = y + rise * t; g.add(new THREE.BoxGeometry(hw * 2, 0.09, sl / rows * 1.15), c.clone().multiplyScalar(0.85 + r() * 0.25 - (i % 2) * 0.06), M(0, yy, zz, 1, 1, 1, sg * ang, 0, 0), 0.1, 0.04); }
  limb(g, new V3(-hw, y + rise + 0.04, 0), new V3(hw, y + rise + 0.04, 0), 0.1, 0.1, '#5a3c26', 6, 0.1);
  const cd = c.clone().multiplyScalar(0.7); // rives (planches de bord) et bas de pente épaissi
  for (const sx of [-1, 1]) for (const sg of [1, -1]) g.add(new THREE.BoxGeometry(0.12, 0.2, sl + 0.1), cd, M(sx * (hw + 0.02), y + rise / 2 + 0.04, sg * hd / 2, 1, 1, 1, sg * ang, 0, 0), 0.1, 0.02);
  for (const sg of [1, -1]) for (let k = 0; k < Math.round(hw * 3); k++) { const x = -hw + (k + 0.5) / Math.round(hw * 3) * hw * 2; g.add(new THREE.BoxGeometry(hw * 2 / Math.round(hw * 3) * 0.96, 0.1, 0.32 + r() * 0.12), c.clone().multiplyScalar(0.78 + r() * 0.2), M(x, y - 0.02, sg * (hd - 0.08), 1, 1, 1, sg * ang + (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.05), 0.1, 0.02); }
}
function gableEnds(g, W, D, y, rise, col) { // pignons pleins
  const c = lin(col); for (const sx of [-1, 1]) { const x = sx * W / 2, a = new V3(x, y, -D / 2), b = new V3(x, y, D / 2), t = new V3(x, y + rise, 0); g.triN(a, b, t, c, c, c.clone().multiplyScalar(1.05), new V3(sx, 0.2, 0).normalize()); g.triN(b, a, t, c, c, c, new V3(-sx, 0.2, 0).normalize()); }
}
function windowAt(g, x, y, z, w, h, frame = '#4a3020') { boxAt(g, frame, x, y, z, w + 0.16, 0.1, 0.16); boxAt(g, frame, x, y + h, z, w + 0.16, 0.1, 0.16); boxAt(g, frame, x - w / 2 - 0.04, y + h / 2, z, 0.08, h, 0.16); boxAt(g, frame, x + w / 2 + 0.04, y + h / 2, z, 0.08, h, 0.16); boxAt(g, frame, x, y + h / 2, z, 0.05, h, 0.14); g.add(new THREE.BoxGeometry(w, h, 0.04), GLOWC, M(x, y + h / 2, z), 0, 0); }
function shutters(g, x, y, z, w, h, col) { boxAt(g, col, x - w / 2 - 0.3, y + h / 2, z + 0.06, 0.42, h + 0.1, 0.05); boxAt(g, col, x + w / 2 + 0.3, y + h / 2, z + 0.06, 0.42, h + 0.1, 0.05); }
function barrel(g, x, y, z, s = 1, col = '#8a5a32') {
  g.add(lathe([[0.001, 0], [0.3, 0], [0.36, 0.2], [0.39, 0.45], [0.36, 0.7], [0.3, 0.9], [0.001, 0.9]].map(p => [p[0] * s, p[1] * s]), 14), col, M(x, y, z), 0.3, 0.12);
  for (const hy of [0.12, 0.45, 0.78]) g.add(new THREE.TorusGeometry((hy === 0.45 ? 0.395 : 0.355) * s, 0.018 * s, 5, 16), '#3a3632', M(x, y + hy * s, z, 1, 1, 1, Math.PI / 2, 0, 0), 0.2);
}
function crate(g, x, y, z, s = 1, ry = 0) { const c = '#a67c4a'; boxAt(g, c, x, y + 0.3 * s, z, 0.6 * s, 0.6 * s, 0.6 * s, ry, 0.25, 0.1); for (const d of [-1, 1]) { boxAt(g, '#7a5530', x + Math.cos(ry) * 0 , y + 0.3 * s, z, 0.64 * s, 0.08 * s, 0.64 * s, ry); boxAt(g, '#7a5530', x, y + (0.3 + d * 0.27) * s, z, 0.64 * s, 0.06 * s, 0.64 * s, ry); } }
function stool(g, x, y, z) { g.add(new THREE.CylinderGeometry(0.22, 0.2, 0.07, 12), '#8a5c34', M(x, y + 0.55, z), 0.2); for (let i = 0; i < 3; i++) { const a = i * 2.094; limb(g, new V3(x + Math.cos(a) * 0.14, y + 0.52, z + Math.sin(a) * 0.14), new V3(x + Math.cos(a) * 0.2, y, z + Math.sin(a) * 0.2), 0.025, 0.022, '#6a4426', 5, 0); } }
function table(g, x, y, z) { g.add(new THREE.CylinderGeometry(0.75, 0.72, 0.08, 18), '#9a6a3a', M(x, y + 0.85, z), 0.2, 0.06); limb(g, new V3(x, y, z), new V3(x, y + 0.82, z), 0.09, 0.07, '#6a4426', 8, 0); g.add(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 12), '#6a4426', M(x, y + 0.03, z), 0.2); }
function mug(g, x, y, z) { g.add(new THREE.CylinderGeometry(0.06, 0.055, 0.14, 10), '#c9a46a', M(x, y + 0.07, z), 0.2); g.add(new THREE.CylinderGeometry(0.052, 0.052, 0.01, 10), '#f4ecd8', M(x, y + 0.14, z), 0); }
function lampGlass(g, x, y, z, s = 1) { g.add(new THREE.CylinderGeometry(0.09 * s, 0.1 * s, 0.22 * s, 10), GLOWC, M(x, y, z), 0, 0); g.add(new THREE.ConeGeometry(0.14 * s, 0.12 * s, 10), '#2e2a26', M(x, y + 0.17 * s, z), 0.2); g.add(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.04 * s, 10), '#2e2a26', M(x, y - 0.12 * s, z), 0.2); }
function signTex(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#2a1a10'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 176);
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, i * 32, 512, 3); }
  x.fillStyle = fg; x.font = 'bold 58px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 100);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}

/* ---------- éléments plaçables (aussi dans l'éditeur) ---------- */
function stones(g, r, pts, sz, cols) { for (const [x, y, z] of pts) g.add(ICO0, cols[(r() * cols.length) | 0], M(x, y, z, sz * (0.8 + r() * 0.5), sz * (0.6 + r() * 0.3), sz * (0.8 + r() * 0.5), r(), r() * 6, r()), 0.35, 0.12); }
function gHouse(r, wall, roof, trim) { // cabane de pirates : soubassement de pierres, bardeaux épais, porche, croisillons, jardinières
  const g = new GB(), W = 5, D = 4.4, H = 2.7, SC = ['#8f8a80', '#7d776d', '#a39a8c', '#6e6a62'];
  // soubassement : bloc sombre habillé de pierres irrégulières
  boxAt(g, '#6a655c', 0, 0.12, 0, W + 0.2, 0.5, D + 0.2, 0, 0.3, 0.06);
  const sp = []; for (let k = 0; k < 14; k++) { const t = (k + 0.5) / 14; sp.push([-W / 2 - 0.1 + t * (W + 0.2), 0.18 + r() * 0.12, D / 2 + 0.12], [-W / 2 - 0.1 + t * (W + 0.2), 0.18 + r() * 0.12, -D / 2 - 0.12]); }
  for (let k = 0; k < 12; k++) { const t = (k + 0.5) / 12; sp.push([W / 2 + 0.12, 0.18 + r() * 0.12, -D / 2 - 0.1 + t * (D + 0.2)], [-W / 2 - 0.12, 0.18 + r() * 0.12, -D / 2 - 0.1 + t * (D + 0.2)]); }
  stones(g, r, sp, 0.2, SC);
  // murs de planches
  plankWall(g, r, -W / 2, W / 2, 0.35, H, D / 2, wall, { hole: [-0.5, 0.5, 0.3, 2.1] }); plankWall(g, r, -W / 2, W / 2, 0.35, H, -D / 2, wall);
  for (const sx of [-1, 1]) { const gs = new GB(); plankWall(gs, r, -D / 2, D / 2, 0.35, H, 0, wall); g.addGB(gs, M(sx * W / 2, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0)); }
  // poutres d'angle, sablière et croisillons sur les pignons
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) boxAt(g, trim, x, H / 2 + 0.2, z, 0.28, H + 0.15, 0.28);
  for (const z of [-D / 2, D / 2]) boxAt(g, trim, 0, H + 0.02, z + Math.sign(z) * 0.06, W + 0.3, 0.2, 0.16);
  for (const sx of [-1, 1]) { const x = sx * (W / 2 + 0.07); limb(g, new V3(x, 0.5, -D / 2 + 0.2), new V3(x, H - 0.1, -0.15), 0.06, 0.06, trim, 4, 0); limb(g, new V3(x, 0.5, D / 2 - 0.2), new V3(x, H - 0.1, 0.15), 0.06, 0.06, trim, 4, 0); boxAt(g, trim, x, 1.45, 0, 0.12, 0.14, D - 0.3); }
  // porte : chambranle, planches verticales, auvent sur consoles, marches et lanterne
  boxAt(g, '#5a3a22', 0, 1.2, D / 2 + 0.02, 0.95, 1.8, 0.06); for (let k = -1; k <= 1; k++) boxAt(g, '#4a2f1b', k * 0.3, 1.2, D / 2 + 0.06, 0.03, 1.7, 0.02, 0, 0, 0);
  boxAt(g, '#3a2414', 0, 0.75, D / 2 + 0.07, 0.8, 0.08, 0.03); boxAt(g, '#3a2414', 0, 1.65, D / 2 + 0.07, 0.8, 0.08, 0.03);
  for (const sx of [-1, 1]) boxAt(g, trim, sx * 0.55, 1.2, D / 2 + 0.06, 0.14, 1.95, 0.14); boxAt(g, trim, 0, 2.2, D / 2 + 0.06, 1.3, 0.14, 0.14);
  g.add(SPHL, '#d9b04a', M(0.32, 1.15, D / 2 + 0.09, 0.045), 0);
  const aw = new GB(); gableRoof(aw, r, 1.0, 0.9, 0, 0.32, roof, 0.12); g.addGB(aw, M(0, 2.45, D / 2 + 0.5));
  for (const sx of [-1, 1]) limb(g, new V3(sx * 0.6, 2.05, D / 2 + 0.05), new V3(sx * 0.6, 2.45, D / 2 + 0.75), 0.04, 0.04, trim, 4, 0);
  boxAt(g, '#9a7a55', 0, 0.33, D / 2 + 0.45, 1.3, 0.16, 0.5); boxAt(g, '#8f7050', 0, 0.16, D / 2 + 0.75, 1.4, 0.16, 0.45);
  limb(g, new V3(0.85, 1.55, D / 2 + 0.06), new V3(0.85, 1.55, D / 2 + 0.32), 0.025, 0.025, '#2e2a26', 4, 0); lampGlass(g, 0.85, 1.32, D / 2 + 0.34, 0.9);
  // fenêtres, volets et jardinières fleuries
  for (const wx of [-1.55, 1.55]) {
    windowAt(g, wx, 1.1, D / 2 + 0.03, 0.7, 0.75, trim); shutters(g, wx, 1.1, D / 2 + 0.03, 0.7, 0.75, trim);
    boxAt(g, '#7a5232', wx, 0.98, D / 2 + 0.2, 0.95, 0.2, 0.26);
    for (let k = 0; k < 6; k++) { const fx = wx - 0.38 + k * 0.15 + (r() - 0.5) * 0.05; g.add(SPH, '#3f7f32', M(fx, 1.12, D / 2 + 0.2, 0.09, 0.07, 0.09), 0.3, 0); g.add(SPH, ['#e04a5a', '#f2c230', '#f07aa8', '#ffffff'][(r() * 4) | 0], M(fx, 1.18 + r() * 0.04, D / 2 + 0.24, 0.05), 0.2, 0); }
  }
  windowAt(g, 0, 1.1, -D / 2 - 0.03, 0.7, 0.75, trim);
  // toit : bardeaux épais avec rives et faîtage
  gableEnds(g, W, D, H, 1.6, wall); gableRoof(g, r, W + 0.2, D, H, 1.6, roof, 0.6);
  // cheminée en pierres empilées, un peu de travers
  const cx = 1.4, cz = -0.6, cs = []; for (let k = 0; k < 7; k++) for (const [ox, oz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) cs.push([cx + ox + k * 0.01, H + 0.7 + k * 0.24, cz + oz]);
  boxAt(g, '#6e6a62', cx + 0.03, H + 1.45, cz, 0.48, 1.7, 0.48, 0, 0.3, 0.04); stones(g, r, cs, 0.17, SC); boxAt(g, '#5a5650', cx + 0.07, H + 2.4, cz, 0.6, 0.12, 0.6);
  return g.build();
}
function gBarrelP(r) { const g = new GB(); barrel(g, 0, 0, 0); return g.build(); }
function gCrates(r) { const g = new GB(); crate(g, 0, 0, 0, 1, 0); crate(g, 0.66, 0, 0.1, 0.9, 0.3); crate(g, 0.3, 0.6, 0.05, 0.85, -0.2); return g.build(); }
function gLampPost(r) { const g = new GB(); limb(g, new V3(0, 0, 0), new V3(0, 3.0, 0), 0.07, 0.06, '#4a3020', 6, 0.1); limb(g, new V3(0, 2.9, 0), new V3(0.55, 2.95, 0), 0.04, 0.04, '#4a3020', 5, 0); limb(g, new V3(0.5, 2.95, 0), new V3(0.5, 2.75, 0), 0.01, 0.01, '#2e2a26', 3, 0); lampGlass(g, 0.5, 2.55, 0, 1.2); boxAt(g, '#5a5048', 0, 0.1, 0, 0.35, 0.2, 0.35); return g.build(); }
function gNets(r) {
  const g = new GB(); for (const x of [-1.6, 1.6]) limb(g, new V3(x, -0.2, 0), new V3(x, 2.2, 0), 0.07, 0.06, '#6a4a2e', 6, 0.1); limb(g, new V3(-1.7, 2.1, 0), new V3(1.7, 2.1, 0), 0.04, 0.04, '#6a4a2e', 5, 0);
  g.wf = 0.4; for (let i = 0; i <= 12; i++) { const x = -1.5 + i * 0.25; limb(g, new V3(x, 2.05, 0), new V3(x + 0.05, 0.6 + Math.sin(i) * 0.1, 0.08), 0.006, 0.006, '#3a3a34', 3, 0); }
  for (let j = 0; j < 7; j++) { const y = 0.7 + j * 0.2; limb(g, new V3(-1.5, y, 0.04), new V3(1.5, y + 0.05, 0.04), 0.006, 0.006, '#3a3a34', 3, 0); }
  g.add(SPHL, '#d84a32', M(-0.8, 0.9, 0.08, 0.1), 0.2); g.add(SPHL, '#e8c84a', M(0.6, 1.3, 0.08, 0.09), 0.2); return g.build();
}
function gWell(r) {
  const g = new GB(); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832; boxAt(g, i % 2 ? '#9a948a' : '#8a847a', Math.cos(a) * 0.95, 0.4, Math.sin(a) * 0.95, 0.45, 0.8, 0.3, -a + 1.57, 0.3, 0.1); }
  g.add(new THREE.CircleGeometry(0.85, 16), '#1a2a38', M(0, 0.35, 0, 1, 1, 1, -Math.PI / 2, 0, 0), 0);
  for (const x of [-0.95, 0.95]) limb(g, new V3(x, 0.6, 0), new V3(x, 2.3, 0), 0.07, 0.07, '#6a4a2e', 6, 0.1);
  limb(g, new V3(-1, 1.8, 0), new V3(1, 1.8, 0), 0.06, 0.06, '#5a3a22', 6, 0); const gr = new GB(); gableRoof(gr, r, 2.2, 1.4, 2.25, 0.7, '#a8432f', 0.2); g.addGB(gr, M(0, 0, 0));
  barrel(g, 0.3, 1.2, 0, 0.35, '#7a5030'); return g.build();
}
function gFlag(r) {
  const g = new GB(); limb(g, new V3(0, 0, 0), new V3(0, 7, 0), 0.08, 0.05, '#5a3a22', 6, 0.1); g.add(SPHL, '#d9b04a', M(0, 7.05, 0, 0.1), 0.2);
  const W = 2.2, Hh = 1.4, nx = 10, ny = 5, c = lin('#1c1a1e'), w = lin('#efe8d8');
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x0 = i / nx * W, x1 = (i + 1) / nx * W, y0 = 6.9 - j / ny * Hh, y1 = 6.9 - (j + 1) / ny * Hh, f0 = Math.pow(i / nx, 1.2), f1 = Math.pow((i + 1) / nx, 1.2); const cx = (i + 0.5) / nx * W - W * 0.45, cy = (j + 0.5) / ny - 0.5, sk = Math.hypot(cx * 1.3, cy * 1.4) < 0.33; const cc = sk ? w : c; g.tri(new V3(x0, y0, 0), new V3(x1, y0, 0), new V3(x1, y1, 0), cc, cc, cc, f0, f1, f1); g.tri(new V3(x0, y0, 0), new V3(x1, y1, 0), new V3(x0, y1, 0), cc, cc, cc, f0, f1, f0); }
  return g.build();
}
function gRowboat(r) {
  const g = new GB(), pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.001 + 0.62 * Math.sin(Math.PI * t) ** 0.6, t * 3.2 - 1.6]); }
  const hull = lathe([[0.001, -1.6], [0.5, -1.2], [0.66, 0], [0.5, 1.2], [0.001, 1.6]], 14); hull.applyMatrix4(M(0, 0, 0, 1, 0.55, 1, Math.PI / 2, 0, 0));
  const p = hull.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, 0.02); hull.computeVertexNormals();
  g.add(hull, '#3f7f8a', M(0, 0.35, 0), 0.35, 0.08); for (const z of [-0.5, 0.5]) boxAt(g, '#9a6a3a', 0, 0.3, z, 1.1, 0.06, 0.28);
  limb(g, new V3(-0.5, 0.36, 0.2), new V3(0.7, 0.2, 1.4), 0.025, 0.025, '#b08a5a', 4, 0); return g.build();
}
function gWoodPile(r) { const g = new GB(); for (let i = 0; i < 9; i++) { const row = i < 4 ? 0 : i < 7 ? 1 : 2, k = i - [0, 4, 7][row]; limb(g, new V3(-0.6, 0.12 + row * 0.2, (k - [1.5, 1, 0.5][row]) * 0.22), new V3(0.6, 0.12 + row * 0.2, (k - [1.5, 1, 0.5][row]) * 0.22), 0.1, 0.1, i % 2 ? '#8a6038' : '#7a5230', 7, 0.1); } return g.build(); }
function gCannon(r) { const g = new GB(); limb(g, new V3(0, 0.45, -0.5), new V3(0, 0.6, 1.1), 0.2, 0.13, '#2e3034', 12, 0.06); g.add(SPHL, '#2e3034', M(0, 0.45, -0.55, 0.2), 0.3); boxAt(g, '#7a5230', 0, 0.3, 0, 0.6, 0.25, 1.3); for (const x of [-0.32, 0.32]) for (const z of [-0.45, 0.45]) g.add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10), '#5a3a22', M(x, 0.17, z, 1, 1, 1, 0, 0, Math.PI / 2), 0.2); return g.build(); }

/* ---------- PNJ cartoon ---------- */
const NPCM = () => VIL.npcMat || (VIL.npcMat = mat({ grain: 1.2, ga: 0.12 }));
function part(build) { const g = new GB(); build(g); return new THREE.Mesh(g.build(), NPCM()); }
function makeNPC(o) {
  const root = new THREE.Group(), hips = new THREE.Group(), sk = o.skin || '#e0a07a', sh = o.shirt || '#d8d0bc', pa = o.pants || '#3f4a5a', bo = '#3a2618', hs = o.h || 1;
  root.add(hips); hips.position.y = 0.9 * hs;
  const leg = sx => { const p = new THREE.Group(); p.position.set(sx * 0.11, 0, 0); p.add(part(g => { tube(g, [new V3(0, 0.04, 0), new V3(0, -0.2 * hs, 0.01), new V3(0, -0.42 * hs, 0.03), new V3(0, -0.6 * hs, 0.0)], i => [0.105, 0.092, 0.075, 0.068][i], pa, 10, 0.03, () => 0); /* cuisse, genou, mollet */
    tube(g, [new V3(0, -0.56 * hs, 0), new V3(0, -0.8 * hs, 0.005)], i => [0.078, 0.07][i], bo, 10, 0.02, () => 0); g.add(new THREE.CylinderGeometry(0.088, 0.082, 0.06, 10), '#4a3020', M(0, -0.56 * hs, 0), 0.2); /* tige de botte et revers */
    g.add(rbox(0.075, 0.06, 0.13), bo, M(0, -0.83 * hs, 0.06), 0.3); g.add(new THREE.BoxGeometry(0.16, 0.025, 0.29), '#241810', M(0, -0.87 * hs, 0.06), 0.2); /* pied et semelle */ if (o.peg && sx > 0) g.add(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8), '#8a6a44', M(0, -0.75 * hs, 0), 0.2); })); hips.add(p); return p; };
  const legL = leg(-1), legR = leg(1);
  const torso = new THREE.Group(); hips.add(torso);
  const bl = o.belly || 1;
  torso.add(part(g => {
    tube(g, [new V3(0, -0.05, 0), new V3(0, 0.14, 0.02 * bl), new V3(0, 0.34, 0.025), new V3(0, 0.5, 0.0), new V3(0, 0.58, -0.01)], i => [0.19, 0.2 * bl, 0.23, 0.25, 0.13][i], sh, 14, 0.03, () => 0);
    for (const sx of [-1, 1]) g.add(SPH, sh, M(sx * 0.18, 0.49, -0.01, 0.095, 0.07, 0.095), 0.3); /* épaules */
    for (const sx of [-1, 1]) g.add(new THREE.BoxGeometry(0.11, 0.025, 0.02), sh, M(sx * 0.05, 0.56, 0.115, 1, 1, 1, 0.3, 0, sx * 0.55), 0.15); /* col */
    if (o.vest) { tube(g, [new V3(0, 0.0, 0), new V3(0, 0.3, 0.01), new V3(0, 0.55, 0)], i => [0.215 * bl, 0.24, 0.2][i] * 1.02, o.vest, 14, 0.05, () => 0); }
    g.add(new THREE.TorusGeometry(0.205 * bl, 0.035, 6, 18), '#3a2618', M(0, 0.0, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.2); boxAt(g, '#d9b04a', 0, 0, 0.21 * bl, 0.09, 0.07, 0.03, 0, 0.1, 0);
    if (o.sash) g.add(new THREE.TorusGeometry(0.215 * bl, 0.045, 6, 18), o.sash, M(0, 0.07, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.2);
    if (o.apron) g.add(rbox(0.2, 0.3, 0.03), o.apron, M(0, -0.1, 0.2 * bl), 0.2);
  }));
  const head = new THREE.Group(); head.position.y = 0.66; head.scale.setScalar(0.84); torso.add(head); /* proportions plus réalistes : tête plus petite */
  head.add(part(g => {
    tube(g, [new V3(0, -0.14, 0), new V3(0, 0.06, 0.01)], i => [0.085, 0.075][i], sk, 10, 0, () => 0);
    g.add(SPH, sk, M(0, 0.2, 0, 0.18, 0.22, 0.19), 0.3); g.add(SPH, sk, M(0, 0.1, 0.06, 0.14, 0.1, 0.13), 0.3); /* crâne et mâchoire */
    g.add(SPH, o.nose || '#d48a68', M(0, 0.175, 0.185, 0.032, 0.05, 0.05, 0.25, 0, 0), 0.3); g.add(SPH, o.nose || '#d48a68', M(0, 0.15, 0.2, 0.034, 0.025, 0.03), 0.3);
    for (const sx of [-1, 1]) { g.add(SPHL, '#f4efe6', M(sx * 0.068, 0.235, 0.158, 0.036, 0.03, 0.025), 0); if (!(o.patch && sx > 0)) { g.add(SPHL, o.eyes || '#5a4030', M(sx * 0.068, 0.235, 0.178, 0.019, 0.021, 0.01), 0); g.add(SPHL, '#141210', M(sx * 0.068, 0.235, 0.186, 0.009, 0.01, 0.006), 0); g.add(SPHL, '#ffffff', M(sx * 0.064, 0.242, 0.19, 0.004), 0); }
      g.add(SPH, sk, M(sx * 0.068, 0.252, 0.163, 0.042, 0.016, 0.028, -0.2, 0, 0), 0.2); /* paupière */
      g.add(new THREE.BoxGeometry(0.075, 0.018, 0.025), o.hair || '#3a2a20', M(sx * 0.07, 0.285, 0.175, 1, 1, 1, 0, 0, sx * -0.12), 0.1); /* sourcil */
      g.add(SPH, sk, M(sx * 0.178, 0.2, -0.01, 0.03, 0.05, 0.035), 0.3); g.add(SPH, lin(sk).multiplyScalar(0.8), M(sx * 0.185, 0.2, -0.002, 0.014, 0.03, 0.02), 0.2); } /* oreille */
    if (o.patch) { g.add(SPHL, '#1a1a1a', M(0.075, 0.24, 0.175, 0.055, 0.055, 0.025), 0); g.add(new THREE.TorusGeometry(0.2, 0.008, 4, 20), '#1a1a1a', M(0, 0.26, 0, 1, 1, 1, 0.35, 0, -0.2), 0); }
    if (o.beard) g.add(SPH, o.beard, M(0, 0.08, 0.08, 0.17, 0.16, 0.14), 0.3);
    if (o.mous) { for (const sx of [-1, 1]) g.add(SPHL, o.mous, M(sx * 0.05, 0.12, 0.2, 0.06, 0.022, 0.025, 0, 0, sx * 0.3), 0.1); }
    g.add(SPH, '#a8584c', M(0, 0.105, 0.172, 0.04, 0.011, 0.015), 0.1); g.add(SPH, '#b8665a', M(0, 0.092, 0.17, 0.033, 0.012, 0.015), 0.1); /* lèvres */
    if (o.hair && o.hat !== 'bandana') g.add(SPH, o.hair, M(0, 0.24, -0.04, 0.21, 0.2, 0.19), 0.3);
    if (o.bun) g.add(SPH, o.hair, M(0, 0.36, -0.14, 0.09), 0.3);
    if (o.hat === 'tricorne') { g.add(SPH, o.hatc || '#2a2420', M(0, 0.36, 0, 0.19, 0.12, 0.19), 0.3); for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.57; g.add(new THREE.BoxGeometry(0.42, 0.13, 0.04), o.hatc || '#2a2420', M(Math.cos(a) * 0.17, 0.38, Math.sin(a) * 0.17, 1, 1, 1, -0.5, -a + 1.57, 0), 0.2); } g.add(new THREE.BoxGeometry(0.4, 0.02, 0.03), '#d9b04a', M(0, 0.32, 0.27), 0); }
    else if (o.hat === 'bandana') { g.add(SPH, o.hatc || '#c0392b', M(0, 0.27, -0.01, 0.205, 0.17, 0.2), 0.3); g.add(SPHL, o.hatc || '#c0392b', M(0, 0.24, -0.22, 0.06), 0.3); for (const sx of [-1, 1]) g.add(new THREE.BoxGeometry(0.05, 0.16, 0.02), o.hatc || '#c0392b', M(sx * 0.04, 0.14, -0.24, 1, 1, 1, 0.3, 0, sx * 0.3), 0.2); }
    else if (o.hat === 'cap') { g.add(SPH, o.hatc || '#3a5a7a', M(0, 0.3, -0.01, 0.2, 0.13, 0.2), 0.3); }
    else if (o.hat === 'straw') { g.add(SPH, '#d9be6a', M(0, 0.33, 0, 0.18, 0.12, 0.18), 0.3); g.add(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 18), '#e2c878', M(0, 0.32, 0), 0.2); g.add(new THREE.TorusGeometry(0.18, 0.02, 5, 16), '#a8432f', M(0, 0.34, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0); }
    if (o.earring) g.add(new THREE.TorusGeometry(0.025, 0.006, 4, 10), '#e8c84a', M(-0.19, 0.13, 0.01), 0);
  }));
  const arm = sx => { const p = new THREE.Group(); p.position.set(sx * 0.27, 0.5, 0); p.add(part(g => { g.add(SPH, sh, M(0, 0, 0, 0.1), 0.3); tube(g, [new V3(0, 0, 0), new V3(sx * 0.025, -0.15, 0.0), new V3(sx * 0.03, -0.28, 0.0), new V3(sx * 0.025, -0.42, 0.03), new V3(sx * 0.02, -0.53, 0.04)], i => [0.08, 0.072, 0.062, 0.058, 0.048][i], i => i < 3 ? (o.vest && !o.sleeves ? sk : sh) : sk, 10, 0.03, () => 0); /* épaule, coude, avant-bras, poignet */
      if (!(o.vest && !o.sleeves)) g.add(new THREE.CylinderGeometry(0.066, 0.07, 0.05, 10), lin(sh).multiplyScalar(0.85), M(sx * 0.03, -0.3, 0.005), 0.2); /* manche retroussée */
      g.add(rbox(0.045, 0.06, 0.03), sk, M(sx * 0.02, -0.59, 0.045), 0.3); g.add(SPH, sk, M(sx * 0.02 - sx * 0.035, -0.57, 0.07, 0.018, 0.035, 0.018, 0.4, 0, -sx * 0.4), 0.3); /* main et pouce */ if (o.hook && sx > 0) { g.add(new THREE.TorusGeometry(0.05, 0.012, 5, 10, 4.5), '#b8b8b8', M(sx * 0.02, -0.66, 0.03), 0.2); } })); torso.add(p); return p; };
  const armL = arm(-1), armR = arm(1);
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  scene.add(root);
  return { g: root, hips, torso, head, legL, legR, armL, armR, o, ph: Math.random() * 6, hs };
}
// accessoires tenus
function propMesh(build, parent, x, y, z) { const m = part(build); m.position.set(x, y, z); parent.add(m); return m; }

/* ---------- dialogues (arbres à choix) ---------- */
// chaque nœud : { t: texte, c: [[réponse, nœud suivant | null pour finir, effet?]] }
const DIALOG = {
  barbe: {
    start: { t: 'Encore un naufragé... Bienvenue au Mouillage du Kraken, moussaillon. Tu as la tête de quelqu\'un qui a nagé longtemps.', c: [['Où suis-je exactement ?', 'ile'], ['Qui êtes-vous ?', 'qui'], ['Je vais me débrouiller.', null]] },
    ile: { t: 'Sur l\'Île aux Fougères. Le vent y décide de tout, même de l\'humeur du cuisinier. Au nord-est, il y a un phare ; au centre, la montagne.', c: [['Et ce phare ?', 'phare'], ['Merci.', null]] },
    phare: { t: 'Un savant y vit. Il invente des machins qui font « bzzt ». On dit qu\'il cherche quelqu\'un pour essayer ses inventions.', c: [['Intéressant.', null]] },
    qui: { t: 'On m\'appelle Barbe-Grise. J\'ai navigué sur sept mers, et je me suis perdu sur six. Ici, au moins, je sais où est la taverne.', c: [['La taverne ?', 'tav'], ['Au revoir.', null]] },
    tav: { t: 'Le Kraken Assoiffé, juste derrière. Mélusine y sert la meilleure soupe de poisson à cent milles à la ronde. La seule, aussi.', c: [['J\'y vais.', null]] }
  },
  melusine: {
    start: { t: 'Bienvenue au Kraken Assoiffé ! Essuie tes pieds, le sable c\'est pour la plage. Qu\'est-ce que je te sers ?', c: () => [['Une soupe de poisson.', 'soupe'], ...(FR.fish > 0 ? [['J\'ai pêché un poisson pour toi.', 'merci', 'giveFish']] : []), ['Du travail, plutôt.', 'job'], ['Rien, merci.', null]] },
    merci: { t: 'Oh ! Il est encore tout frétillant. Ce soir, soupe pour tout le monde... et la première assiette est pour toi.', c: [['Avec plaisir.', null]] },
    soupe: { t: 'Ha ! Il faudrait d\'abord du poisson. Gaspard, sur le ponton, n\'a rien pris depuis mardi. Ou depuis l\'an dernier, je ne sais plus.', c: [['Je vais voir Gaspard.', null], ['Autre chose ?', 'start']] },
    job: { t: 'Joséphin a perdu le rythme, et les clients s\'ennuient. Si tu sais jouer du banjo, la scène est à toi. Le banjo est sur son support.', c: [['Je vais essayer !', null, 'banjoHint']] }
  },
  josephin: {
    start: { t: 'Ah, tu as l\'air d\'avoir des doigts agiles. Tu sais tenir un banjo ?', c: [['Montre-moi comment.', 'how'], ['Pas vraiment.', 'non']] },
    how: { t: 'Quatre cordes, quatre touches : D, F, J et K. Pince la corde quand la note arrive sur le cercle. Le banjo t\'attend sur la scène.', c: [['Compris !', null]] },
    non: { t: 'Personne ne sait, au début. Même pas moi. Surtout pas moi, d\'ailleurs.', c: [['Bon, j\'essaierai.', null]] },
    after: { t: 'Pas mal du tout ! Les vieux loups de mer ont tapé du pied, c\'est bon signe. Reviens quand tu veux.', c: [['Merci !', null]] }
  },
  rosalie: {
    start: { t: 'Les filets, c\'est comme les histoires : il faut les raccommoder tous les jours, sinon tout s\'échappe.', c: [['Il y a des poissons ici ?', 'poisson'], ['Bonne journée.', null]] },
    poisson: { t: 'Des dorés dans les eaux chaudes du sud, des rayés près des rochers, et des requins paresseux au large. Mais sans bateau...', c: [['Où trouver un bateau ?', 'bateau'], ['Merci.', null]] },
    bateau: { t: 'La barque au bord de l\'eau appartient à Gaspard. Le voilier, lui, attend un capitaine depuis longtemps.', c: [['Je retiens.', null]] }
  },
  gaspard: {
    start: { t: 'Chut. Ils mordent mieux quand on se tait.', c: () => [['...', 'silence'], ['Ça mord ?', 'mord'], ...(G.hasRod ? [] : [['Tu me prêterais une canne ?', 'canne', 'giveRod']])] },
    canne: { t: 'Tiens, prends ma vieille canne. Lance au clic, attends que le bouchon plonge, et clique vite. Les plus beaux poissons sont au large... ou la nuit.', c: [['Merci Gaspard !', null]] },
    silence: { t: '...', c: [['...', 'msg']] },
    msg: { t: 'Un jour, j\'ai repêché une bouteille. Le message disait juste : « Bonjour ». Alors j\'ai répondu. J\'attends toujours.', c: [['C\'est beau.', null]] },
    mord: { t: 'Si ça mordait, je ne serais pas en train de te parler.', c: [['Pardon.', null]] }
  },
  tobias: {
    start: { t: 'Je fais ma ronde. Personne ne m\'a demandé de la faire, mais c\'est important.', c: [['Tout est calme ?', 'calme'], ['Bon courage.', null]] },
    calme: { t: 'Regarde les nuages : quand ils filent vers la montagne, la nuit sera douce. Quand ils reviennent vers la mer... ferme tes volets.', c: [['Merci du conseil.', null]] }
  },
  hector: { start: { t: 'Zzz... encore cinq minutes... Zzz...', c: [['Le réveiller.', 'reveil'], ['Le laisser dormir.', null]] }, reveil: { t: 'Hmpf ! Qui ose... ah, c\'est toi. Personne. Zzz...', c: [['...', null]] } },
  borgne: { start: { t: 'Santé ! Tu joues du banjo, toi ? Prouve-le, et la prochaine tournée est pour moi.', c: [['Marché conclu.', null]] } },
  marguerite: { start: { t: 'On raconte qu\'une fille du village réveille les dormeurs de la plage en leur jetant des cailloux. Méfie-toi si tu fais la sieste.', c: [['Je ferai attention.', null]] } },
  coco: { start: { t: 'Coco veut un citron ! Il n\'y a qu\'un citronnier ! Squaaawk !', c: [['...', null]] } }
};
function openTalk(n) {
  const d = DIALOG[n.id]; VIL.talk = { n, node: n.next || 'start', sel: 0 }; n.next = null; renderTalk(); sfx('talk');
  if (document.pointerLockElement && TOUCH) { }
}
function renderTalk() {
  const T = VIL.talk, box = $('talk'); if (!T) { box.style.display = 'none'; return; }
  const nd = dnode(T); box.style.display = 'block';
  box.querySelector('.who').textContent = T.n.name; box.querySelector('.txt').textContent = nd.t;
  const ch = box.querySelector('.ch'); ch.innerHTML = '';
  nd.c.forEach((c, i) => { const b = document.createElement('div'); b.className = 'opt' + (i === T.sel ? ' on' : ''); b.innerHTML = '<b>' + (i + 1) + '</b>' + c[0]; b.onpointerdown = e => { e.stopPropagation(); T.sel = i; chooseTalk(); }; ch.appendChild(b); });
  T.ty = 0;
}
function dnode(T) { const raw = DIALOG[T.n.id][T.node]; return { t: typeof raw.t === 'function' ? raw.t() : raw.t, c: typeof raw.c === 'function' ? raw.c() : raw.c }; }
function chooseTalk(i) {
  const T = VIL.talk; if (!T) return; if (i !== undefined) T.sel = i;
  const c = dnode(T).c[T.sel]; if (!c) return; sfx('tick');
  if (c[2] === 'banjoHint') VIL.banjoHint = true;
  if (typeof c[2] === 'function') { const r = c[2](); if (r === 'close') { closeTalk(); return; } }
  else if (typeof c[2] === 'string' && window.TALKFX && TALKFX[c[2]]) { const r = TALKFX[c[2]](); if (r === 'close') { closeTalk(); return; } }
  if (c[1]) { T.node = c[1]; T.sel = 0; renderTalk(); } else closeTalk();
}
function closeTalk() { VIL.talk = null; renderTalk(); }
function talkKey(code) {
  const T = VIL.talk; if (!T) return false; const n = dnode(T).c.length;
  if (code.startsWith('Digit')) { const k = +code.slice(5) - 1; if (k >= 0 && k < n) { chooseTalk(k); return true; } }
  if (code === 'ArrowDown' || code === 'KeyS') { T.sel = (T.sel + 1) % n; renderTalk(); return true; }
  if (code === 'ArrowUp' || code === 'KeyW') { T.sel = (T.sel + n - 1) % n; renderTalk(); return true; }
  if (code === 'KeyE' || code === 'Enter' || code === 'Space') { chooseTalk(); return true; }
  if (code === 'Escape' || code === 'Backspace') { closeTalk(); return true; }
  return false;
}

/* ---------- construction du village ---------- */
let tavLight, plazaLight, banjoStand, banjoProp, josephinNPC;
const TAV = {};
function buildVillage() {
  const d = Math.hypot(VILLAGE.x, VILLAGE.z); VD.x = VILLAGE.x / d; VD.z = VILLAGE.z / d; VD.px = -VD.z; VD.pz = VD.x;
  const r = mulberry(909), ang = Math.atan2(VD.x, VD.z);
  const propM = mat({ ds: true, grain: 2.4, ga: 0.3 });
  /* taverne */
  const tc = vp(-15, 0), W = 14, D = 10, H = 3.8;
  let base = -1e9; for (const [a, b] of [[-7, -5], [7, -5], [-7, 5], [7, 5], [0, 0]]) { const F0 = new Frame(tc.x, tc.z, ang, 0), p = F0.w(a, b); base = Math.max(base, heightAt(p.x, p.z)); } base += 0.4;
  const F = new Frame(tc.x, tc.z, ang, base); TAV.F = F; TAV.W = W; TAV.D = D; TAV.base = base;
  const g = new GB();
  boxAt(g, '#8f8a80', 0, base - 0.6, 0, W + 0.4, 1.3, D + 0.4, 0, 0.3, 0.12); // soubassement
  for (let i = 0; i < 30; i++) boxAt(g, i % 2 ? '#9a6e42' : '#8a6038', -W / 2 + (i + 0.5) * W / 30, base + 0.03, 0, W / 30 * 0.94, 0.08, D - 0.1, 0, 0.1, 0.06); // plancher
  const wc = '#7a5232', trim = '#4a3020';
  const gw = new GB(); plankWall(gw, r, -W / 2, W / 2, base, base + H, 0, wc, { hole: [-1.0, 1.0, base, base + 2.5] }); g.addGB(gw, M(0, 0, D / 2));
  const gb2 = new GB(); plankWall(gb2, r, -W / 2, W / 2, base, base + H, 0, wc); g.addGB(gb2, M(0, 0, -D / 2));
  for (const sx of [-1, 1]) { const gs = new GB(); plankWall(gs, r, -D / 2, D / 2, base, base + H, 0, wc, { hole: [-0.6, 0.6, base + 1.3, base + 2.4] }); g.addGB(gs, M(sx * W / 2, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0)); }
  for (const sx of [-1, 1]) { const wg = new GB(); windowAt(wg, 0, base + 1.3, 0, 1.2, 1.1, trim); g.addGB(wg, M(sx * (W / 2 + 0.02), 0, 0, 1, 1, 1, 0, Math.PI / 2, 0)); }
  for (const x of [-4.5, 4.5]) { windowAt(g, x, base + 1.3, D / 2 + 0.04, 1.3, 1.1, trim); shutters(g, x, base + 1.3, D / 2 + 0.04, 1.3, 1.1, '#2f6a6e'); }
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) boxAt(g, trim, x, base + H / 2, z, 0.3, H + 0.2, 0.3);
  boxAt(g, trim, 0, base + 2.6, D / 2 + 0.06, 2.4, 0.18, 0.2); boxAt(g, trim, -1.1, base + 1.3, D / 2 + 0.06, 0.18, 2.6, 0.2); boxAt(g, trim, 1.1, base + 1.3, D / 2 + 0.06, 0.18, 2.6, 0.2);
  gableEnds(g, W, D, base + H, 2.6, wc); gableRoof(g, r, W, D, base + H, 2.6, '#a8432f', 0.7);
  boxAt(g, '#6e665e', 4.5, base + H + 2.2, -2.2, 0.8, 2.6, 0.8, 0, 0.3, 0.1); // cheminée
  // porche et marches
  for (let i = 0; i < 2; i++) boxAt(g, '#8a6038', 0, base - 0.15 - i * 0.18, D / 2 + 0.55 + i * 0.45, 2.6, 0.12, 0.5, 0, 0.2, 0.08);
  for (const x of [-1.4, 1.4]) { limb(g, new V3(x, base - 0.3, D / 2 + 1.2), new V3(x, base + 2.9, D / 2 + 1.2), 0.09, 0.08, trim, 6, 0.1); lampGlass(g, x, base + 2.4, D / 2 + 1.0, 1.1); }
  boxAt(g, '#9a6e42', 0, base + 3.0, D / 2 + 0.75, 3.4, 0.1, 1.7, 0, 0.15, 0.08);
  /* intérieur */
  // comptoir
  boxAt(g, '#6a4426', -1.8, base + 0.55, -2.4, 6.4, 1.1, 0.75, 0, 0.25, 0.08); boxAt(g, '#9a6a3a', -1.8, base + 1.13, -2.35, 6.7, 0.08, 0.95, 0, 0.1, 0.05);
  for (let i = 0; i < 3; i++) boxAt(g, '#5a3a22', -1.8, base + 1.5 + i * 0.6, -4.82, 6.4, 0.06, 0.32);
  for (let i = 0; i < 30; i++) { const x = -4.8 + (i % 10) * 0.62 + r() * 0.15, y = base + 1.53 + Math.floor(i / 10) * 0.6, c = ['#2f6a3a', '#7a2a24', '#c9a24a', '#3a4a7a', '#5a3a22'][(r() * 5) | 0]; g.add(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 8), c, M(x, y + 0.12, -4.8), 0.2); g.add(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 6), c, M(x, y + 0.29, -4.8), 0.2); }
  for (const [x, z] of [[-6.2, -4.2], [-5.4, -4.3], [-6.2, -3.4]]) barrel(g, x, base, z, 1.1); barrel(g, -5.8, base + 0.99, -3.9, 1.0);
  for (const x of [-4, -2.4, -0.8, 0.8]) stool(g, x, base, -1.4);
  for (const x of [-4.2, -1.6, 0.6]) mug(g, x, base + 1.17, -2.3);
  // tables
  TAV.tables = [[-3.2, 1.4], [0.6, 2.4], [-5.2, 3.2], [3.0, 3.4]];
  for (const [x, z] of TAV.tables) { table(g, x, base, z); for (let k = 0; k < 3; k++) { const a = k * 2.094 + x; stool(g, x + Math.cos(a) * 1.05, base, z + Math.sin(a) * 1.05); } mug(g, x + 0.2, base + 0.89, z - 0.1); mug(g, x - 0.25, base + 0.89, z + 0.2); }
  // scène
  boxAt(g, '#8a5c34', 5.2, base + 0.18, -2.6, 3.0, 0.36, 4.4, 0, 0.2, 0.08); boxAt(g, '#5a3a22', 5.2, base + 0.38, -0.4, 3.0, 0.06, 0.08);
  stool(g, 5.0, base + 0.36, -2.2);
  // lanternes suspendues + lustre
  for (const [x, z] of [[-3, 0.5], [1.5, 1.5], [5.2, -2.6], [-1.8, -2.3]]) { limb(g, new V3(x, base + H + 1.2, z), new V3(x, base + 2.75, z), 0.01, 0.01, '#2e2a26', 3, 0); lampGlass(g, x, base + 2.55, z, 1.2); }
  // drapeaux et filets décoratifs, gouvernail au mur
  g.add(new THREE.TorusGeometry(0.7, 0.06, 6, 16), '#6a4426', M(-3, base + 2.4, -4.86), 0.2); for (let i = 0; i < 8; i++) { const a = i * 0.785; limb(g, new V3(-3, base + 2.4, -4.86), new V3(-3 + Math.cos(a) * 0.95, base + 2.4 + Math.sin(a) * 0.95, -4.86), 0.035, 0.03, '#6a4426', 5, 0); }
  const tav = new THREE.Mesh(g.build(), propM); tav.castShadow = true; tav.receiveShadow = true; tav.position.set(tc.x, 0, tc.z); tav.rotation.y = ang; scene.add(tav); TAV.mesh = tav;
  // enseigne peinte
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.95), new THREE.MeshLambertMaterial({ map: signTex('Le Kraken Assoiffé', '#d8b47a', '#3a1e10'), side: THREE.DoubleSide }));
  { const p = F.w(0, D / 2 + 0.2); sign.position.set(p.x, base + 3.35, p.z); sign.rotation.y = ang; scene.add(sign); }
  // collisions taverne (porte au centre de la façade)
  F.wall(-W / 2, D / 2, -1.05, D / 2); F.wall(1.05, D / 2, W / 2, D / 2); F.wall(-W / 2, -D / 2, W / 2, -D / 2); F.wall(-W / 2, -D / 2, -W / 2, D / 2); F.wall(W / 2, -D / 2, W / 2, D / 2);
  F.wall(-5.0, -2.4, 1.4, -2.4, 0.4);
  for (const [x, z] of TAV.tables) { const p = F.w(x, z); addCol(p.x, p.z, 0.75); }
  { const p = F.w(-6, -3.9); addCol(p.x, p.z, 0.9); }
  F.floor(0, 0, W / 2 - 0.05, D / 2 - 0.05, base + 0.07); F.floor(0, D / 2 + 0.7, 1.4, 0.7, base - 0.1); F.floor(5.2, -2.6, 1.5, 2.2, base + 0.4);
  tavLight = new THREE.PointLight(0xffa850, 0, 13, 1.4); { const p = F.w(-0.5, 0.5); tavLight.position.set(p.x, base + 2.6, p.z); } scene.add(tavLight);
  // banjo sur son support
  banjoProp = buildBanjoMesh(); { const p = F.w(5.9, -3.4); banjoProp.position.set(p.x, base + 0.95, p.z); banjoProp.rotation.set(0, ang + 2.6, 0.35); banjoProp.scale.setScalar(1); scene.add(banjoProp); TAV.banjoP = new V3(p.x, base + 1.0, p.z); }
  { const sg = new GB(); limb(sg, new V3(0, 0, 0), new V3(0, 0.7, 0), 0.025, 0.02, '#3a2618', 5, 0); for (let i = 0; i < 3; i++) { const a = i * 2.094; limb(sg, new V3(0, 0.05, 0), new V3(Math.cos(a) * 0.25, -0.0, Math.sin(a) * 0.25), 0.02, 0.02, '#3a2618', 4, 0); } const st = new THREE.Mesh(sg.build(), propM); const p = F.w(5.9, -3.4); st.position.set(p.x, base + 0.36, p.z); scene.add(st); }

  /* ponton : on avance vers la mer jusqu'à l'eau profonde */
  const pv = 9; let u0 = 14, uEnd = u0; for (let u = u0; u < 120; u += 1) { const p = vp(u, pv); if (heightAt(p.x, p.z) < -2.4) { uEnd = u + 6; break; } uEnd = u; }
  let us = u0; for (let u = 0; u < 60; u++) { const p = vp(u, pv); if (heightAt(p.x, p.z) < 2.2) { us = u - 2; break; } }
  const deckH = 2.1, pl = uEnd - us, pg = new GB(), pc = vp((us + uEnd) / 2, pv);
  for (let i = 0; i < pl / 0.32; i++) boxAt(pg, i % 3 ? '#a07848' : '#8f6a3e', 0, deckH, -pl / 2 + i * 0.32 + 0.16, 2.4, 0.08, 0.29, (r() - 0.5) * 0.02, 0.1, 0.08);
  for (let k = 0; k <= pl / 3; k++) for (const x of [-1.15, 1.15]) { const z = -pl / 2 + k * 3, p = vp(us + k * 3, pv + (x > 0 ? -1.15 : 1.15)); limb(pg, new V3(x, Math.min(heightAt(p.x, p.z), 0) - 1.5, z), new V3(x, deckH + 0.6, z), 0.13, 0.12, '#6a4a2e', 7, 0.12); }
  for (const x of [-1.15, 1.15]) limb(pg, new V3(x, deckH + 0.55, -pl / 2), new V3(x, deckH + 0.55, pl / 2), 0.05, 0.05, '#c9b48a', 5, 0);
  const pier = new THREE.Mesh(pg.build(), propM); pier.castShadow = pier.receiveShadow = true; pier.position.set(pc.x, 0, pc.z); pier.rotation.y = ang; scene.add(pier);
  { const Fp = new Frame(pc.x, pc.z, ang, deckH); Fp.floor(0, 0, 1.2, pl / 2, deckH + 0.04); Fp.wall(-1.2, -pl / 2 + 2.5, -1.2, pl / 2, 0.05); Fp.wall(1.2, -pl / 2 + 2.5, 1.2, pl / 2, 0.05); Fp.wall(-1.2, pl / 2, 1.2, pl / 2, 0.05); TAV.pierEnd = vp(uEnd - 2, pv); }
  VIL.pier = { us, uEnd, pv, deckH };

  /* maisons et accessoires (éléments modifiables dans l'éditeur) */
  const facing = (u, v, tu, tv) => { const a = vp(u, v), b = vp(tu, tv); return Math.atan2(b.x - a.x, b.z - a.z); };
  const L = (u, v, s = 1, face = null) => { const p = vp(u, v); return { x: p.x, z: p.z, s, ry: face === null ? r() * 6.28 : face, sy: 1 }; };
  const homes = [[-3, -17, '#4f9aa0', '#c9a55a', '#2f5a5e'], [8, -21, '#d9a441', '#a8432f', '#7a4a20'], [-4, 18, '#c0503a', '#c9a55a', '#6a2a1e'], [7, 22, '#e8dcc0', '#3f6a8a', '#5a4a3a'], [-22, -17, '#7a9a5a', '#a8432f', '#3e5a2a'], [-24, 17, '#d9a441', '#3f6a8a', '#7a4a20']];
  homes.forEach((hh, i) => scatter({ name: 'Maison ' + (i + 1), key: 'house' + i, geo: gHouse(mulberry(50 + i), hh[2], hh[3], hh[4]), mat: propM, list: [L(hh[0], hh[1], 1, facing(hh[0], hh[1], 2, 0))], col: 2.6, shadow: 1, recv: 1, tint: 0.02 }));
  scatter({ name: 'Tonneau', key: 'barrel', geo: gBarrelP(r), mat: propM, list: [L(-6, 4.5), L(-6.6, 5.4), L(-5.5, 5.6), L(9, -14), L(13, 8.3), L(-9, -11)], col: 0.42, shadow: 1, tint: 0.08 });
  scatter({ name: 'Caisses', key: 'crates', geo: gCrates(r), mat: propM, list: [L(-7.5, 6.8), L(12, 10), L(10, -12.5)], col: 0.7, shadow: 1, tint: 0.08 });
  scatter({ name: 'Réverbère', key: 'lamp', geo: gLampPost(r), mat: propM, list: [L(-6, -3), L(-6, 3.2), L(6, -9), L(6, 9.5), L(12.5, 7.6), L(-14, -10), L(-14, 11)], col: 0.15, shadow: 1, tint: 0.02 });
  scatter({ name: 'Filets', key: 'nets', geo: gNets(r), mat: mat({ ds: true, grain: 2, ga: 0.2, branch: 0.12, freq: 1.6 }), list: [L(11, -7, 1, facing(11, -7, 2, 0) + 1.57)], col: 0.3, shadow: 1, tint: 0.02 });
  scatter({ name: 'Puits', key: 'well', geo: gWell(r), mat: propM, list: [L(2, 0, 1, 0.3)], col: 1.25, shadow: 1, tint: 0.02 });
  scatter({ name: 'Drapeau pirate', key: 'flag', geo: gFlag(r), mat: mat({ ds: true, grain: 2, ga: 0.15, branch: 0.55, freq: 3.2 }), list: [L(-6, 9, 1, 0)], col: 0.2, shadow: 1, tint: 0 });
  scatter({ name: 'Barque', key: 'rowboat', geo: gRowboat(r), mat: propM, list: [L(14.5, 12.5, 1, 0.9)], col: 0.9, shadow: 1, tint: 0.03 });
  scatter({ name: 'Tas de bois', key: 'wood', geo: gWoodPile(r), mat: propM, list: [L(-20, -10, 1, 0.4)], col: 0.6, shadow: 1, tint: 0.05 });
  scatter({ name: 'Canon', key: 'cannon', geo: gCannon(r), mat: propM, list: [L(13, -3, 1, facing(13, -3, 40, -3)), L(13, 3, 1, facing(13, 3, 40, 3))], col: 0.7, shadow: 1, tint: 0.02 });
  // quelques palmiers autour du village
  const pe = VEG.find(e => e.name === 'Palmier'); if (pe) { [[16, -9], [17, 16], [-10, -24], [-12, 25], [20, 3], [-28, 0]].forEach(([u, v]) => { const p = vp(u, v); pe.items.push({ x: p.x, z: p.z, s: 0.9 + r() * 0.5, ry: seaYaw(p.x, p.z, r() * 6.28), sy: 0.9 + r() * 0.5, c: [1, 1, 1] }); addCol(p.x, p.z, 0.35); }); buildE(pe); }
  plazaLight = new THREE.PointLight(0xffb060, 0, 22, 1.5); { const p = vp(0, 0); plazaLight.position.set(p.x, heightAt(p.x, p.z) + 4, p.z); } scene.add(plazaLight);

  /* PNJ */
  const T = (x, z) => { const p = F.w(x, z); return { x: p.x, z: p.z, y: base + 0.07 }; };
  const add = (id, name, o, at, beh, ry, extra) => { const n = makeNPC(o); n.id = id; n.name = name; n.beh = beh; n.home = at; n.ry = ry; Object.assign(n, extra || {}); n.g.position.set(at.x, at.y === undefined ? groundAt(at.x, at.z) : at.y, at.z); n.g.rotation.y = ry; VIL.npcs.push(n); return n; };
  const face = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
  const pl0 = vp(3.2, 1.5);
  add('barbe', 'Barbe-Grise', { shirt: '#e8e0cc', vest: '#3a5a7a', pants: '#4a4038', hat: 'tricorne', beard: '#d8d4cc', hair: '#c8c4bc', belly: 1.25, peg: 1, nose: '#d88a6a' }, pl0, 'idle', face(pl0, vp(12, 0)));
  const bar = T(-2, -3.6); add('melusine', 'Mélusine', { skin: '#c98a5e', shirt: '#f0e6d0', vest: '#7a2a3a', pants: '#5a3a3a', hair: '#3a2014', bun: 1, apron: '#e8e0d0', h: 0.95, earring: 1 }, bar, 'bar', ang);
  josephinNPC = add('josephin', 'Joséphin', { skin: '#8a5a3a', shirt: '#d9c48a', vest: '#2f5a3a', pants: '#3a3a4a', hat: 'straw', mous: '#2a1a10', hair: '#2a1a10', h: 1.05, sleeves: 1 }, T(3.6, -3.0), 'sit', ang + 1.2);
  add('borgne', 'Le Borgne', { shirt: '#c8b89a', pants: '#3a3028', hat: 'bandana', hatc: '#2f4a7a', patch: 1, beard: '#5a3a24', belly: 1.3, hook: 1 }, T(-3.2 + 1.05 * Math.cos(-3.2), 1.4 + 1.05 * Math.sin(-3.2)), 'sit', 0, { drink: 1 });
  add('marguerite', 'Marguerite', { skin: '#f0c0a0', shirt: '#4a7a9a', pants: '#3a3a4a', hair: '#a84a24', hat: 'cap', hatc: '#3a2a20', h: 0.92 }, T(0.6 + 1.05 * Math.cos(0.6), 2.4 + 1.05 * Math.sin(0.6)), 'sit', 0, { drink: 1 });
  const rp = vp(10.5, -6.2); add('rosalie', 'Rosalie', { skin: '#a8704a', shirt: '#e8d8b8', sash: '#c0392b', pants: '#6a4a3a', hair: '#1a1210', bun: 1, h: 0.95 }, rp, 'work', face(rp, vp(11, -7)));
  const gp = TAV.pierEnd; add('gaspard', 'Gaspard', { shirt: '#e0d8c0', vest: '#5a4a3a', pants: '#3a4a5a', hat: 'straw', beard: '#7a6a5a', hair: '#7a6a5a' }, { x: gp.x, z: gp.z, y: deckH + 0.04 }, 'fish', ang, { sitPier: 1 });
  add('tobias', 'Tobias', { shirt: '#7a3a2a', pants: '#2f3a4a', hat: 'tricorne', hatc: '#3a2a1a', mous: '#4a2a1a', hair: '#4a2a1a', h: 1.08 }, vp(6, -6), 'walk', 0, { path: [[6, -6], [8, 6], [-2, 11], [-9, 4], [-9, -5], [0, -10]].map(([u, v]) => vp(u, v)), wi: 0 });
  const hp = vp(-6.2, 4.4); add('hector', 'Hector', { shirt: '#b8a888', pants: '#4a3a2a', hat: 'bandana', hatc: '#8a2a2a', beard: '#3a2a1a', belly: 1.4 }, hp, 'sleep', face(hp, vp(0, 4)));
  // perroquet
  const pp = vp(12.5, 7.6); VIL.parrot = buildParrot(); VIL.parrot.position.set(pp.x + 0.5 * VD.px, heightAt(pp.x, pp.z) + 3.05, pp.z + 0.5 * VD.pz); scene.add(VIL.parrot);
  VIL.npcs.push({ id: 'coco', name: 'Capitaine Coco', g: VIL.parrot, beh: 'parrot', bird: 1 });
  // accessoires : canne à pêche, chope, aiguille
  for (const n of VIL.npcs) {
    if (n.beh === 'fish') propMesh(g2 => { limb(g2, new V3(0, 0, 0), new V3(0, 2.4, 1.8), 0.02, 0.008, '#8a6a3a', 4, 0); limb(g2, new V3(0, 2.4, 1.8), new V3(0, -1.2, 2.4), 0.002, 0.002, '#eeeeee', 3, 0); }, n.armR, 0.02, -0.55, 0.05);
    if (n.drink) n.mug = propMesh(g2 => { mug(g2, 0, 0, 0); }, n.armR, 0.02, -0.62, 0.08);
  }
  // pas de plantes dans les maisons, la taverne, le ponton ni sur la place
  const hz = []; homes.forEach(hh => hz.push([vp(hh[0], hh[1]), 4.2])); hz.push([vp(0, 0), 9]);
  const inTav = (x, z) => { const dx = x - F.cx, dz = z - F.cz, a2 = dx * F.c - dz * F.s, b2 = dx * F.s + dz * F.c; return Math.abs(a2) < W / 2 + 1.2 && Math.abs(b2) < D / 2 + 2.2; };
  for (const e of VEG) { if (e.mat === propM) continue; let ch = false; for (const it of e.items) { if (it.dead) continue; if (inTav(it.x, it.z) || floorAt(it.x, it.z) > -Infinity || hz.some(([p, rr]) => Math.hypot(it.x - p.x, it.z - p.z) < rr)) { it.dead = true; ch = true; if (e.col) removeCol(it.x, it.z); } } if (ch) buildE(e); }
  VIL.built = true;
}
function buildParrot() {
  const g = new THREE.Group(), b = part(gg => { gg.add(SPH, '#d63a2a', M(0, 0.15, 0, 0.11, 0.17, 0.11, -0.3, 0, 0), 0.3); gg.add(SPH, '#d63a2a', M(0, 0.33, 0.04, 0.08), 0.3); gg.add(SPHL, '#ffffff', M(0, 0.33, 0.1, 0.05, 0.05, 0.03), 0); gg.add(new THREE.ConeGeometry(0.03, 0.08, 6), '#f0d060', M(0, 0.3, 0.13, 1, 1, 1, 1.9, 0, 0), 0.2); for (const sx of [-1, 1]) { gg.add(SPHL, '#1a1a1a', M(sx * 0.045, 0.35, 0.08, 0.015), 0); gg.add(SPH, sx > 0 ? '#2a7ad0' : '#2a7ad0', M(sx * 0.1, 0.13, -0.02, 0.04, 0.13, 0.08, -0.3, 0, 0), 0.3); } gg.add(new THREE.BoxGeometry(0.08, 0.28, 0.03), '#2aa04a', M(0, -0.08, -0.08, 1, 1, 1, 0.4, 0, 0), 0.2); });
  g.add(b); g.userData.body = b; return g;
}

/* ---------- comportements ---------- */
const _tv = new V3();
function updateVillage(dt) {
  if (!VIL.built) return;
  const night = SKY.night, cp = camera.position;
  U.night.value = night;
  tavLight.intensity = 0.6 + 1.6 * night; plazaLight.intensity = 1.4 * night;
  // à l'intérieur de la taverne ?
  const F = TAV.F, dx = P.pos.x - F.cx, dz = P.pos.z - F.cz, a = dx * F.c - dz * F.s, b = dx * F.s + dz * F.c;
  VIL.inside += ((Math.abs(a) < TAV.W / 2 && Math.abs(b) < TAV.D / 2 ? 1 : 0) - VIL.inside) * Math.min(1, dt * 3);
  const near = Math.hypot(cp.x - VILLAGE.x, cp.z - VILLAGE.z) < 120;
  for (const n of VIL.npcs) {
    n.g.visible = n.g.position.distanceToSquared(cp) < 140 * 140 && !n.hidden; if (!n.g.visible || (n.beh && n.beh.startsWith('intro'))) continue;
    if (n.bird) { const u = n.g.userData; n.g.rotation.y = Math.sin(G.t * 0.7) * 0.8 + (VIL.talk && VIL.talk.n === n ? Math.atan2(P.pos.x - n.g.position.x, P.pos.z - n.g.position.z) - n.g.rotation.y * 0 : 0); u.body.rotation.x = Math.sin(G.t * 3) * 0.05 + (Math.sin(G.t * 0.9) > 0.95 ? 0.3 : 0); continue; }
    n.ph += dt; const t = n.ph, talking = VIL.talk && VIL.talk.n === n;
    let walk = 0, legA = 0, armA = 0, sit = 0;
    if (n.beh === 'walk' && !talking) {
      const tg = n.path[n.wi], dx2 = tg.x - n.g.position.x, dz2 = tg.z - n.g.position.z, dd = Math.hypot(dx2, dz2);
      if (dd < 0.4) n.wi = (n.wi + 1) % n.path.length; else { const sp = 1.3; n.g.position.x += dx2 / dd * sp * dt; n.g.position.z += dz2 / dd * sp * dt; n.ry = Math.atan2(dx2, dz2); walk = 1; }
      n.g.position.y = groundAt(n.g.position.x, n.g.position.z);
    }
    if (n.beh === 'sit' || n.beh === 'fish') sit = 1;
    // rotation : vers le joueur s'il parle, sinon vers sa direction
    let tr = n.ry; if (talking) tr = Math.atan2(P.pos.x - n.g.position.x, P.pos.z - n.g.position.z);
    if (!(sit && talking)) n.g.rotation.y += angDiff(tr, n.g.rotation.y) * Math.min(1, dt * 5);
    // regard : la tête suit le joueur proche
    const pd = Math.hypot(P.pos.x - n.g.position.x, P.pos.z - n.g.position.z);
    let hy = 0, hx = 0; if (pd < 6 && n.beh !== 'sleep') { hy = clamp(angDiff(Math.atan2(P.pos.x - n.g.position.x, P.pos.z - n.g.position.z), n.g.rotation.y), -1.1, 1.1); hx = -0.15; }
    n.head.rotation.y += (hy - n.head.rotation.y) * Math.min(1, dt * 4); n.head.rotation.x += (hx - n.head.rotation.x) * Math.min(1, dt * 4);
    const br = Math.sin(t * 2.1) * 0.012;
    n.torso.scale.y = 1 + br; n.torso.rotation.z = Math.sin(t * 0.7) * 0.02;
    if (walk) { const w = Math.sin(t * 7); n.legL.rotation.x = w * 0.55; n.legR.rotation.x = -w * 0.55; n.armL.rotation.x = -w * 0.45; n.armR.rotation.x = w * 0.45; n.hips.position.y = 0.9 * n.hs + Math.abs(Math.cos(t * 7)) * 0.04; }
    else if (sit) { n.legL.rotation.x = n.legR.rotation.x = -1.45; n.hips.position.y = 0.55; n.armL.rotation.x = -0.4; n.armR.rotation.x = n.beh === 'fish' ? -1.1 : -0.4; if (n.beh === 'fish') { n.legL.rotation.x = n.legR.rotation.x = -1.2; n.hips.position.y = 0.05; n.armR.rotation.x = -0.9 + Math.sin(t * 0.6) * 0.05; } }
    else { n.legL.rotation.x = n.legR.rotation.x = 0; n.hips.position.y = 0.9 * n.hs; n.armL.rotation.x = Math.sin(t * 1.1) * 0.04; n.armR.rotation.x = -Math.sin(t * 1.1) * 0.04; }
    if (n.beh === 'bar') { n.armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.25; n.armR.rotation.z = Math.sin(t * 3) * 0.2; } // essuie un verre
    if (n.beh === 'work') { n.armL.rotation.x = -0.75 + Math.sin(t * 2.4) * 0.15; n.armR.rotation.x = -0.85 + Math.sin(t * 2.4 + 1.5) * 0.2; n.armL.rotation.z = 0.25; n.armR.rotation.z = -0.25; n.head.rotation.x = 0.2; }
    if (n.drink) { const c = (t % 9) / 9, lift = c > 0.75 ? Math.sin((c - 0.75) / 0.25 * Math.PI) : 0; n.armR.rotation.x = -0.6 - lift * 1.6; if (lift > 0.5) n.head.rotation.x = -0.3; }
    if (n.beh === 'sleep') { n.legL.rotation.x = n.legR.rotation.x = -1.45; n.hips.position.y = 0.5; n.torso.rotation.x = -0.35; n.head.rotation.x = 0.55; n.head.rotation.z = 0.25; n.armL.rotation.x = n.armR.rotation.x = 0.2; n.torso.scale.y = 1 + Math.sin(t * 1.1) * 0.03; }
    if (talking) { n.head.rotation.x += Math.sin(t * 8) * 0.03; n.armR.rotation.x += Math.sin(t * 2.3) * 0.25 - (sit ? 0 : 0.35); n.armR.rotation.z = -0.2; }
    else if (n.beh !== 'bar') n.armR.rotation.z *= 0.9;
    // pendant le banjo : la salle tape dans les mains
    if (BJ.on && VIL.inside > 0.5 && (n.drink || n.beh === 'bar' || n.id === 'josephin')) { const beat = BJ.beat || 0, c = Math.abs(Math.sin(beat * Math.PI)); n.armL.rotation.x = -1.1; n.armR.rotation.x = -1.1; n.armL.rotation.z = 0.5 * c; n.armR.rotation.z = -0.5 * c; n.head.rotation.x = Math.sin(beat * Math.PI * 2) * 0.12; }
    if (BJ.cheer > 0 && VIL.inside > 0.5 && n.g.position.distanceTo(P.pos) < 14) { n.armL.rotation.x = n.armR.rotation.x = -2.8 + Math.sin(G.t * 10) * 0.2; }
  }
  // le dialogue se ferme si on s'éloigne
  if (VIL.talk && Math.hypot(P.pos.x - VIL.talk.n.g.position.x, P.pos.z - VIL.talk.n.g.position.z) > 4.5) closeTalk();
  if (BJ.cheer > 0) BJ.cheer -= dt;
}
function villageTarget() {
  if (!VIL.built || TF.on) return null; const cp = camera.position; let best = null, bs = 0.82;
  for (const n of VIL.npcs) { if (!n.g.visible) continue; const p = n.g.position, dx = p.x - cp.x, dz = p.z - cp.z, dy = p.y + (n.bird ? 0.2 : 1.3) - cp.y, d = Math.hypot(dx, dy, dz); if (d > (n.bird ? 3.4 : 3.2)) continue; const dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / d; if (dot > bs) { bs = dot; best = { npc: n }; } }
  if (TAV.banjoP) { const p = TAV.banjoP, dx = p.x - cp.x, dy = p.y - cp.y, dz = p.z - cp.z, d = Math.hypot(dx, dy, dz); if (d < 3.4 && (dx * camDir.x + dy * camDir.y + dz * camDir.z) / d > Math.max(bs, 0.75)) best = { banjo: 1 }; }
  return best;
}

/* ============ mini-jeu : le banjo façon Guitar Hero ============ */
const BJ = { on: false, cheer: 0, beat: 0 };
function buildBanjoMesh() {
  const g = new GB();
  g.add(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 28, 1, true), '#8a5a2e', M(0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.2, 0.05);
  g.add(new THREE.CircleGeometry(0.19, 28), '#efe6cc', M(0, 0, 0.036), 0);
  g.add(new THREE.TorusGeometry(0.2, 0.012, 6, 28), '#c9c4b8', M(0, 0, 0.036), 0.2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; g.add(new THREE.BoxGeometry(0.012, 0.012, 0.06), '#d8d4c8', M(Math.cos(a) * 0.205, Math.sin(a) * 0.205, 0.01, 1, 1, 1, 0, 0, a), 0); }
  g.add(new THREE.CircleGeometry(0.2, 28), '#6a4426', M(0, 0, -0.036, 1, 1, 1, Math.PI, 0, 0), 0);
  g.add(new THREE.BoxGeometry(0.05, 0.62, 0.025), '#5a3a22', M(0, 0.5, 0.03), 0.2);
  g.add(new THREE.BoxGeometry(0.07, 0.15, 0.025), '#5a3a22', M(0, 0.87, 0.025, 1, 1, 1, -0.15, 0, 0), 0.2);
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) g.add(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), '#e8e0c8', M(sx * 0.05, 0.82 + i * 0.03 * (sx > 0 ? 1 : 1), 0.025, 1, 1, 1, 0, 0, Math.PI / 2), 0);
  for (let i = 0; i < 5; i++) g.add(new THREE.BoxGeometry(0.0025, 0.95, 0.003), '#e8e8e8', M(-0.016 + i * 0.008, 0.36, 0.05), 0);
  g.add(new THREE.BoxGeometry(0.06, 0.012, 0.016), '#e8dcc0', M(0, -0.06, 0.044), 0);
  for (let i = 0; i < 12; i++) g.add(new THREE.BoxGeometry(0.05, 0.003, 0.004), '#c9c4b8', M(0, 0.24 + i * 0.045, 0.044), 0);
  const m = new THREE.Mesh(g.build(), mat({ ds: true, grain: 2, ga: 0.15 })); m.castShadow = true; return m;
}
// « What Shall We Do with the Drunken Sailor » (chant traditionnel), en ré dorien
const SONG = (() => {
  const A = 69, G = 67, F = 65, E = 64, D = 62, B = 71, C = 72, D2 = 74;
  const verse = [[[A, 2], [A, 1], [A, 1], [A, 2], [A, 1], [A, 1], [A, 2], [D, 2], [F, 2], [A, 2]], [[G, 2], [G, 1], [G, 1], [G, 2], [G, 1], [G, 1], [G, 2], [C - 12, 2], [E, 2], [G, 2]], [[A, 2], [A, 1], [A, 1], [A, 2], [A, 1], [A, 1], [A, 2], [B, 2], [C, 2], [D2, 2]], [[C, 2], [A, 2], [G, 2], [E, 2], [D, 4], [0, 4]]];
  const chorus = [[[A, 3], [A, 3], [A, 1], [A, 1], [A, 2], [D, 2], [F, 2], [A, 2]], [[G, 3], [G, 3], [G, 1], [G, 1], [G, 2], [C - 12, 2], [E, 2], [G, 2]], [[A, 3], [A, 3], [A, 1], [A, 1], [A, 2], [B, 2], [C, 2], [D2, 2]], [[C, 2], [A, 2], [G, 2], [E, 2], [D, 4], [0, 4]]];
  const lines = [...verse, ...chorus, ...verse, ...chorus], chords = ['Dm', 'C', 'Dm', 'CD'];
  const notes = [], back = []; let t = 0, prev = -1, pl = -1;
  lines.forEach((ln, li) => {
    const t0 = t;
    for (const [m, d] of ln) { if (m) { let lane = m <= 64 ? 0 : m <= 67 ? 1 : m <= 69 ? 2 : 3; if (m === 60) lane = 0; if (m === prev && lane === pl) lane = lane === 3 ? 2 : lane + 1 > 3 ? 3 : (notes.length % 2 ? lane + 1 : lane); notes.push({ e: t, m, lane, d }); prev = m; pl = lane; } t += d; }
    const ch = chords[li % 4]; for (let q = 0; q < 8; q++) { const c = ch === 'CD' ? (q < 4 ? 'C' : 'Dm') : ch; back.push({ e: t0 + q * 2, c, q }); }
  });
  return { notes, back, len: t };
})();
const BPM = 118, EIGHTH = 60 / BPM / 2, LEAD = 3.0, LOOK = 1.7, LANEC = ['#5ad25a', '#e8453a', '#f5d04a', '#3a8ae8'], LANEK = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
const KS = {};
function ksBuf(midi) {
  if (KS[midi]) return KS[midi]; const c = AU.ctx; if (!c) return null;
  const sr = c.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), N = Math.max(2, Math.round(sr / f)), len = Math.round(sr * 1.6), buf = c.createBuffer(1, len, sr), out = buf.getChannelData(0), ring = new Float32Array(N);
  let last = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; ring[i] = w * 0.7 + last * 0.3; last = ring[i]; }
  let k = 0; const damp = midi > 66 ? 0.9935 : 0.996;
  for (let i = 0; i < len; i++) { const a = ring[k], b = ring[(k + 1) % N]; out[i] = a; ring[k] = (a + b) * 0.5 * damp; k = (k + 1) % N; }
  for (let i = 0; i < Math.min(len, 260); i++) out[i] += (Math.random() * 2 - 1) * 0.5 * (1 - i / 260); // attaque du médiator
  KS[midi] = buf; return buf;
}
function pluck(midi, when, vol, dest) { const c = AU.ctx; if (!c) return; const b = ksBuf(midi); if (!b) return; const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = vol; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; s.connect(hp); hp.connect(g); g.connect(dest || AU.master); s.start(when); }
const CH = { Dm: [62, 65, 69], C: [60, 64, 67] }, BASS = { Dm: [50, 57], C: [48, 55] };
function startBanjo() {
  if (BJ.on) return; closeTalk(); BJ.on = true; BJ.end = false; BJ.score = 0; BJ.combo = 0; BJ.best = 0; BJ.hits = 0; BJ.fb = null; BJ.press = [0, 0, 0, 0];
  BJ.notes = SONG.notes.map(n => ({ t: LEAD + n.e * EIGHTH, lane: n.lane, m: n.m, hit: 0, miss: 0 }));
  const c = AU.ctx; BJ.t0 = c ? c.currentTime : performance.now() / 1000; BJ.wall = performance.now() / 1000;
  if (c) {
    BJ.bus = c.createGain(); BJ.bus.gain.value = 0.9; BJ.bus.connect(AU.master);
    for (let i = 0; i < 4; i++) tone([1600], 0.05, 'square', 0.04, LEAD - 4 * EIGHTH * 2 + i * EIGHTH * 2);
    for (const b of SONG.back) { const t = BJ.t0 + LEAD + b.e * EIGHTH; pluck(BASS[b.c][b.q % 2], t, 0.5, BJ.bus); CH[b.c].forEach((m, i) => pluck(m - 12 + (i ? 12 : 0), t + EIGHTH + i * 0.012, 0.13, BJ.bus)); }
    for (const m of [62, 65, 69, 74, 72, 71, 67, 64, 60, 57]) ksBuf(m);
    AU.music = 0.15;
  }
  // le joueur s'assoit sur le tabouret de la scène
  const F = TAV.F, p = F.w(5.0, -2.2); BJ.ret = { x: P.pos.x, z: P.pos.z, yaw: P.yaw };
  P.pos.set(p.x, TAV.base + 0.36, p.z); P.vel.set(0, 0, 0);
  const q = F.w(-1, 3); P.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z)); P.pitch = -0.12;
  camera.position.set(P.pos.x, P.pos.y + 1.15, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0);
  banjoProp.visible = false; BJ.held.visible = true; armR.visible = armL.visible = false;
  $('bj').style.display = 'block'; resizeBJ(); if (TOUCH) $('bjTouch').style.display = 'flex';
}
function stopBanjo() {
  if (!BJ.on) return; BJ.on = false; if (BJ.bus) { try { BJ.bus.disconnect(); } catch (_) { } BJ.bus = null; }
  banjoProp.visible = true; BJ.held.visible = false; $('bj').style.display = 'none'; $('bjTouch').style.display = 'none';
  const F = TAV.F, p = F.w(3.6, -0.6); P.pos.set(p.x, TAV.base + 0.07, p.z); P.vy = 0;
  if (BJ.hits > 8) { josephinNPC.next = 'after'; BJ.cheer = 4; sfx('cheer'); }
}
function songTime() { const c = AU.ctx; return c ? c.currentTime - BJ.t0 : performance.now() / 1000 - BJ.wall; }
function bjPress(l) {
  if (!BJ.on || BJ.end) { if (BJ.end) stopBanjo(); return; }
  BJ.press[l] = 0.15; const st = songTime(); let best = null, bd = 0.14;
  for (const n of BJ.notes) { if (n.hit || n.miss || n.lane !== l) continue; const d = Math.abs(n.t - st); if (d < bd) { bd = d; best = n; } if (n.t - st > 0.3) break; }
  if (best) {
    best.hit = 1; BJ.hits++; BJ.combo++; BJ.best = Math.max(BJ.best, BJ.combo); const mult = Math.min(4, 1 + (BJ.combo / 8 | 0)), perf = bd < 0.055;
    BJ.score += (perf ? 100 : 60) * mult; BJ.fb = { t: perf ? 'Parfait' : 'Bien', c: perf ? '#ffe27a' : '#ffffff', a: 0.6, l }; pluck(best.m, AU.ctx ? AU.ctx.currentTime : 0, 0.8, BJ.bus); BJ.strum = 1;
  } else { BJ.combo = 0; noiseHit('bandpass', 300, 2, 0.08, 0.12); BJ.fb = { t: 'Raté', c: '#ff8a7a', a: 0.6, l }; }
}
function updateBanjo(dt) {
  const st = songTime(); BJ.beat = Math.max(0, (st - LEAD) / (EIGHTH * 2));
  for (const n of BJ.notes) if (!n.hit && !n.miss && st - n.t > 0.16) { n.miss = 1; BJ.combo = 0; }
  if (!BJ.end && st > LEAD + SONG.len * EIGHTH + 1.2) { BJ.end = true; BJ.cheer = 5; sfx('cheer'); }
  // regard libre limité, bras qui grattent
  const s = 0.0018; P.yaw -= look.x * s; P.pitch = clamp(P.pitch - look.y * s, -0.6, 0.5); look.x = look.y = 0;
  camera.position.set(P.pos.x, P.pos.y + 1.15 + Math.sin(BJ.beat * Math.PI * 2) * 0.006, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0); camera.getWorldDirection(camDir); WU.uCam.value.copy(camera.position);
  BJ.strum = Math.max(0, (BJ.strum || 0) - dt * 7);
  BJ.held.position.set(0.02, -0.34 + Math.sin(BJ.beat * Math.PI * 2) * 0.004, -0.42); BJ.handR.rotation.x = -0.2 + BJ.strum * 0.35; BJ.handR.position.y = 0.0 + BJ.strum * 0.02;
  armR.visible = armL.visible = false;
  drawBJ(st, dt);
}
function resizeBJ() { const cv = $('bj'), w = appEl.clientWidth, h = appEl.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } }
function drawBJ(st, dt) {
  resizeBJ(); const cv = $('bj'), x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
  const cx = W / 2, yTop = H * 0.18, yHit = H * 0.84, wTop = Math.min(W, H) * 0.16, wHit = Math.min(W * 0.62, H * 0.95);
  const P2 = (lane, p) => { const w = lerp(wTop, wHit, p), y = lerp(yTop, yHit, p); return [cx + (lane - 1.5) / 4 * w, y, lerp(0.35, 1, p)]; };
  const pr = d => { const p = clamp(1 - d / LOOK, 0, 1.15); return Math.pow(p, 1.6); };
  // manche en bois
  const gr = x.createLinearGradient(0, yTop, 0, yHit); gr.addColorStop(0, 'rgba(40,24,12,0)'); gr.addColorStop(0.25, 'rgba(60,36,18,0.55)'); gr.addColorStop(1, 'rgba(70,42,20,0.82)');
  x.fillStyle = gr; x.beginPath(); x.moveTo(cx - wTop / 2, yTop); x.lineTo(cx + wTop / 2, yTop); x.lineTo(cx + wHit / 2 + 20, yHit + 40); x.lineTo(cx - wHit / 2 - 20, yHit + 40); x.closePath(); x.fill();
  // frettes qui défilent au rythme
  x.strokeStyle = 'rgba(230,220,200,0.25)'; x.lineWidth = 2;
  for (let k = 0; k < 10; k++) { const bt = Math.ceil(BJ.beat) + k, tt = LEAD + bt * EIGHTH * 2 - st, p = pr(tt); if (p <= 0 || p > 1.1) continue; const a = P2(-0.5, p), b = P2(3.5, p); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  // cordes
  for (let l = 0; l < 4; l++) { const a = P2(l, 0), b = P2(l, 1.05); x.strokeStyle = BJ.press[l] > 0 ? LANEC[l] : 'rgba(235,230,215,0.7)'; x.lineWidth = BJ.press[l] > 0 ? 4 : 2; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); BJ.press[l] = Math.max(0, BJ.press[l] - dt); }
  // cibles
  for (let l = 0; l < 4; l++) { const [hx, hy] = P2(l, 1), R = wHit / 11; x.lineWidth = 5; x.strokeStyle = LANEC[l]; x.fillStyle = BJ.press[l] > 0 ? LANEC[l] + 'aa' : 'rgba(20,14,8,0.5)'; x.beginPath(); x.arc(hx, hy, R, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.font = 'bold ' + (R * 0.7 | 0) + 'px Fredoka,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(TOUCH ? '' : 'DFJK'[l], hx, hy + 1); }
  // notes : peau de banjo cerclée de couleur
  for (let i = BJ.notes.length - 1; i >= 0; i--) { const n = BJ.notes[i]; if (n.hit) continue; const d = n.t - st; if (d > LOOK || d < -0.25) continue; const p = pr(d), [nx, ny, sc] = P2(n.lane, p), R = wHit / 12 * sc; x.globalAlpha = n.miss ? 0.3 : 1; x.fillStyle = '#f4ecd6'; x.strokeStyle = LANEC[n.lane]; x.lineWidth = R * 0.32; x.beginPath(); x.arc(nx, ny, R, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.arc(nx, ny + R * 0.15, R * 0.55, 0, 7); x.fill(); x.globalAlpha = 1; }
  // score, série, multiplicateur
  const mult = Math.min(4, 1 + (BJ.combo / 8 | 0));
  x.textAlign = 'right'; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.font = '600 ' + (H * 0.045 | 0) + 'px Fredoka,sans-serif'; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 6;
  x.fillText(BJ.score, W - 24, 70); x.font = (H * 0.03 | 0) + 'px Fredoka,sans-serif'; x.fillText('série ' + BJ.combo + '   ×' + mult, W - 24, 70 + H * 0.055);
  if (BJ.fb && BJ.fb.a > 0) { const [fx, fy] = P2(BJ.fb.l, 1); x.globalAlpha = Math.min(1, BJ.fb.a * 2); x.textAlign = 'center'; x.fillStyle = BJ.fb.c; x.font = '600 ' + (H * 0.035 | 0) + 'px Fredoka,sans-serif'; x.fillText(BJ.fb.t, fx, fy - wHit / 7 - (0.6 - BJ.fb.a) * 40); x.globalAlpha = 1; BJ.fb.a -= dt; }
  if (st < LEAD) { x.textAlign = 'center'; x.font = '600 ' + (H * 0.06 | 0) + 'px Fredoka,sans-serif'; x.fillStyle = '#fff'; x.fillText(Math.ceil(LEAD - st), cx, H * 0.38); }
  if (BJ.end) { x.textAlign = 'center'; x.fillStyle = 'rgba(14,43,63,0.85)'; x.fillRect(cx - 220, H * 0.3, 440, H * 0.3); x.fillStyle = '#ffe27a'; x.font = '600 ' + (H * 0.05 | 0) + 'px Fredoka,sans-serif'; const pc = BJ.hits / BJ.notes.length; x.fillText(pc > 0.9 ? 'Les pirates en redemandent !' : pc > 0.6 ? 'Belle prestation !' : 'Un peu rouillé...', cx, H * 0.34); x.fillStyle = '#fff'; x.font = (H * 0.032 | 0) + 'px Fredoka,sans-serif'; x.fillText(BJ.hits + ' / ' + BJ.notes.length + ' notes · meilleure série ' + BJ.best, cx, H * 0.43); x.fillText('Score ' + BJ.score, cx, H * 0.49); x.font = (H * 0.025 | 0) + 'px Fredoka,sans-serif'; x.globalAlpha = 0.8; x.fillText(TOUCH ? 'Touche une corde pour reposer le banjo' : 'Appuie sur une touche pour reposer le banjo', cx, H * 0.55); x.globalAlpha = 1; }
  else { x.textAlign = 'left'; x.font = (H * 0.022 | 0) + 'px Fredoka,sans-serif'; x.globalAlpha = 0.6; x.fillStyle = '#fff'; x.fillText(TOUCH ? '' : 'Échap : arrêter', 24, H - 40); x.globalAlpha = 1; }
  x.shadowBlur = 0;
}
function setupBanjo() {
  // banjo tenu en vue subjective : caisse à droite, manche vers la gauche, main droite qui gratte
  const g = new THREE.Group(), b = buildBanjoMesh(); b.rotation.set(-1.1, 0.25, 1.05); b.scale.setScalar(0.9); g.add(b);
  const am = mat({ ds: true, ga: 0 });
  const hl = new THREE.Mesh(buildFistGeo(true), am); hl.scale.set(-1, 1, 1); hl.position.set(-0.2, 0.12, -0.14); hl.rotation.set(0.3, 0.6, 1.3); g.add(hl);
  const hr = new THREE.Group(), hm = new THREE.Mesh(buildOpenGeo(true), am); hm.rotation.set(2.6, 0.4, 0.2); hr.add(hm); hr.position.set(0.12, -0.03, 0.02); g.add(hr); BJ.handR = hr;
  g.visible = false; camera.add(g); BJ.held = g;
  addEventListener('keydown', e => {
    if (!BJ.on) return; const l = LANEK.indexOf(e.code); if (e.repeat) return;
    if (l >= 0) { bjPress(l); e.preventDefault(); } else if (e.code === 'Escape' || e.code === 'Backspace') stopBanjo(); else if (BJ.end) stopBanjo();
  });
  const tb = $('bjTouch'); tb.innerHTML = ''; for (let l = 0; l < 4; l++) { const d = document.createElement('div'); d.style.background = LANEC[l] + '99'; d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); bjPress(l); }); tb.appendChild(d); }
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && BJ.on && !TOUCH) stopBanjo(); });
}
