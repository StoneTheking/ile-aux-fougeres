'use strict';
/* ============ L'Île aux Fougères — monde : terrain, eau, ciel, flore (v2) ============ */
const V3 = THREE.Vector3;
const TOUCH = matchMedia('(pointer:coarse)').matches;
let LOW = TOUCH;
const DENS = LOW ? 0.42 : 1;
const lin = hex => (hex.isColor ? hex.clone() : new THREE.Color(hex).convertSRGBToLinear());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iz) { let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x, z); n += a; x = x * 2.03 + 17.1; z = z * 2.03 + 9.7; a *= 0.5; } return s / n; }

/* ---------- rendu ---------- */
const canvas = document.getElementById('c'), appEl = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); renderer.setClearColor(0x000000, 1);
const FOG_D = 0.0022;
scene.fog = new THREE.FogExp2(0xffffff, FOG_D);
const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 3400);
camera.rotation.order = 'YXZ';
scene.add(camera);
let ROT = false, RT = null;
function resize() {
  ROT = TOUCH && innerHeight > innerWidth;
  const w = ROT ? innerHeight : innerWidth, h = ROT ? innerWidth : innerHeight;
  appEl.style.width = w + 'px'; appEl.style.height = h + 'px'; document.body.classList.toggle('rot', ROT);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2) * (window.RESK || 1));
  renderer.setSize(w, h, false);
  if (RT) RT.setSize(Math.floor(w * renderer.getPixelRatio()), Math.floor(h * renderer.getPixelRatio()));
  camera.aspect = w / h; camera.fov = w / h < 1.4 ? 76 : 68; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250)); resize();
const FOGU = { uFSun: { value: new V3(0, 1, 0) }, uFSunCol: { value: new THREE.Color() } };
const POST = { uT: { value: null }, uSat: { value: 1.22 }, uCon: { value: 0.32 }, uVig: { value: 0.16 }, uBloom: { value: 1 } };
let postScene, postCam;
function buildPost() {
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  RT = renderer.capabilities.isWebGL2 ? new THREE.WebGLMultisampleRenderTarget(s.x, s.y) : new THREE.WebGLRenderTarget(s.x, s.y);
  RT.texture.encoding = THREE.sRGBEncoding; POST.uT.value = RT.texture;
  postScene = new THREE.Scene(); postCam = new THREE.Camera();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: POST, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D uT; uniform float uSat, uCon, uVig, uBloom; varying vec2 vU;
void main(){ vec3 c = texture2D(uT, vU).rgb;
  vec3 bl = vec3(0.0); // halo : les zones très claires débordent en lumière chaude
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785 + 0.39, r = (i - (i / 2) * 2 == 0) ? 0.007 : 0.018; vec3 t = texture2D(uT, vU + vec2(cos(a), sin(a) * 1.7) * r).rgb; bl += max(t - 0.86, 0.0); }
  c += bl * 0.125 * vec3(1.0, 0.82, 0.6) * 1.6 * uBloom;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);                                   // couleurs plus vives
  c = mix(c, c * c * (3.0 - 2.0 * c), uCon);                    // contraste doux
  c *= mix(vec3(0.94, 0.97, 1.08), vec3(1.05, 1.01, 0.95), smoothstep(0.0, 0.9, l)); // ombres froides, lumières chaudes
  vec2 v = vU - 0.5; c *= 1.0 - uVig * pow(length(v) * 1.42, 3.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }` }));
  q.frustumCulled = false; postScene.add(q);
}
let _shN = 0;
function renderFrame() { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (_shN++ & 1) === 0; renderer.setRenderTarget(RT); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam); }
const PT = e => ROT ? { x: e.clientY, y: innerWidth - e.clientX } : { x: e.clientX, y: e.clientY };

const U = { under: { value: 0 }, night: { value: 0 }, time: { value: 0 }, wind: { value: new THREE.Vector2(0.5, 0) }, noise: { value: null } };
// texture de bruit répétable : donne le grain du sol, des écorces et des feuilles
(function () {
  const N = 256, d = new Uint8Array(N * N * 4);
  const tn = (x, y, p, s) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), hh = (a, b) => hash2(((a % p) + p) % p + s * 57, ((b % p) + p) % p + s * 131); return lerp(lerp(hh(ix, iy), hh(ix + 1, iy), u), lerp(hh(ix, iy + 1), hh(ix + 1, iy + 1), u), v); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < 3; c++) {
    let s = 0, a = 0.5, n = 0, p = [4, 8, 16][c];
    for (let o = 0; o < 5; o++) { s += a * tn(x / N * p, y / N * p, p, c * 7 + o); n += a; p *= 2; a *= 0.55; }
    d[(y * N + x) * 4 + c] = clamp(s / n * 1.5 - 0.25, 0, 1) * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  U.noise.value = t;
})();

const WIND_DECL = `
uniform float uTime; uniform vec2 uWind; uniform vec3 uSw; uniform float uFade; uniform vec3 uCamP;
varying vec3 vWP; varying float vFx;
#ifdef GRASS
varying float vGw;
#endif
`;
const WIND_PROJ = `
vec4 mvPosition = vec4(transformed, 1.0);
vec3 worg = vec3(0.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition; worg = instanceMatrix[3].xyz;
#endif
vec4 swp = modelMatrix * mvPosition; worg = (modelMatrix * vec4(worg, 1.0)).xyz;
WVARS
float wst = length(uWind) + 1e-4; vec2 wdr = uWind / wst;
float wg1 = sin(dot(worg.xz, wdr) * 0.045 - uTime * 0.8);
float wg2 = sin(dot(worg.xz, wdr) * 0.13 - uTime * 1.9 + worg.z * 0.04);
float wgust = 0.5 + 0.34 * wg1 + 0.16 * wg2;
float wpp = worg.x * 1.37 + worg.z * 2.11;
float wlean = wst * (0.3 + 0.7 * wgust) + 0.12 * wst * sin(uTime * uSw.z + wpp);
float wb = uSw.x * whN * whN * wlean;
vec2 wperp = vec2(-wdr.y, wdr.x);
swp.xz += wdr * wb + wperp * (wb * 0.3 * sin(uTime * uSw.z * 0.73 + wpp * 1.7));
swp.y -= wb * wb * 0.5 / max(whN, 0.3);
float wbw = wflex * uSw.y * wst * (0.45 + 0.55 * wgust);
float wbp = wbph * 6.2831 + wpp;
swp.y += sin(uTime * uSw.z * 1.9 + wbp) * wbw;
swp.xz += wdr * (sin(uTime * uSw.z * 1.3 + wbp * 1.3) * wbw * 0.6) + wperp * (sin(uTime * uSw.z * 4.1 + wbp * 2.7) * wbw * 0.16 * wgust);
if (uFade > 0.0) swp.xyz = mix(worg, swp.xyz, 1.0 - smoothstep(uFade * 0.55, uFade, distance(worg.xz, uCamP.xz)));
#ifdef GRASS
float gh = clamp(whN / 0.55, 0.0, 1.3);
float gwa = 0.5 + 0.5 * sin(dot(worg.xz, wdr) * 0.42 - uTime * 2.9 + sin(dot(worg.xz, wperp) * 0.08) * 1.5);
float gwb = 0.5 + 0.5 * sin(dot(worg.xz, wdr) * 0.12 - uTime * 1.25 + worg.x * 0.013);
float gwv = gwa * gwa * (0.35 + 0.65 * gwb);
float gbend = wst * (0.32 + 0.9 * gwv);
swp.xz += wdr * gh * gh * gbend * 0.42; swp.y -= gh * gh * gbend * gbend * 0.09;
vGw = gwv * gh * wst;
#endif
vWP = swp.xyz; vFx = wflex;
mvPosition = viewMatrix * swp;
gl_Position = projectionMatrix * mvPosition;
`;
const FOG_FRAG = `
#ifdef USE_FOG
  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);
  vec3 fdir = normalize(vWP - uCamP);
  float fsd = max(dot(fdir, uFSun), 0.0);
  vec3 fcol = mix(fogColor, uFSunCol, pow(fsd, 3.0) * 0.85) + uFSunCol * pow(fsd, 20.0) * 0.3;
  fogFactor = max(fogFactor, (1.0 - exp(-fogDepth * 0.0012)) * 0.6);
  fogFactor *= mix(1.0, 0.55, smoothstep(0.0, 110.0, vWP.y));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, fogFactor);
  { // brume basse façon Breath of the Wild : dense au ras de la mer et dans les vallées, par nappes, seulement au loin
    float fdist = length(vWP - uCamP), hd = vWP.y - uCamP.y, hb = 0.05;
    float avg = exp(-max(uCamP.y, 0.0) * hb) * (abs(hd) > 0.05 ? (1.0 - exp(-hd * hb)) / (hd * hb) : 1.0);
    float mpatch = 0.55 + 0.45 * sin(vWP.x * 0.016 + sin(vWP.z * 0.011) * 2.0) * sin(vWP.z * 0.013 + sin(vWP.x * 0.009) * 1.7 + 1.3);
    float mist = (1.0 - exp(-fdist * 0.0032 * avg * mpatch)) * smoothstep(25.0, 140.0, fdist) * 0.75;
    vec3 mcol = mix(fogColor * vec3(1.02, 1.06, 1.08), uFSunCol, pow(fsd, 2.0) * 0.6) * 1.06;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mcol, mist); }
#endif
`;
/* matériau commun : éclairage doux, grain procédural, vent (flexion principale + flexion de détail) */
function mat(o = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
  const sw = new V3(o.bend || 0, o.branch || 0, o.freq || 1.2), grain = o.grain === undefined ? 1.3 : o.grain, ga = o.ga === undefined ? 0.3 : o.ga;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uNightK = U.night; sh.uniforms.uWind = U.wind; sh.uniforms.uSw = { value: sw }; sh.uniforms.uFade = { value: o.fade || 0 }; sh.uniforms.uCamP = WU.uCam; sh.uniforms.uBark = { value: o.bark || 0 }; sh.uniforms.uFSun = FOGU.uFSun; sh.uniforms.uFSunCol = FOGU.uFSunCol; sh.uniforms.uNoise = U.noise; sh.uniforms.uGrain = { value: new THREE.Vector2(grain, ga) }; sh.uniforms.uBack = { value: o.back === undefined ? 0.72 : o.back };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + WIND_DECL + (o.fruit ? 'attribute vec4 aT;\n' : 'attribute vec2 aW;\n'))
      .replace('#include <project_vertex>', WIND_PROJ.replace('WVARS', o.fruit ? 'worg.xz = aT.xy; float whN = aT.z; float wflex = 0.6; float wbph = aT.w; /* les fruits bougent avec leur touffe */' : 'float whN = position.y; float wflex = aW.x; float wbph = aW.y;'));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uNoise; uniform vec2 uGrain; uniform float uBark, uNightK, uBack; uniform vec3 uCamP, uFSun, uFSunCol; varying vec3 vWP; varying float vFx;\n#ifdef GRASS\nvarying float vGw;\n#endif\n')
      
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n if (vColor.r > 1.6) { diffuseColor.rgb = vec3(0.16, 0.13, 0.1) * (1.0 - uNightK * 0.7); totalEmissiveRadiance += vec3(1.0, 0.62, 0.26) * (0.25 + 1.4 * uNightK); }\n#endif')
      .replace('#include <fog_fragment>', FOG_FRAG)
      .replace('vLightFront : vLightBack', 'vLightFront : vLightFront').replace('vIndirectFront : vIndirectBack', 'vIndirectFront : vIndirectFront')
      .replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing && vFx > 0.3) diffuseColor.rgb *= uBack;\n diffuseColor.rgb *= (1.0 - uGrain.y * 0.5) + uGrain.y * (texture2D(uNoise, vWP.xz * uGrain.x * 0.21 + vWP.y * uGrain.x * 0.13).r * 0.6 + texture2D(uNoise, vWP.zx * uGrain.x * 0.9 + vWP.y * 0.31).g * 0.4);\n if (uBark > 0.5 && vFx < 0.35) diffuseColor.rgb *= 0.55 + 0.55 * texture2D(uNoise, vec2(vWP.x * 1.9 + vWP.z * 1.3, vWP.y * 0.2)).r + 0.3 * texture2D(uNoise, vec2(vWP.x * 6.1 - vWP.z * 4.7, vWP.y * 0.8)).g;\n#ifdef GRASS\n diffuseColor.rgb *= 1.0 + vGw * 0.42; diffuseColor.rgb += vec3(0.05, 0.06, 0.02) * vGw;\n#endif');
  };
  if (o.grass) m.defines = { GRASS: '' };
  m.customProgramCacheKey = () => 'm' + (o.fruit ? 1 : 0) + (o.grass ? 'g' : '');
  return m;
}

/* ---------- terrain (relief façon The Witness : falaises, terrasses, baie, cap, ravine, îlots) ---------- */
const TS = 720, TN = 301, TC = TS / (TN - 1);
let H = new Float32Array(TN * TN);
const VILLAGE = { x: -78, z: 96 }, CAPE = { x: 212, z: -128 };
const RAVINE = [[25, -20], [70, 12], [120, 34], [175, 46], [230, 52]];
const STACKS = [[-250, -150, 15, 13], [-232, -182, 9, 20], [60, -292, 12, 16], [268, 120, 10, 11], [-292, 30, 8, 9]];
function distPoly(x, z, pts) {
  let b = 1e9;
  for (let i = 0; i < pts.length - 1; i++) { const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0] - ax, bz = pts[i + 1][1] - az; const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1); b = Math.min(b, Math.hypot(x - ax - bx * t, z - az - bz * t)); }
  return b;
}
function coastInfo(x, z) {
  const wx = x + (fbm(x * 0.006 + 3.1, z * 0.006 + 1.7, 3) - 0.5) * 60, wz = z + (fbm(x * 0.006 + 9.4, z * 0.006 + 5.2, 3) - 0.5) * 60;
  const d = Math.hypot(wx, wz) || 1e-3, ang = Math.atan2(wz, wx), ca = Math.cos(ang), sa = Math.sin(ang);
  let R = 212 * (0.86 + 0.28 * fbm(ca * 1.2 + 5.2, sa * 1.2 + 9.1, 3));
  const bay = Math.exp(-Math.pow(angDiff(ang, 2.25) / 0.3, 2)), cape = Math.exp(-Math.pow(angDiff(ang, -0.55) / 0.15, 2));
  R += -58 * bay + 60 * cape;
  let cl = smooth(0.44, 0.6, fbm(ca * 1.7 + 20, sa * 1.7 + 31, 2) - sa * 0.27);
  cl = Math.max(cl * (1 - bay) * (1 - Math.exp(-Math.pow(angDiff(ang, 1.57) / 0.35, 2))), smooth(0.25, 0.7, cape));
  return { dC: R - d, cl, wx, wz };
}
function genHeight(x, z) {
  const ci = coastInfo(x, z), dC = ci.dC, cl = ci.cl;
  let h;
  if (dC < 0) h = Math.max(-16, dC * lerp(0.085, 0.24, cl));
  else {
    const beach = dC < 34 ? dC * 0.07 : 2.38 + (dC - 34) * 0.04;
    const cliffH = 8 + 11 * fbm(x * 0.012 + 50, z * 0.012, 2);
    h = lerp(beach, cliffH * smooth(0, 8, dC) + Math.max(0, dC - 8) * 0.03, cl);
    if (dC < 34) h += (vnoise(x * 0.15, z * 0.15) - 0.5) * 0.3 * smooth(4, 14, dC) * (1 - cl);
  }
  const land = smooth(30, 100, dC);
  h += (fbm(x * 0.009 + 3, z * 0.009 + 7, 4) - 0.36) * 17 * land;
  h += Math.exp(-((x - 105) * (x - 105) + (z - 85) * (z - 85)) / (48 * 48)) * 15 * smooth(10, 50, dC);
  if (dC > 34) h = Math.max(h, 2.0);
  const tm = smooth(0.48, 0.6, fbm(x * 0.007 + 60, z * 0.007 + 80, 2)) * smooth(38, 70, dC);
  if (tm > 0) { const st = 7.5, q = h / st, f = q - Math.floor(q); h = lerp(h, (Math.floor(q) + smooth(0.7, 0.95, f)) * st, tm); }
  const mx = x - 8, mz = z + 42, md2 = mx * mx + mz * mz;
  const ridge = 1 - Math.abs(fbm(ci.wx * 0.012 + 11, ci.wz * 0.012 + 4, 4) * 2 - 1);
  const mm = Math.exp(-md2 / (76 * 76)), r2 = 1 - Math.abs(fbm(ci.wx * 0.034 + 31, ci.wz * 0.034 + 17, 3) * 2 - 1);
  h += mm * (54 + 44 * ridge * ridge) + Math.sqrt(mm) * (r2 - 0.45) * 15 * smooth(0.04, 0.4, mm) + Math.exp(-md2 / (140 * 140)) * 11 * ridge * smooth(0, 40, dC);
  const rv = distPoly(x, z, RAVINE); if (rv < 30 && h > 1.2) h -= Math.exp(-(rv * rv) / (8 * 8)) * Math.min(10, (h - 1.2) * 0.62);
  const vd = Math.hypot(x - VILLAGE.x, z - VILLAGE.z); if (vd < 46 && dC > 6) h = lerp(h, 2.9 + (vnoise(x * 0.1, z * 0.1) - 0.5) * 0.25, smooth(46, 28, vd) * smooth(6, 16, dC));
  const cd = Math.hypot(x - CAPE.x, z - CAPE.z); if (cd < 24) h = lerp(h, 16.5, smooth(24, 11, cd));
  for (const s of STACKS) { const sd = Math.hypot(x - s[0], z - s[1]); if (sd < s[2] * 1.6) h = Math.max(h, -9 + (s[3] + 9) * smooth(s[2] * (1.25 + 0.5 * vnoise(x * 0.2, z * 0.2)), s[2] * 0.4, sd)); }
  return h;
}
function generateIsland() { for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) H[j * TN + i] = genHeight(-TS / 2 + i * TC, -TS / 2 + j * TC); erode(); }
/* érosion hydraulique : des gouttes ruissellent, creusent des ravines et déposent des cônes d'alluvions */
function erode() {
  const N = TN, m = new Float32Array(N * N), mask = new Float32Array(N * N), r = mulberry(1234);
  for (let k = 0; k < N * N; k++) { const i = k % N, j = (k / N) | 0, x = -TS / 2 + i * TC, z = -TS / 2 + j * TC; m[k] = H[k] / TC;
    mask[k] = smooth(1.6, 6, H[k]) * smooth(30, 48, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)) * smooth(14, 26, Math.hypot(x - CAPE.x, z - CAPE.z)) * smooth(16, 44, coastInfo(x, z).dC); }
  const hg = (x, y) => { const i = x | 0, j = y | 0, u = x - i, v = y - j, k = j * N + i, a = m[k], b = m[k + 1], c = m[k + N], d = m[k + N + 1]; return [a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v, (b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u]; };
  const drops = 90000, inertia = 0.07, capK = 3.0, minCap = 0.01, erodeK = 0.22, depK = 0.3, evap = 0.022, grav = 4;
  for (let n = 0; n < drops; n++) {
    let x = 4 + r() * (N - 9), y = 4 + r() * (N - 9), dx = 0, dy = 0, sp = 1, wat = 1, sed = 0;
    if (mask[(y | 0) * N + (x | 0)] < 0.05) continue;
    for (let life = 0; life < 46; life++) {
      const i = x | 0, j = y | 0, u = x - i, v = y - j, k = j * N + i, g = hg(x, y);
      dx = dx * inertia - g[1] * (1 - inertia); dy = dy * inertia - g[2] * (1 - inertia);
      const len = Math.hypot(dx, dy); if (len < 1e-6) break; dx /= len; dy /= len;
      x += dx; y += dy; if (x < 2 || y < 2 || x >= N - 3 || y >= N - 3) break;
      const dh = hg(x, y)[0] - g[0], cap = Math.max(-dh * sp * wat * capK, minCap);
      if (sed > cap || dh > 0) {
        const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depK; sed -= dep;
        m[k] += dep * (1 - u) * (1 - v); m[k + 1] += dep * u * (1 - v); m[k + N] += dep * (1 - u) * v; m[k + N + 1] += dep * u * v;
      } else {
        const er = Math.min((cap - sed) * erodeK, -dh) * mask[k]; sed += er;
        for (let b = -1; b <= 2; b++) for (let a = -1; a <= 2; a++) { const wgt = Math.max(0, 1.6 - Math.hypot(a - u, b - v)) / 9.2; m[k + b * N + a] -= er * wgt; }
      }
      sp = Math.sqrt(Math.max(0, sp * sp - dh * grav)); wat *= 1 - evap; if (m[(y | 0) * N + (x | 0)] * TC < 0.3) break;
    }
  }
  for (let k = 0; k < N * N; k++) { const he = m[k] * TC; H[k] = lerp(H[k], clamp(he, H[k] - 6, H[k] + 2.5), mask[k]); }
  const t = H.slice(); // léger lissage pour gommer les pics isolés
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; H[k] = lerp(t[k], (t[k - 1] + t[k + 1] + t[k - N] + t[k + N]) / 4, 0.18 * mask[k]); }
}
const CD = { n: 145, d: null };
function buildCoastDist() {
  const n = CD.n, c = TS / (n - 1), d = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) d[j * n + i] = heightAt(-TS / 2 + i * c, -TS / 2 + j * c) < 0.15 ? 0 : 1e6;
  const D1 = c, D2 = c * 1.4142;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; let v = d[k]; if (i > 0) v = Math.min(v, d[k - 1] + D1); if (j > 0) { v = Math.min(v, d[k - n] + D1); if (i > 0) v = Math.min(v, d[k - n - 1] + D2); if (i < n - 1) v = Math.min(v, d[k - n + 1] + D2); } d[k] = v; }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { const k = j * n + i; let v = d[k]; if (i < n - 1) v = Math.min(v, d[k + 1] + D1); if (j < n - 1) { v = Math.min(v, d[k + n] + D1); if (i < n - 1) v = Math.min(v, d[k + n + 1] + D2); if (i > 0) v = Math.min(v, d[k + n - 1] + D2); } d[k] = v; }
  CD.d = d;
}
function coastDist(x, z) {
  if (!CD.d) return 0; const n = CD.n, c = TS / (n - 1), fx = clamp((x + TS / 2) / c, 0, n - 1.001), fz = clamp((z + TS / 2) / c, 0, n - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, d = CD.d;
  return lerp(lerp(d[j * n + i], d[j * n + i + 1], u), lerp(d[(j + 1) * n + i], d[(j + 1) * n + i + 1], u), v);
}
function heightAt(x, z) {
  let fx = (x + TS / 2) / TC, fz = (z + TS / 2) / TC;
  if (fx < 0 || fz < 0 || fx >= TN - 1 || fz >= TN - 1) return -16;
  const i = fx | 0, j = fz | 0; fx -= i; fz -= j; const k = j * TN + i;
  return lerp(lerp(H[k], H[k + 1], fx), lerp(H[k + TN], H[k + TN + 1], fx), fz);
}
function slopeAt(x, z) { const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
let terrain, heightTex, heightData;
function buildTerrain() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(TN * TN * 3), idx = new Uint32Array((TN - 1) * (TN - 1) * 6);
  let q = 0;
  for (let j = 0; j < TN - 1; j++) for (let i = 0; i < TN - 1; i++) { const a = j * TN + i; idx[q++] = a; idx[q++] = a + TN; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = a + TN; idx[q++] = a + TN + 1; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshLambertMaterial();
  m.onBeforeCompile = sh => {
    sh.uniforms.uNoise = U.noise; sh.uniforms.uCamP = WU.uCam; sh.uniforms.uFSun = FOGU.uFSun; sh.uniforms.uFSunCol = FOGU.uFSunCol; sh.uniforms.uSkyC = WU.uSky; sh.uniforms.uTime = U.time; sh.uniforms.uWind = WU.uWind; sh.uniforms.uUnder = U.under;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vTN;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = position; vTN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uNoise; uniform vec3 uCamP, uFSun, uFSunCol, uSkyC; uniform float uTime, uUnder; uniform vec3 uWind; varying vec3 vWP; varying vec3 vTN;').replace('#include <fog_fragment>', FOG_FRAG).replace('#include <color_fragment>', `
  float n1 = texture2D(uNoise, vWP.xz * 0.011).r, n2 = texture2D(uNoise, vWP.xz * 0.06).g, n3 = texture2D(uNoise, vWP.xz * 0.37 + vWP.y * 0.21).b, n4 = texture2D(uNoise, vWP.xz * 1.7 + vWP.y * vec2(0.9, 0.6)).r, n5 = texture2D(uNoise, vWP.zx * 5.1 + vWP.y * vec2(2.3, 3.1)).g;
  float th = vWP.y, tsl = 1.0 - normalize(vTN).y;
  vec3 sand = mix(vec3(1.0, 0.90, 0.56), vec3(0.99, 0.82, 0.44), n2) * (0.9 + 0.12 * n4 + 0.08 * n5);
  sand *= 0.965 + 0.035 * sin((vWP.x * 0.8 + vWP.z * 0.5) * 3.0 + n2 * 9.0);
  sand = mix(sand, vec3(1.0, 0.96, 0.74), smoothstep(0.7, 0.95, n5) * 0.4);
  float wetK = smoothstep(0.55, 0.0, th + n3 * 0.3);
  { vec2 nn = normalize(vWP.xz + vec2(1e-4)); float amp = mix(0.18, 0.98, dot(nn, -uWind.xy) * 0.5 + 0.5) * (0.4 + 0.6 * uWind.z);
    float ph = uTime * 0.55 + (sin(vWP.x * 0.021) + sin(vWP.z * 0.017 + 1.3)) * 1.5, x = fract(ph / 6.2831853), since = x < 0.3 ? x + 0.7 : x - 0.3;
    float reach = amp * 0.65 + n3 * 0.06; // plus haut point atteint par la dernière vague
    float wet = (1.0 - smoothstep(reach - 0.02, reach + 0.03, th)) * exp(-since * 2.6);
    wetK = max(wetK, wet * 0.95); }
  vec3 tc = mix(sand, sand * vec3(0.66, 0.6, 0.5) + uSkyC * 0.16, wetK);
  vec3 grass = mix(vec3(0.20, 0.47, 0.13), vec3(0.42, 0.64, 0.17), smoothstep(0.25, 0.75, n1));
  grass = mix(grass, vec3(0.74, 0.70, 0.27), smoothstep(0.58, 0.9, n2) * 0.5);
  grass = mix(grass, vec3(0.14, 0.38, 0.16), smoothstep(0.6, 0.9, n3) * 0.4);
  { // grain de l'herbe : deux échelles tournées et déformées qui ne tombent jamais juste, pour casser la grille
    vec2 q = vWP.xz + (vec2(n1, n3) - 0.5) * 2.5;
    float m1 = texture2D(uNoise, mat2(0.8, -0.6, 0.6, 0.8) * q * 0.53 + 0.17).r, m2 = texture2D(uNoise, mat2(0.36, 0.93, -0.93, 0.36) * q * 0.23 + 0.61).g, m3 = texture2D(uNoise, mat2(0.97, 0.26, -0.26, 0.97) * q * 1.31 + 0.43).b;
    grass *= 0.76 + 0.2 * m1 + 0.18 * m2 + 0.1 * m3 + 0.06 * n5; }
  vec3 dirt = mix(vec3(0.56, 0.38, 0.22), vec3(0.42, 0.29, 0.18), n3) * (0.8 + 0.4 * n4);
  dirt = mix(dirt, vec3(0.66, 0.6, 0.5), smoothstep(0.78, 0.92, n5) * 0.6);
  float strata = smoothstep(0.35, 0.65, sin(th * 0.55 + n1 * 14.0 + n2 * 4.0) * 0.5 + 0.5);
  vec3 rock = mix(vec3(0.42, 0.39, 0.38), vec3(0.62, 0.53, 0.43), strata * 0.6 + n2 * 0.4);
  rock = mix(rock, vec3(0.72, 0.47, 0.30), smoothstep(0.6, 0.95, n1) * 0.45);
  rock = mix(rock, vec3(0.30, 0.30, 0.33), smoothstep(0.55, 0.9, n3) * 0.4);
  rock *= 0.7 + 0.36 * n4 + 0.24 * n5;
  rock = mix(rock, vec3(0.36, 0.5, 0.2) * (0.7 + 0.5 * n4), smoothstep(0.62, 0.8, n2) * smoothstep(0.75, 0.45, tsl) * 0.6);
  float tg = smoothstep(2.2, 3.5, th + (n2 - 0.5) * 1.8);
  tc = mix(tc, grass, tg);
  tc = mix(tc, mix(grass * 0.9, dirt, 0.6), smoothstep(0.16, 0.3, tsl + (n3 - 0.5) * 0.1) * tg * 0.85);
  tc = mix(tc, rock, smoothstep(0.3, 0.44, tsl + (n3 - 0.5) * 0.14 + (n2 - 0.5) * 0.08) * smoothstep(0.2, 1.4, th));
  tc = mix(tc, rock * 1.08, smoothstep(74.0, 96.0, th + n1 * 16.0) * 0.6);
  tc = mix(tc, mix(sand, vec3(0.62, 0.86, 0.66), 0.5), smoothstep(-0.2, -6.0, th) * 0.8);
  diffuseColor.rgb = pow(tc, vec3(2.2));
  if (uUnder > 0.0) { // caustiques : la lumière dansante sur le fond marin
    float ca = texture2D(uNoise, vWP.xz * 0.09 + vec2(uTime * 0.021, uTime * 0.013)).g, cb = texture2D(uNoise, vWP.xz * 0.075 - vec2(uTime * 0.017, -uTime * 0.019) + 0.37).g;
    float cs = pow(1.0 - abs(ca - cb) * 2.6, 9.0); diffuseColor.rgb += vec3(0.55, 0.85, 0.8) * cs * uUnder * smoothstep(0.5, -1.5, vWP.y) * 0.55; }`);
  };
  terrain = new THREE.Mesh(g, m);
  terrain.receiveShadow = true; terrain.frustumCulled = false;
  scene.add(terrain);
  heightData = new Uint8Array(TN * TN);
  heightTex = new THREE.DataTexture(heightData, TN, TN, THREE.LuminanceFormat);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  refreshTerrain(0, TN - 1, 0, TN - 1);
}
function refreshTerrain(i0, i1, j0, j1) {
  i0 = clamp(i0, 0, TN - 1); i1 = clamp(i1, 0, TN - 1); j0 = clamp(j0, 0, TN - 1); j1 = clamp(j1, 0, TN - 1);
  const pos = terrain.geometry.attributes.position;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * TN + i;
    pos.array[k * 3] = -TS / 2 + i * TC; pos.array[k * 3 + 1] = H[k]; pos.array[k * 3 + 2] = -TS / 2 + j * TC;
    heightData[k] = clamp((H[k] + 8) / 16, 0, 1) * 255;
  }
  pos.needsUpdate = true; heightTex.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
}
function findSpot(ang, hmin, hmax, maxSlope = 0.3, dmax = 300) {
  for (let d = dmax; d > 20; d -= 1.5) { const x = Math.cos(ang) * d, z = Math.sin(ang) * d, h = heightAt(x, z); if (h >= hmin && h <= hmax && slopeAt(x, z) < maxSlope) return { x, z, h }; }
  return { x: Math.cos(ang) * 120, z: Math.sin(ang) * 120, h: heightAt(Math.cos(ang) * 120, Math.sin(ang) * 120) };
}

/* ---------- eau + ressac ---------- */
let water;
const WU = {
  uTime: U.time, uWind: { value: new V3(1, 0, 0.5) }, uH: { value: null }, uCam: { value: new V3() }, uFogD: { value: FOG_D }, uNoise: U.noise,
  uShallow: { value: new THREE.Color('#7ff5dc') }, uMidC: { value: new THREE.Color('#14bfe0') }, uDeep: { value: new THREE.Color('#0a55c4') }, uFoam: { value: new THREE.Color('#ffffff') },
  uTint: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color('#bfe6f5') }, uSky: { value: new THREE.Color('#bfe6f5') },
  uSunD: { value: new V3(0, 1, 0) }, uSunC: { value: new THREE.Color(1, 1, 1) }
};
function swashPhase(x, z, t) { return t * 0.55 + (Math.sin(x * 0.021) + Math.sin(z * 0.017 + 1.3)) * 1.5; }
function swashG(ph) { const x = ((ph / 6.2831853) % 1 + 1) % 1; return x < 0.3 ? smooth(0, 0.3, x) : 1 - smooth(0.3, 1, x); }
function waveAmp(x, z) { const d = Math.hypot(x, z) || 1, w = WU.uWind.value; const e = (x / d * -w.x + z / d * -w.y) * 0.5 + 0.5; return lerp(0.18, 0.98, e) * (0.4 + 0.6 * w.z); }
function waterLevel(x, z) { return waveAmp(x, z) * (swashG(swashPhase(x, z, U.time.value)) - 0.35); }
const WATER_VS = `
uniform sampler2D uH; uniform float uTime; uniform vec3 uWind;
varying vec3 vW; varying float vAmp; varying float vCrest; varying float vCp; varying float vSw;
float hAt(vec2 p){ vec2 uv = p / 720.0 + 0.5; if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -8.0; return texture2D(uH, uv).r * 16.0 - 8.0; }
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 n = normalize(w.xz + vec2(1e-4));
  float expo = dot(n, -uWind.xy) * 0.5 + 0.5;
  float amp = mix(0.18, 0.98, expo) * (0.4 + 0.6 * uWind.z);
  float ph = uTime * 0.55 + (sin(w.x * 0.021) + sin(w.z * 0.017 + 1.3)) * 1.5;
  float x = fract(ph / 6.2831853);
  float g = x < 0.3 ? smoothstep(0.0, 0.3, x) : 1.0 - smoothstep(0.3, 1.0, x);
  float lvl = amp * (g - 0.35);
  float d = max(lvl - hAt(w.xz), 0.0);
  // houle du large, portée par le vent
  vec2 wp = vec2(-uWind.y, uWind.x);
  float sw = sin(dot(w.xz, uWind.xy) * 0.075 - uTime * 0.95) + 0.55 * sin(dot(w.xz, uWind.xy * 0.8 + wp * 0.6) * 0.12 - uTime * 1.35) + 0.3 * sin(dot(w.xz, uWind.xy * 0.6 - wp * 0.8) * 0.21 - uTime * 1.8);
  lvl += sw * 0.42 * (0.3 + uWind.z) * smoothstep(1.5, 9.0, d);
  // rouleaux : les crêtes se resserrent et grandissent en approchant du rivage, puis déferlent
  float cp = 9.0 * sqrt(d + 0.02) + ph + 1.2;
  float crest = pow(max(sin(cp), 0.0), 5.0);
  float shoal = smoothstep(7.5, 1.7, d) * smoothstep(0.0, 0.5, d);
  lvl += crest * shoal * (0.28 + 0.95 * amp);
  w.y += lvl; vW = w.xyz; vAmp = amp; vCrest = crest * shoal; vCp = cp; vSw = sw;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FS = `
precision highp float;
uniform sampler2D uH, uNoise; uniform float uTime, uFogD, uInner; uniform vec3 uWind, uShallow, uMidC, uDeep, uFoam, uTint, uFog, uSky, uCam, uSunD, uSunC;
varying vec3 vW; varying float vAmp; varying float vCrest; varying float vCp; varying float vSw;
vec2 hash22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float voro(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g); o = 0.5 + 0.4 * sin(uTime * 0.6 + 6.2831 * o);
    float d = length(g + o - f); if(d < d1){ d2 = d1; d1 = d; } else if(d < d2) d2 = d;
  }
  return d2 - d1;
}
void main(){
  float edgeD = max(abs(vW.x), abs(vW.z));
  if(uInner > 0.5 ? edgeD > 380.0 : edgeD < 379.6) discard;
  vec2 uv = vW.xz / 720.0 + 0.5;
  float th = -8.0;
  if(uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) th = texture2D(uH, uv).r * 16.0 - 8.0;
  float depth = vW.y - th;
  if(depth < -0.03) discard;
  vec3 vd = vW - uCam; float dist = length(vd); vec3 vn = vd / dist;
  vec2 flow = uWind.xy * uTime * 0.02;
  float f1 = texture2D(uNoise, vW.xz * 0.045 + flow).r, f2 = texture2D(uNoise, vW.xz * 0.13 - flow * 1.7 + 0.3).g, f3 = texture2D(uNoise, vW.xz * 0.41 + flow * 2.3).b;
  // couleur : turquoise sur le sable, bleu profond au large, bandes claires sur le dos de la houle
  vec3 col = mix(uShallow, uMidC, smoothstep(0.0, 2.6, depth));
  col = mix(col, uDeep, smoothstep(1.6, 8.5, depth));
  col *= 0.93 + 0.16 * vSw * smoothstep(1.5, 6.0, depth) + 0.12 * (f1 - 0.5);
  // petites rides : normale approchée par deux bruits qui glissent
  vec3 nr = normalize(vec3((f2 - 0.5) * 0.5 + (f3 - 0.5) * 0.3, 1.0, (texture2D(uNoise, vW.zx * 0.13 + flow * 1.4).g - 0.5) * 0.5 + (texture2D(uNoise, vW.zx * 0.41 - flow * 2.0).b - 0.5) * 0.3));
  float fres = pow(1.0 - clamp(dot(-vn, nr), 0.0, 1.0), 4.0);
  col = mix(col, uSky, fres * 0.6 * smoothstep(0.3, 3.0, depth));
  float spec = pow(max(dot(reflect(vn, nr), uSunD), 0.0), 70.0) * 1.1 * smoothstep(0.45, 0.7, f3 + f2 * 0.3) + pow(max(dot(reflect(vn, nr), uSunD), 0.0), 900.0) * 3.0;
  float glit = pow(max(dot(reflect(vn, normalize(nr + vec3(f3 - 0.5, 0.0, f1 - 0.5) * 0.6)), uSunD), 0.0), 26.0) * smoothstep(0.62, 0.8, texture2D(uNoise, vW.xz * 1.3 + flow * 9.0).r);
  float foam = 0.0;
  // filets d'écume du large
  if(dist < 460.0){
    vec2 q = vW.xz * 0.07 - uWind.xy * uTime * 0.045 * (0.3 + uWind.z);
    float v = voro(q + 0.22 * vec2(f2, f1));
    foam = smoothstep(0.045, 0.015, v) * smoothstep(0.5, 0.62, f1) * smoothstep(0.1, 0.55, sin(q.x * 3.1 + f2 * 5.0) * sin(q.y * 2.7 + 1.3) + 0.3) * smoothstep(2.0, 5.0, depth) * 0.75 * smoothstep(460.0, 260.0, dist);
  }
  if(depth < 8.0){
    float brk = smoothstep(2.8, 0.9, depth);                                   // zone de déferlement
    float lip = smoothstep(0.55, 0.9, vCrest) * (0.35 + 0.65 * brk);            // lèvre du rouleau
    lip *= 0.75 + 0.5 * f2;
    float back = smoothstep(-0.2, 0.9, sin(vCp - 1.1)) * brk;                   // traîne d'écume derrière la crête
    float trail = back * smoothstep(0.5, 0.66, f2 * 0.6 + f3 * 0.4 + back * 0.1);
    float sheet = smoothstep(0.85, 0.0, depth);                                 // nappe du ressac
    float lace = sheet * smoothstep(0.53, 0.64, f2 * 0.55 + f3 * 0.45 + sheet * sheet * 0.14);
    float edge = smoothstep(0.16, 0.03, depth) * (0.7 + 0.3 * f3);
    foam = max(foam, max(max(lip, trail * 0.9), max(lace * 0.85, edge)));
  }
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, uFoam, foam);
  col *= uTint;
  float lowSun = 1.0 - smoothstep(0.05, 0.6, uSunD.y);
  float path = pow(max(dot(reflect(vn, normalize(nr + vec3(f3 - 0.5, 0.0, f1 - 0.5) * 1.1)), uSunD), 0.0), 12.0) * smoothstep(0.5, 0.75, texture2D(uNoise, vW.xz * 0.7 - flow * 6.0).g); // traînée dorée scintillante
  col += uSunC * (spec * 0.9 + glit * 0.75 + path * (0.55 + 1.0 * lowSun)) * (1.0 - foam) * smoothstep(0.2, 1.5, depth);
  float alpha = mix(mix(0.32, 0.97, smoothstep(0.0, 3.2, depth)), 1.0, foam) * smoothstep(-0.03, 0.05, depth);
  float fd = dist * uFogD; fd = 1.0 - exp(-fd * fd);
  col = mix(col, uFog, fd);
  gl_FragColor = vec4(col, alpha);
}`;
function buildWater() {
  WU.uH.value = heightTex;
  const mk = (g, inner) => { const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, WU, { uInner: { value: inner } }), transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: WATER_VS, fragmentShader: WATER_FS }); const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.renderOrder = 2; scene.add(me); return me; };
  const fine = new THREE.PlaneGeometry(760, 760, LOW ? 300 : 460, LOW ? 300 : 460); fine.rotateX(-Math.PI / 2);
  water = mk(fine, 1);
  const g = new THREE.PlaneGeometry(2, 2, 240, 240); g.rotateX(-Math.PI / 2);
  { const a = g.attributes.position.array, f = u => Math.sign(u) * (700 * Math.abs(u) + 2000 * Math.abs(u) ** 3); for (let i = 0; i < a.length; i += 3) { a[i] = f(a[i]); a[i + 2] = f(a[i + 2]); } }
  window.waterOuter = mk(g, 0);
}

/* ---------- ciel ---------- */
let sky, stars, sunDisc, sunHalo, moonDisc, sunLight, hemi;
const SU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uSun: { value: new V3(0, 1, 0) }, uGlow: { value: new THREE.Color() }, uGlowK: { value: 1 },
  uNoise: U.noise, uOff: { value: new THREE.Vector2(0.3, 0.7) }, uCover: { value: 0.55 }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.7, 0.75, 0.85) }, uLightD: { value: new V3(0, 1, 0) }, uSunP: { value: new V3(0, 1, 0) }, uMoonP: { value: new V3(0, -1, 0) }, uDiscC: { value: new THREE.Color(1, 1, 1) }, uMoonK: { value: 0 }, uLitK: { value: 1 } };
function buildSky() {
  sky = new THREE.Mesh(new THREE.SphereGeometry(2800, 48, 24), new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.BackSide, depthWrite: false, fog: false, transparent: true,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uMid, uGlow, uSun, uCloudLit, uCloudShade, uLightD, uSunP, uMoonP, uDiscC; uniform float uGlowK, uCover, uMoonK, uLitK; uniform vec2 uOff; uniform sampler2D uNoise; varying vec3 vD;
// nuages : grandes masses, bosses et détails glissent à des vitesses différentes, ils se déforment en avançant
float cn(vec2 p, vec2 o){ return texture2D(uNoise, (p + o) * 0.11).r * 0.55 + texture2D(uNoise, (p + o * 1.25) * 0.29 + vec2(0.37, 0.11)).g * 0.3 + texture2D(uNoise, (p + o * 1.5) * 0.83 + vec2(0.71, 0.53)).b * 0.15; }
void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, y)); c = mix(c, uTop, smoothstep(0.12, 0.75, y));
  float s = max(dot(d, uSun), 0.0);
  c += uGlow * uGlowK * (pow(s, 4.0) * 0.38 + pow(s, 40.0) * 0.45) * (1.0 - y * 0.55) * smoothstep(-0.25, 0.0, d.y);
  float above = smoothstep(-0.004, 0.012, d.y);   // rien ne se dessine sous l'horizon
  float sd = dot(d, uSunP); c = mix(c, uDiscC * 1.15, smoothstep(0.9977, 0.9981, sd) * above); c += uDiscC * (pow(max(sd, 0.0), 300.0) * 0.6 + pow(max(sd, 0.0), 30.0) * 0.28 + pow(max(sd, 0.0), 6.0) * 0.12) * above * uGlowK;
  float clr = above; float mv = dot(d, uMoonP); clr *= 1.0 - smoothstep(0.9993, 0.9996, mv); c = mix(c, vec3(0.93, 0.95, 1.0), smoothstep(0.99965, 0.99978, mv) * uMoonK * above); c += vec3(0.5, 0.6, 0.9) * smoothstep(0.992, 1.0, mv) * 0.15 * uMoonK * above;
  if(d.y > 0.012){
    // nuages peints à plat sur la voûte : formes nettes, bord éclairé côté soleil, base ombrée
    vec2 uv = d.xz / (d.y + 0.17) * 0.9;
    float n = cn(uv, uOff), m = smoothstep(uCover, uCover + 0.06, n);
    float n2 = cn(uv + normalize(uLightD.xz + vec2(1e-4)) * 0.14, uOff);
    float lit = clamp(0.5 + (n - n2) * 8.0, 0.0, 1.0); lit = mix(0.5, smoothstep(0.15, 0.85, lit), uLitK);
    vec3 cc = mix(uCloudShade, uCloudLit, lit);
    cc = mix(cc, mix(uCloudShade, uCloudLit, 0.5), smoothstep(uCover + 0.05, uCover + 0.3, n) * 0.5);
    cc += uGlow * uGlowK * pow(s, 6.0) * 0.35;
    { float rim = 1.0 - smoothstep(uCover, uCover + 0.13, n); cc += uGlow * uGlowK * (pow(s, 3.0) * rim * 0.95 + pow(s, 10.0) * 0.45); } // contre-jour : bords fins dorés côté soleil
    cc = mix(cc, uHor, smoothstep(0.3, 0.0, y) * 0.65);
    float a = m * smoothstep(0.012, 0.1, d.y) * 0.97;
    float ci = smoothstep(0.6, 0.82, texture2D(uNoise, (uv + uOff * 0.55) * vec2(0.045, 0.2) + 0.3).g) * 0.3 * smoothstep(0.08, 0.4, d.y);
    clr *= 1.0 - max(a, ci * 2.2);
    c = mix(c, uCloudLit, ci * (1.0 - a));
    c = mix(c, cc, a);
    // deuxième couche de petits nuages, plus basse et plus rapide : on voit le ciel bouger partout
    vec2 uv2 = d.xz / (d.y + 0.1) * 1.6 + vec2(3.7, 1.3);
    float n3 = cn(uv2, uOff * 1.7), m2 = smoothstep(uCover + 0.08, uCover + 0.13, n3) * smoothstep(0.02, 0.12, d.y) * (1.0 - a);
    float n4 = cn(uv2 + normalize(uLightD.xz + vec2(1e-4)) * 0.12, uOff * 1.7), lit2 = mix(0.5, smoothstep(0.15, 0.85, clamp(0.5 + (n3 - n4) * 8.0, 0.0, 1.0)), uLitK);
    vec3 cc2 = mix(uCloudShade, uCloudLit, lit2); cc2 += uGlow * uGlowK * (pow(s, 3.0) * (1.0 - smoothstep(uCover + 0.08, uCover + 0.2, n3)) * 0.9 + pow(s, 6.0) * 0.35); cc2 = mix(cc2, uHor, smoothstep(0.3, 0.0, y) * 0.6);
    clr *= 1.0 - m2; c = mix(c, cc2, m2 * 0.95);
  }
  gl_FragColor = vec4(c, 1.0 - clr * 0.999); }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const r = mulberry(77), sp = [];
  for (let i = 0; i < 1400; i++) { const a = r() * 6.2832, y = r() * 1.9 - 0.95, rr = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * rr * 2500, y * 2500, Math.sin(a) * rr * 2500); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -11; stars.frustumCulled = false; stars.rotation.z = 0.6; scene.add(stars);
  const disc = (rad, hex, op) => { const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), new THREE.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, depthWrite: false })); m.renderOrder = -12; m.frustumCulled = false; scene.add(m); return m; };
  sunHalo = disc(230, 0xfff2c0, 0.22); sunDisc = disc(105, 0xfffbe8, 1); moonDisc = disc(64, 0xe8efff, 1);
  sunHalo.visible = sunDisc.visible = moonDisc.visible = false;
  hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.6); scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xffffff, 1); sunLight.castShadow = true;
  const sm = LOW ? 1024 : 2048; sunLight.shadow.mapSize.set(sm, sm);
  const sc = sunLight.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 520;
  sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.35; sunLight.shadow.radius = 2.5;
  scene.add(sunLight); scene.add(sunLight.target);
}

/* ---------- constructeur de géométries ---------- */
function M(px, py, pz, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  return new THREE.Matrix4().compose(new V3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
}
class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.w = []; this.wf = 0; this.wp = 0; }
  add(geo, hex, m, shade = 0.3, jit = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
    const P = g.attributes.position.array, N = g.attributes.normal.array, c = lin(hex);
    for (let i = 0; i < P.length; i += 3) {
      this.p.push(P[i], P[i + 1], P[i + 2]); this.n.push(N[i], N[i + 1], N[i + 2]);
      let s = 1 - shade * (0.5 - 0.5 * N[i + 1]);
      if (jit) s *= 1 - jit + 2 * jit * hash2(Math.round(P[i] * 37) + Math.round(P[i + 2] * 53) * 7, Math.round(P[i + 1] * 3.1));
      this.c.push(c.r * s, c.g * s, c.b * s); this.w.push(this.wf, this.wp);
    }
    g.dispose(); return this;
  }
  tri(a, b, c, ca, cb, cc, fa, fb, fc) {
    const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)).normalize();
    if (n.y < 0) { let t = b; b = c; c = t; t = cb; cb = cc; cc = t; t = fb; fb = fc; fc = t; n.negate(); }
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.n.push(n.x * 0.5, n.y * 0.5 + 0.5, n.z * 0.5);
    this.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    const f = this.wf; this.w.push(fa === undefined ? f : fa, this.wp, fb === undefined ? f : fb, this.wp, fc === undefined ? f : fc, this.wp);
  }
  addGB(o, m) { // fusionne un autre GB en gardant ses couleurs
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new V3();
    for (let i = 0; i < o.p.length; i += 3) { v.set(o.p[i], o.p[i + 1], o.p[i + 2]).applyMatrix4(m); this.p.push(v.x, v.y, v.z); v.set(o.n[i], o.n[i + 1], o.n[i + 2]).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z); }
    this.c.push(...o.c); for (const w of o.w) this.w.push(w); return this;
  }
  triN(a, b, c, ca, cb, cc, na, nb, nc, fa, fb, fc) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); nb = nb || na; nc = nc || na;
    this.n.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
    this.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    const f = this.wf; this.w.push(fa === undefined ? f : fa, this.wp, fb === undefined ? f : fb, this.wp, fc === undefined ? f : fc, this.wp);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 2));
    return g;
  }
}
const ICO = new THREE.IcosahedronGeometry(1, 1), ICO0 = new THREE.IcosahedronGeometry(1, 0), SPH = new THREE.SphereGeometry(1, 12, 9), SPHL = new THREE.SphereGeometry(1, 7, 5);
const _up = new V3(0, 1, 0);
function limb(gb, a, b, ra, rb, hex, seg = 6, jit = 0.14) {
  const d = new V3().subVectors(b, a), len = d.length();
  const m = new THREE.Matrix4().compose(new V3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()), new V3(1, 1, 1));
  gb.add(new THREE.CylinderGeometry(rb, ra, len, seg, 1, true), hex, m, 0.3, jit);
}
// tube continu le long d'un chemin : pas de jour entre les segments quand le tronc se courbe
function tube(gb, pts, rad, hex, seg = 10, jit = 0.15, flex) {
  const n = pts.length, rings = []; let u = null;
  for (let i = 0; i < n; i++) {
    const t = new V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    if (!u) u = new V3().crossVectors(t, Math.abs(t.y) < 0.9 ? _up : new V3(1, 0, 0)).normalize(); else u = u.clone().addScaledVector(t, -u.dot(t)).normalize();
    const v = new V3().crossVectors(t, u), r = typeof rad === 'function' ? rad(i) : rad, c = lin(typeof hex === 'function' ? hex(i) : hex), ring = [];
    for (let k = 0; k < seg; k++) { const a = k / seg * 6.2832, nx = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)); ring.push({ p: pts[i].clone().addScaledVector(nx, r), n: nx, c }); }
    rings.push(ring);
  }
  const put = (q, f) => { const s = (1 - 0.3 * (0.5 - 0.5 * q.n.y)) * (1 - jit + 2 * jit * hash2(Math.round(q.p.x * 37) + Math.round(q.p.z * 53) * 7, Math.round(q.p.y * 3.1))); gb.p.push(q.p.x, q.p.y, q.p.z); gb.n.push(q.n.x, q.n.y, q.n.z); gb.c.push(q.c.r * s, q.c.g * s, q.c.b * s); gb.w.push(f, gb.wp); };
  for (let i = 0; i < n - 1; i++) { const f0 = flex ? flex(i) : gb.wf, f1 = flex ? flex(i + 1) : gb.wf; for (let k = 0; k < seg; k++) { const a = rings[i][k], b = rings[i][(k + 1) % seg], c = rings[i + 1][k], d = rings[i + 1][(k + 1) % seg]; put(a, f0); put(c, f1); put(b, f0); put(b, f0); put(c, f1); put(d, f1); } }
}
// feuille : losange légèrement plié en gouttière
function leaf(gb, p, dir, len, wid, c1, c2, f0, f1) {
  const side = new V3().crossVectors(dir, _up); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize().multiplyScalar(wid * 0.5);
  const mid = p.clone().addScaledVector(dir, len * 0.42), tip = p.clone().addScaledVector(dir, len);
  const l = mid.clone().add(side), r = mid.clone().sub(side); l.y += wid * 0.16; r.y += wid * 0.16;
  const cm = c1.clone().lerp(c2, 0.55), fm = f0 === undefined ? undefined : (f0 + f1) / 2;
  if (LOW) { gb.tri(p, l, tip, c1, cm, c2, f0, fm, f1); gb.tri(p, tip, r, c1, c2, cm, f0, f1, fm); return; }
  const rib = c2.clone().multiplyScalar(1.2); tip.y -= len * 0.07; mid.y -= wid * 0.05;
  gb.tri(p, l, mid, c1, cm, rib, f0, fm, fm); gb.tri(l, tip, mid, cm, c2, rib, fm, f1, fm); gb.tri(p, mid, r, c1, rib, cm, f0, fm, fm); gb.tri(mid, tip, r, rib, c2, cm, fm, f1, fm);
}
// palme ou fronde : nervure courbe + folioles de part et d'autre
function frond(gb, r, o, yaw, len, pitch0, droop, nodes, L, cA, cB, spine) {
  gb.wp = r(); const fx = gb.wf;
  const fw = new V3(Math.cos(yaw), 0, Math.sin(yaw)), side = new V3(-fw.z, 0, fw.x);
  let prev = o.clone(); const sl = len / nodes, a = lin(cA), b = lin(cB);
  for (let i = 0; i < nodes; i++) {
    const t = (i + 0.5) / nodes, pitch = pitch0 - droop * t;
    const dir = new V3(fw.x * Math.cos(pitch), Math.sin(pitch), fw.z * Math.cos(pitch)), nx = prev.clone().addScaledVector(dir, sl);
    const f0 = fx * Math.pow(i / nodes, 1.4), f1 = fx * Math.pow((i + 1) / nodes, 1.4);
    if (spine && !spine[2]) { gb.wf = f0; limb(gb, prev, nx, spine[1] * (1 - t * 0.8), spine[1] * (1 - t * 0.8) * 0.85, spine[0], 3, 0); }
    const prof = Math.pow(Math.sin(Math.PI * (0.08 + 0.9 * t)), L.pow || 0.7), ll = L.len * prof * (0.85 + r() * 0.3);
    const c0 = a.clone().lerp(b, t * 0.8 + r() * 0.2), c1 = c0.clone().multiplyScalar(1.12);
    for (const sg of [1, -1]) {
      const ld = side.clone().multiplyScalar(sg * Math.cos(L.sweep)).addScaledVector(dir, Math.sin(L.sweep)); ld.y -= L.droop * (0.7 + r() * 0.6); ld.normalize();
      if (L.dbl) { for (let h = 0; h < 2; h++) { const bp = prev.clone().lerp(nx, h * 0.5), bq = prev.clone().lerp(nx, h * 0.5 + 0.56), l2 = ld.clone(); l2.y -= (h ? 0.12 : 0) + (r() - 0.5) * 0.14; l2.x += (r() - 0.5) * 0.1; l2.z += (r() - 0.5) * 0.1; l2.normalize(); const tp = bp.clone().lerp(bq, 0.5).addScaledVector(l2, ll * (h ? 0.92 : 1)), cc = h ? c0.clone().multiplyScalar(0.9) : c0; gb.tri(bp, bq, tp, cc, cc, c1, f0, f0, f1 * 1.25); } }
      else if (L.tri) { const bp = prev.clone().lerp(nx, sg > 0 ? 0.0 : 0.4), bq = prev.clone().lerp(nx, sg > 0 ? 0.6 : 1.0); gb.tri(bp, bq, bp.clone().lerp(bq, 0.5).addScaledVector(ld, ll), c0, c0, c1, f0, f0, f1 * 1.25); }
      else leaf(gb, prev.clone().lerp(nx, sg > 0 ? 0.3 : 0.7), ld, ll, L.wid * (0.6 + 0.4 * prof), c0, c1, f0, f1 * 1.25);
    }
    prev = nx;
  }
  leaf(gb, prev, new V3(fw.x, -0.4, fw.z).normalize(), L.len * 0.5, L.wid, b, b, fx, fx * 1.2);
  if (spine && spine[2]) { gb.wf = fx * 0.4; limb(gb, o, prev, spine[1], spine[1] * 0.4, spine[0], 3, 0); }
  gb.wf = fx;
}
// grande feuille en ruban (bananier, taro) : deux demi-limbes de part et d'autre d'une nervure
function blade(gb, r, o, yaw, len, wid, pitch0, droop, segs, cA, cB, prof) {
  gb.wp = r(); const fx = gb.wf, fw = new V3(Math.cos(yaw), 0, Math.sin(yaw)), side = new V3(-fw.z, 0, fw.x), a = lin(cA), b = lin(cB), rib = b.clone().multiplyScalar(1.25);
  let prev = o.clone(), pw = 0.02; const sl = len / segs;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, pitch = pitch0 - droop * (i + 0.5) / segs, dir = new V3(fw.x * Math.cos(pitch), Math.sin(pitch), fw.z * Math.cos(pitch)), nx = prev.clone().addScaledVector(dir, sl);
    const w = i === segs - 1 ? 0.01 : wid * prof(t), f0 = fx * Math.pow(i / segs, 1.3), f1 = fx * Math.pow(t, 1.3);
    const c0 = a.clone().lerp(b, i / segs), c1 = a.clone().lerp(b, t);
    for (const sg of [1, -1]) {
      const e0 = prev.clone().addScaledVector(side, sg * pw), e1 = nx.clone().addScaledVector(side, sg * w); e0.y += pw * 0.3 - (r() * 0.03); e1.y += w * 0.3 - (r() * 0.03);
      gb.tri(prev, nx, e1, rib, rib, c1, f0, f1, f1 * 1.2); gb.tri(prev, e1, e0, rib, c1, c0, f0, f1 * 1.2, f0 * 1.2);
    }
    prev = nx; pw = w;
  }
  gb.wf = fx;
}
// feuille cartoon : ovale pointu, nervure en relief, bords recourbés ; normale imposée (ombrage doux de touffe)
const _LP = [0, 0.18, 0.46, 0.76, 1], _LW = [0.16, 0.8, 1, 0.66, 0];
function cleaf(gb, p, dir, nrm, len, wid, cb, ct, sn, f0, f1) {
  const side = new V3().crossVectors(dir, nrm).normalize(), K = LOW ? [0, 0.45, 1] : _LP, W = LOW ? [0.16, 1, 0] : _LW;
  const cs = [], L = [], R = [], cc = [], ce = [], ff = [];
  for (let i = 0; i < K.length; i++) {
    const t = K[i], c = p.clone().addScaledVector(dir, t * len).addScaledVector(nrm, len * (0.05 * Math.sin(Math.PI * t) - 0.16 * t * t)), w = W[i] * wid * 0.5;
    cs.push(c); L.push(c.clone().addScaledVector(side, w).addScaledVector(nrm, -w * 0.4)); R.push(c.clone().addScaledVector(side, -w).addScaledVector(nrm, -w * 0.4));
    const col = cb.clone().lerp(ct, t); cc.push(col.clone().multiplyScalar(1.1)); ce.push(col.clone().multiplyScalar(0.84)); ff.push(lerp(f0, f1, t));
  }
  const nL = sn.clone().addScaledVector(side, 0.25).normalize(), nR = sn.clone().addScaledVector(side, -0.25).normalize();
  for (let i = 0; i < K.length - 1; i++) {
    gb.triN(cs[i], cs[i + 1], L[i + 1], cc[i], cc[i + 1], ce[i + 1], sn, sn, nL, ff[i], ff[i + 1], ff[i + 1]); gb.triN(cs[i], L[i + 1], L[i], cc[i], ce[i + 1], ce[i], sn, nL, nL, ff[i], ff[i + 1], ff[i]);
    gb.triN(cs[i], R[i + 1], cs[i + 1], cc[i], ce[i + 1], cc[i + 1], sn, nR, sn, ff[i], ff[i + 1], ff[i + 1]); gb.triN(cs[i], R[i], R[i + 1], cc[i], ce[i], ce[i + 1], sn, nR, nR, ff[i], ff[i], ff[i + 1]);
  }
}
// touffe : une boule sombre recouverte d'écailles de feuilles en couronnes, du sommet vers le bas
function cluster(gb, r, c, rad, n, cols, o = {}) {
  if (!o.lobes) return clump(gb, r, c, rad, cols, o, 1, 1);
  // feuillage d'arbre : un lobe principal et 2 à 3 lobes plus petits décalés, pour une silhouette bosselée plutôt qu'une boule
  puff(gb, r, c, rad * 0.95, cols, o);
  const nl = 2 + (r() * 2 | 0), a0 = r() * 6.28;
  for (let i = 0; i < nl; i++) { const a = a0 + i / nl * 6.2832 + (r() - 0.5) * 0.8, up = (r() - 0.35) * 0.5, d = rad * (0.5 + r() * 0.2);
    puff(gb, r, new V3(c.x + Math.cos(a) * d, c.y + up * rad, c.z + Math.sin(a) * d), rad * (0.55 + r() * 0.14), cols, o); }
}
// touffe d'arbre dans le style des sapins : 3 dômes empilés à bord dentelé, plus clairs vers le haut
function puff(gb, r, c, rad, cols, o) {
  const fy = o.flat || 1, C = cols.map(lin), f = gb.wf, up = new V3(0, 1, 0), dn = new V3(0, -1, 0);
  const tiers = [[-0.45, 1.0, 0.5, 0.62], [-0.05, 0.86, 0.5, 0.82], [0.3, 0.6, 0.48, 1.0]], n = 8;
  for (let ti = 0; ti < tiers.length; ti++) {
    const [yo, rs, hs, br] = tiers[ti], R = rad * rs, h = rad * hs * fy, y = c.y + yo * rad * fy, a0 = r() * 6.28;
    const base = C[(r() * C.length) | 0], cTop = base.clone().multiplyScalar(br * 1.18), cEdge = base.clone().multiplyScalar(br * 0.92);
    const apex = new V3(c.x + (r() - 0.5) * R * 0.15, y + h, c.z + (r() - 0.5) * R * 0.15), und = new V3(c.x, y + h * 0.2, c.z), pts = [];
    for (let j = 0; j < n * 2; j++) { const an = a0 + j / (n * 2) * 6.2832 + (r() - 0.5) * 0.14, rr = (j % 2 ? 0.74 : 1) * R * (0.9 + r() * 0.2);
      pts.push({ p: new V3(c.x + Math.cos(an) * rr, y + (j % 2 ? 0.08 : -0.14) * R * fy, c.z + Math.sin(an) * rr), n: new V3(Math.cos(an) * 0.8, 0.6, Math.sin(an) * 0.8).normalize(), c: j % 2 ? cEdge.clone().multiplyScalar(0.86) : cEdge }); }
    if (LOW) { // au loin : une dent sur deux et un cône simple (même silhouette, 4 fois moins de triangles)
      const q = pts.filter((_, j) => j % 2 === 0), m = q.length;
      for (let j = 0; j < m; j++) { const P1 = q[j], P2 = q[(j + 1) % m]; gb.triN(apex, P1.p, P2.p, cTop, P1.c, P2.c, up, P1.n, P2.n, f * 0.8, f * 1.2, f * 1.2); gb.triN(und, P2.p, P1.p, base.clone().multiplyScalar(0.42), P2.c.clone().multiplyScalar(0.55), P1.c.clone().multiplyScalar(0.55), dn, P2.n, P1.n, f * 0.8, f * 1.2, f * 1.2); }
      continue;
    }
    // anneau intermédiaire : la touffe devient un dôme arrondi plutôt qu'un cône
    const mid = pts.map(P => ({ p: new V3(lerp(apex.x, P.p.x, 0.62), y + h * 0.78, lerp(apex.z, P.p.z, 0.62)), n: new V3(P.n.x * 0.5, 0.86, P.n.z * 0.5).normalize(), c: cTop.clone().lerp(P.c, 0.45) }));
    for (let j = 0; j < n * 2; j++) { const k = (j + 1) % (n * 2), P1 = pts[j], P2 = pts[k], M1 = mid[j], M2 = mid[k];
      gb.triN(apex, M1.p, M2.p, cTop, M1.c, M2.c, up, M1.n, M2.n, f * 0.8, f, f);
      gb.triN(M1.p, P1.p, P2.p, M1.c, P1.c, P2.c, M1.n, P1.n, P2.n, f, f * 1.2, f * 1.2); gb.triN(M1.p, P2.p, M2.p, M1.c, P2.c, M2.c, M1.n, P2.n, M2.n, f, f * 1.2, f);
      gb.triN(und, P2.p, P1.p, base.clone().multiplyScalar(0.42), P2.c.clone().multiplyScalar(0.55), P1.c.clone().multiplyScalar(0.55), dn, P2.n, P1.n, f * 0.8, f * 1.2, f * 1.2); }
  }
}
function clump(gb, r, c, rad, cols, o, q, ls) {
  const fy = o.flat || 1, C = cols.map(lin), f = gb.wf;
  gb.add(SPH, C[0].clone().multiplyScalar(o.lobes ? 0.68 : 0.55), M(c.x, c.y - rad * 0.05, c.z, rad * 0.8, rad * 0.76 * fy, rad * 0.8, 0, r() * 3, 0), 0.55);
  const rings = [[0.96, 3], [0.74, 6], [0.46, 9], [0.16, 11], [-0.16, 11], [-0.48, 9]];
  for (const [y0, n0] of rings) {
    const cnt = Math.max(2, Math.round(n0 * q)), a0 = r() * 6.28;
    for (let k = 0; k < cnt; k++) {
      const a = a0 + k / cnt * 6.2832 + (r() - 0.5) * 0.45, yy = clamp(y0 + (r() - 0.5) * 0.16, -0.8, 0.98), rr = Math.sqrt(1 - yy * yy);
      const v = new V3(Math.cos(a) * rr, yy * fy, Math.sin(a) * rr).normalize(), t = new V3(0, -1, 0).addScaledVector(v, v.y);
      if (t.lengthSq() < 0.02) t.set(Math.cos(a), 0, Math.sin(a)); t.normalize();
      const dir = v.clone().multiplyScalar(0.55).addScaledVector(t, 0.85 + (o.droop || 0)).normalize(), ln = v.clone().addScaledVector(dir, -v.dot(dir)).normalize();
      const p = c.clone().addScaledVector(v, rad * 0.5), col = C[(r() * C.length) | 0], br = 0.7 + 0.45 * (yy * 0.5 + 0.5);
      const sn = v.clone().multiplyScalar(0.75).add(new V3(0, 0.4, 0)).normalize();
      cleaf(gb, p, dir, ln, rad * 0.8 * ls * (o.ll || 1) * (0.85 + r() * 0.3), rad * 0.6 * ls * (o.lw || 1) * (0.85 + r() * 0.3), col.clone().multiplyScalar(br * 0.68), col.clone().multiplyScalar(br * 1.12), sn, f * 0.8, f * 1.2);
    }
  }
}
// palme cartoon : large limbe plié en V, bord dentelé en dents de scie tournées vers la pointe
function palmLeaf(gb, r, o, yaw, len, wid, pitch0, droop, cA, cB, teeth, fold) {
  gb.wp = r(); const fx = gb.wf, fw = new V3(Math.cos(yaw), 0, Math.sin(yaw)), side = new V3(-fw.z, 0, fw.x);
  const NS = 40, S = [], T = []; let p = o.clone();
  for (let i = 0; i <= NS; i++) { const t = i / NS, pitch = pitch0 - droop * Math.pow(t, 1.25), d = new V3(fw.x * Math.cos(pitch), Math.sin(pitch), fw.z * Math.cos(pitch)); S.push(p.clone()); T.push(d); p = p.clone().addScaledVector(d, len / NS); }
  const at = t => { const u0 = clamp(t, 0, 1) * NS, i = Math.min(NS - 1, u0 | 0), u = u0 - i; return [S[i].clone().lerp(S[i + 1], u), T[i].clone().lerp(T[i + 1], u).normalize()]; };
  const wf = t => wid * Math.pow(Math.sin(Math.PI * clamp(t * 0.96 + 0.04, 0, 1)), 0.55);
  const K = teeth * 2 + 2, a = lin(cA), b = lin(cB), rib = b.clone().lerp(new THREE.Color(1, 1, 0.75), 0.3);
  const st = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K, [c, d] = at(t), up = new V3().crossVectors(side, d).normalize(); if (up.y < 0) up.negate();
    const inner = k > 0 && k < K && k % 2 === 1, te = Math.min(1, t + (inner ? 0 : 0.7 / K)), e = {};
    for (const sg of [1, -1]) { const [ce, de] = at(te), up2 = new V3().crossVectors(side, de).normalize(); if (up2.y < 0) up2.negate(); const w = wf(te) * (inner ? 0.42 : 1) * (sg > 0 ? 1 : 0.94); e[sg] = ce.addScaledVector(side, sg * w).addScaledVector(up2, -w * fold); }
    const col = a.clone().lerp(b, t * 0.7);
    st.push({ c, e, t, col, ce: col.clone().multiplyScalar(inner ? 0.72 : 0.92), up, f: fx * Math.pow(t, 1.3) });
  }
  for (let k = 0; k < K; k++) {
    const A = st[k], B = st[k + 1];
    for (const sg of [1, -1]) {
      const nA = A.up.clone().addScaledVector(side, sg * fold * 0.9).normalize(), nB = B.up.clone().addScaledVector(side, sg * fold * 0.9).normalize(), sh = sg > 0 ? 1 : 0.86;
      const cA2 = A.col.clone().multiplyScalar(sh), cB2 = B.col.clone().multiplyScalar(sh), rA = rib.clone().multiplyScalar(sh), rB = rib.clone().multiplyScalar(sh);
      gb.triN(A.c, B.c, B.e[sg], rA, rB, B.ce.clone().multiplyScalar(sh), nA, nB, nB, A.f, B.f, B.f * 1.15);
      gb.triN(A.c, B.e[sg], A.e[sg], cA2, B.ce.clone().multiplyScalar(sh), A.ce.clone().multiplyScalar(sh), nA, nB, nA, A.f, B.f * 1.15, A.f * 1.15);
    }
  }
  gb.wf = fx;
}
// étage de sapin cartoon : jupe conique à bord dentelé
function skirt(gb, r, y, R, h, n, cA, cB, f) {
  const apex = new V3(0, y + h, 0), und = new V3(0, y + h * 0.3, 0), m = n * 2, a0 = r() * 6.28, pts = [], a = lin(cA), b = lin(cB), up = new V3(0, 1, 0), dn = new V3(0, -1, 0);
  for (let j = 0; j < m; j++) { const an = a0 + j / m * 6.2832 + (r() - 0.5) * 0.12, rr = (j % 2 ? 0.7 : 1) * R * (0.92 + r() * 0.16); pts.push({ p: new V3(Math.cos(an) * rr, y + (j % 2 ? 0.1 : -0.12) * R, Math.sin(an) * rr), n: new V3(Math.cos(an) * 0.75, 0.65, Math.sin(an) * 0.75).normalize(), c: a.clone().multiplyScalar(j % 2 ? 0.8 : 1) }); }
  for (let j = 0; j < m; j++) { const P1 = pts[j], P2 = pts[(j + 1) % m]; gb.triN(apex, P1.p, P2.p, b, P1.c, P2.c, up, P1.n, P2.n, f * 0.6, f, f); gb.triN(und, P2.p, P1.p, a.clone().multiplyScalar(0.45), P2.c.clone().multiplyScalar(0.6), P1.c.clone().multiplyScalar(0.6), dn, P2.n, P1.n, f * 0.6, f, f); }
}
// arbre ramifié : tronc, branches, puis bouquets aux extrémités
function growTree(gb, r, P) {
  const tips = [];
  const rec = (a, dir, len, rad, depth) => {
    if (depth === 1) gb.wp = r();
    const segs = depth === 0 ? (P.segs || 3) + 2 : 3; let p = a.clone(), d = dir.clone(); const pts = [p.clone()], f = depth === 0 ? 0 : 0.1 * depth;
    for (let s = 0; s < segs; s++) { d.x += (r() - 0.5) * P.wob * 0.7; d.z += (r() - 0.5) * P.wob * 0.7; d.y += P.up * (depth ? 1 : 0.3); d.normalize(); p = p.clone().addScaledVector(d, len / segs); pts.push(p.clone()); }
    gb.wf = f; const r1 = rad * 0.7;
    tube(gb, pts, i => lerp(rad, r1, i / segs) * (depth === 0 && i === 0 ? (P.flare || 1.5) : depth === 0 && i === 1 ? 1.12 : 1), P.bark, depth === 0 ? 12 : depth === 1 ? 8 : 6, 0.2);
    gb.add(SPHL, P.bark, M(p.x, p.y, p.z, r1 * 1.02), 0.3, 0.2);
    if (depth >= P.kids.length) { tips.push({ p, ph: gb.wp, k: 1 }); return; }
    if (depth >= 1 && P.inner !== false) tips.push({ p: p.clone(), ph: gb.wp, k: 0.8 });
    const n = P.kids[depth], a0 = r() * 6.28, u = new V3(1, 0, 0); if (Math.abs(d.x) > 0.9) u.set(0, 0, 1); u.cross(d).normalize(); const v = new V3().crossVectors(d, u);
    for (let k = 0; k < n; k++) {
      const az = a0 + k / n * 6.2832 + (r() - 0.5) * 0.7, sp = P.spread * (0.75 + r() * 0.5);
      rec(p, d.clone().multiplyScalar(Math.cos(sp)).addScaledVector(u, Math.cos(az) * Math.sin(sp)).addScaledVector(v, Math.sin(az) * Math.sin(sp)), len * P.lenK * (0.8 + r() * 0.4), rad * 0.7 * Math.max(P.radK, 0.72), depth + 1);
    }
    if (P.leader && depth === 0) rec(p, d, len * 0.5, rad * 0.68, depth + 1);
  };
  rec(new V3(0, -0.25, 0), new V3((r() - 0.5) * 0.2, 1, (r() - 0.5) * 0.2).normalize(), P.len, P.rad, 0);
  return tips;
}
function leafyTree(r, P, fruits) {
  const g = new GB(), tips = growTree(g, r, P), nl = Math.round(P.leaves * (LOW ? 0.65 : 1));
  for (const t of tips) {
    g.wp = t.ph; g.wf = 0.55; const rad = P.cr * (0.8 + r() * 0.45) * t.k, c = t.p.clone(); c.y += rad * 0.2;
    cluster(g, r, c, rad, nl, P.cols, Object.assign({ lobes: true }, P.co)); (g.cl || (g.cl = [])).push({ c, rad, k: t.k });
    if (P.extra) P.extra(g, r, c, rad);
    if (fruits) for (let k = 0; k < (P.nf || 2); k++) { const a = r() * 6.28, y = -0.2 - r() * 0.6, rr = Math.sqrt(1 - y * y), fp = new V3(c.x + Math.cos(a) * rr * rad * 0.98, c.y + y * rad * 0.92, c.z + Math.sin(a) * rr * rad * 0.98); fp.ph = t.ph; fruits.push(fp); }
  }
  return g;
}

/* ---------- espèces ---------- */
function gPalm(r, o = {}) {
  const Ht = o.h || 7.6, bend = o.bend === undefined ? 2.3 : o.bend, sw = o.s || 0, sd = o.side || 0, g = new GB(), ns = LOW ? 7 : Math.round(10 * Ht / 7.6), la = 0.6, pts = [], rads = [], cols = [];
  // tronc : courbe simple, très penchée, ou en S (on varie les silhouettes)
  const P0 = t => { const a = bend * t * t + sw * Math.sin(t * Math.PI * 1.6), b = sd * Math.sin(t * Math.PI); return new V3(Math.cos(la) * a - Math.sin(la) * b, Ht * t * (1 - 0.18 * Math.abs(bend) / 6) - 0.3, Math.sin(la) * a + Math.cos(la) * b); };
  for (let sI = 0; sI < ns; sI++) {
    const t0 = sI / ns, t1 = (sI + 1) / ns, rb = lerp(0.34, 0.2, t0) * (sI === 0 ? 1.18 : 1), dk = sI % 2 ? '#7a5636' : '#704e31';
    pts.push(P0(t0 + 0.004), P0(lerp(t0, t1, 0.5)), P0(t1 - 0.01)); rads.push(rb * 0.93, rb, rb * 1.13); cols.push(dk, '#86603d', '#9a7249');
  }
  tube(g, pts, i => rads[i], i => cols[i], 14, 0.08, () => 0);
  const top = P0(1);
  g.add(SPH, '#6a4a2c', M(top.x, top.y - 0.05, top.z, 0.3, 0.42, 0.3), 0.4, 0.1);
  g.wf = 1; const nf = 12;
  for (let i = 0; i < nf; i++) { const tier = i % 2; palmLeaf(g, r, top, i / nf * 6.2832 + r() * 0.3, 3.8 + r() * 0.7, 0.8 + r() * 0.15, 0.75 - tier * 0.35 + r() * 0.15, 1.9 + r() * 0.4, tier ? '#3d8f2a' : '#47a030', '#8fd04a', LOW ? 6 : 9, 0.32); }
  for (let i = 0; i < 4; i++) palmLeaf(g, r, top.clone().add(new V3(0, 0.1, 0)), i * 1.57 + 0.6, 2.0, 0.42, 1.25, 1.1, '#5cb03a', '#a6dc5a', 6, 0.3);
  g.wf = 0.2; g.wp = 0; for (let i = 0; i < 5; i++) g.add(SPH, i % 2 ? '#cdb48a' : '#bfa274', M(top.x + Math.cos(i * 1.3) * 0.3, top.y - 0.35 - (i % 2) * 0.12, top.z + Math.sin(i * 1.3) * 0.3, 0.2, 0.22, 0.2), 0.45, 0.05);
  return g.build();
}
const BARK = { apple: '#6e5a48', cherry: '#4d3532', citrus: '#6a5a44', jungle: '#5d4c3c', frang: '#9a9184' };
function gApple(r, fr) { return leafyTree(r, { len: 1.8, rad: 0.3, segs: 3, wob: 0.5, up: 0.05, kids: [3, 2], spread: 0.85, lenK: 0.66, radK: 0.6, bark: BARK.apple, cr: 1.35, leaves: 11, flare: 1.7, cols: ['#4f9a32', '#66b03a', '#80c444', '#3f8530'], leader: true, nf: 2 }, fr).build(); }
function gCherry(r, fr) { return leafyTree(r, { len: 2.0, rad: 0.24, segs: 3, wob: 0.45, up: 0.08, kids: [4, 2], spread: 0.8, lenK: 0.64, radK: 0.6, bark: BARK.cherry, cr: 1.2, leaves: 11, flare: 1.6, cols: ['#e88aa8', '#f3a8c0', '#f8c6d6', '#fbdbe5'], co: { ll: 0.85, lw: 0.75 }, leader: true, nf: 2 }, fr).build(); }
function gOrange(r, fr) {
  return leafyTree(r, { len: 1.2, rad: 0.24, segs: 2, wob: 0.35, up: 0.1, kids: [4, 2], spread: 0.8, lenK: 0.62, radK: 0.6, bark: BARK.citrus, cr: 1.3, flare: 1.6, leaves: 17, cols: ['#237a38', '#2f8f42', '#3ea348', '#1c6a32'], co: { ll: 0.9, lw: 0.6 }, leader: true, nf: 2,
    extra: (g, rr, c, rad) => { for (let i = 0; i < 3; i++) { const a = rr() * 6.28, y = rr() * 0.9; g.add(ICO0, '#fffdf2', M(c.x + Math.cos(a) * rad * 0.6, c.y + y * rad * 0.6, c.z + Math.sin(a) * rad * 0.6, 0.05), 0); } } }, fr).build();
}
function gLemon(r, fr) { return leafyTree(r, { len: 1.6, rad: 0.3, segs: 3, wob: 0.6, up: 0.06, kids: [3, 2], spread: 0.9, lenK: 0.68, radK: 0.6, bark: '#7d6c50', cr: 1.5, flare: 1.7, leaves: 17, cols: ['#6f9a42', '#86ad4b', '#9abf55', '#5c873a'], leader: true, nf: 3 }, fr).build(); }
function gJungle(r) {
  const P = { len: 7.5, rad: 0.62, segs: 4, wob: 0.25, up: 0.02, kids: [4, 3], spread: 0.9, lenK: 0.52, radK: 0.6, bark: BARK.jungle, cr: 3.1, leaves: 6, cols: ['#2f8a3a', '#3c9c42', '#52b04a', '#287a36'], co: { flat: 0.78 }, leader: true, flare: 1.15 };
  const g = leafyTree(r, P);
  g.wf = 0; for (let i = 0; i < 5; i++) { const a = i * 1.257 + 0.3; g.add(new THREE.ConeGeometry(0.4, 2.8, 5, 1, true), BARK.jungle, M(Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55, 1, 1, 0.45, Math.sin(a) * -0.28, -a, Math.cos(a) * 0.28), 0.3, 0.2); }
  // lianes : chacune accrochée sous une touffe de feuillage (cachée dans le bas de la touffe)
  const top = g.cl.filter(q => q.k === 1);
  for (let i = 0; i < 7; i++) { g.wf = 0.9; g.wp = r(); const cl = top[(i * 3) % top.length], a = r() * 6.28, d = cl.rad * (0.15 + 0.3 * r()), x = cl.c.x + Math.cos(a) * d, z = cl.c.z + Math.sin(a) * d, y0 = cl.c.y - cl.rad * 0.25, L = 2.5 + r() * 3.5; const vt = new V3(x, y0, z), vb = new V3(x + r() * 0.3, y0 - L, z + r() * 0.3); limb(g, vt, vb, 0.03, 0.02, '#5d7d3c', 3, 0); for (let k = 0; k < 3; k++) leaf(g, vt.clone().lerp(vb, 0.4 + k * 0.3), new V3(r() - 0.5, -0.6, r() - 0.5).normalize(), 0.4, 0.2, lin('#4a7a38'), lin('#6f9a48')); }
  return g.build();
}
function gFrangi(r) {
  return leafyTree(r, { len: 1.6, rad: 0.24, segs: 2, wob: 0.4, up: 0.05, kids: [3, 2], spread: 0.75, lenK: 0.75, radK: 0.68, bark: BARK.frang, cr: 1.1, leaves: 11, cols: ['#4f9440', '#5fa548', '#3f8238'], co: { ll: 1.15, lw: 0.6 },
    extra: (g, rr, c, rad) => { for (let i = 0; i < 2; i++) { const a = rr() * 6.28, cx = c.x + Math.cos(a) * rad * 0.35, cz = c.z + Math.sin(a) * rad * 0.35, cy = c.y + rad * 0.45; for (let k = 0; k < 5; k++) { const b = k * 1.2566; leaf(g, new V3(cx, cy, cz), new V3(Math.cos(b), 0.35, Math.sin(b)).normalize(), 0.13, 0.09, lin('#ffe9a0'), lin('#ffffff')); } } } }).build();
}
function gPine(r) {
  const g = new GB(), Ht = 9.5, nt = 7;
  tube(g, [new V3(0, -0.3, 0), new V3(0.04, Ht * 0.4, 0), new V3(0, Ht * 0.85, 0)], i => [0.3, 0.2, 0.08][i], '#6a4a34', 9, 0.15, () => 0);
  for (let w = 0; w < nt; w++) { const t = w / (nt - 1); g.wp = r(); skirt(g, r, 1.6 + t * (Ht - 3.0), lerp(2.6, 0.75, t), lerp(2.6, 1.7, t), 11, t < 0.5 ? '#2a6a42' : '#317a48', '#62a85a', 0.25 + t * 0.6); }
  return g.build();
}
function gTreeFern(r) {
  const g = new GB(), top = new V3(0.3, 3.3, 0.1);
  tube(g, [new V3(0, -0.2, 0), new V3(0.18, 1.7, 0), top], i => [0.22, 0.17, 0.2][i], '#4a3828', 9, 0.3, () => 0);
  g.wf = 0.9;
  for (let i = 0; i < 13; i++) palmLeaf(g, r, top, i / 13 * 6.2832 + r() * 0.25, 2.5 + r() * 0.5, 0.42, 0.8 - (i % 2) * 0.35, 1.7, '#2f7a38', '#86c050', LOW ? 7 : 12, 0.18);
  for (let i = 0; i < 3; i++) palmLeaf(g, r, top, i * 2.1, 0.9, 0.18, 1.4, 0.4, '#8fc05a', '#c9e47e', 4, 0.2);
  return g.build();
}
function gFern(r, cA, cB, nf, len) {
  const g = new GB(), o = new V3(0, 0.03, 0), L = { len: len * 0.24, wid: len * 0.085, sweep: 0.32, droop: 0.3, pow: 0.7, tri: 1 }; g.wf = 1; nf = LOW ? nf : nf + 5;
  for (let i = 0; i < nf; i++) frond(g, r, o, i / nf * 6.2832 + r() * 0.4, len * (0.75 + r() * 0.5), 1.1 - r() * 0.35, 1.7 + r() * 0.35, LOW ? 6 : 10, L, cA, cB);
  for (let i = 0; i < 2; i++) frond(g, r, o, i * 3 + 1, len * 0.45, 1.45, 0.5, 4, { len: len * 0.1, wid: len * 0.06, sweep: 0.3, droop: 0.1 }, cB, '#cfe48a');
  return g.build();
}
function gBanana(r) {
  const g = new GB(), top = new V3(0.1, 2.3, 0);
  // faux-tronc : évasé à la base, fait de gaines de feuilles superposées, avec quelques feuilles sèches qui pendent
  const tp = [], tr = [], tc = [];
  for (let k = 0; k <= 6; k++) { const t = k / 6; tp.push(new V3(0.1 * t * t + (k === 0 ? 0 : (r() - 0.5) * 0.02), -0.15 + t * 2.45, 0)); tr.push(lerp(0.2, 0.1, Math.pow(t, 0.8)) * (k === 0 ? 1.3 : 1)); tc.push(k % 2 ? '#7c8c48' : '#8f9e55'); }
  g.wf = 0; tube(g, tp, i => tr[i], i => tc[i], 10, 0.05, i => i / 6 * 0.25);
  for (let k = 0; k < 5; k++) { const t = 0.08 + k * 0.17, y = -0.15 + t * 2.45, rr = lerp(0.2, 0.1, Math.pow(t, 0.8)) + 0.018, x = 0.1 * t * t;
    g.wf = t * 0.25; g.add(new THREE.CylinderGeometry(rr * 0.97, rr * 1.12, 0.36, 10, 1, true), k % 2 ? '#9a8f55' : '#a7a060', M(x, y + 0.1, 0, 1, 1, 1, 0, r() * 6.28, 0), 0.35, 0.03); // bord de gaine
    g.add(new THREE.CylinderGeometry(rr * 1.12, rr * 1.0, 0.03, 10, 1, true), '#7d7744', M(x, y - 0.1, 0), 0.4, 0); } // ourlet sombre sous la gaine
  g.wf = 0.5; const pfd = t => Math.pow(Math.sin(Math.PI * (0.06 + 0.92 * t)), 0.6) * 0.7;
  for (let i = 0; i < 2; i++) blade(g, r, new V3(0.05, 1.1 + i * 0.35, 0), i * 3.1 + r(), 1.3, 0.22, -0.9, 0.5, 5, '#7a5a30', '#a8844e', pfd);
  g.wf = 1; const pf = t => Math.pow(Math.sin(Math.PI * (0.06 + 0.92 * t)), 0.45);
  for (let i = 0; i < 8; i++) blade(g, r, top, i / 8 * 6.2832 + r() * 0.5, 2.3 + r() * 0.7, 0.42, 1.15 - (i % 3) * 0.3, 1.5 + r() * 0.4, 8, '#3f7f3c', '#7fb04a', pf);
  blade(g, r, top, 1, 1.4, 0.16, 1.5, 0.2, 5, '#8fbf55', '#b8d870', pf);
  return g.build();
}
function gBamboo(r) {
  const g = new GB();
  for (let k = 0; k < 7; k++) {
    g.wp = r(); const a = r() * 6.28, d = r() * 0.8; let p = new V3(Math.cos(a) * d, -0.1, Math.sin(a) * d); const lx = (r() - 0.5) * 0.2, lz = (r() - 0.5) * 0.2, hh = 5 + r() * 3;
    for (let s = 0; s < 7; s++) { g.wf = s * 0.05; const q = new V3(p.x + lx * (s + 1) * 0.35, p.y + hh / 7, p.z + lz * (s + 1) * 0.35); limb(g, p, q, 0.058 - s * 0.004, 0.05 - s * 0.004, s % 2 ? '#8fa04c' : '#7d9242', 5, 0.08); p = q;
      if (s > 1) { g.wf = 0.7; for (let i = 0; i < 9; i++) { const b = r() * 6.28; leaf(g, q, new V3(Math.cos(b), -0.15 + r() * 0.5, Math.sin(b)).normalize(), 0.55 + r() * 0.3, 0.09, lin('#557f3a'), lin('#8fb055'), 0.3, 1); } } }
  }
  return g.build();
}
function gBroad(r) {
  const g = new GB(), pf = t => t < 0.18 ? t / 0.18 : Math.pow(1 - (t - 0.18) / 0.82, 0.75);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.2832 + r() * 0.5, d = 0.3 + r() * 0.3, hh = 0.45 + r() * 0.55, tip = new V3(Math.cos(a) * d, hh, Math.sin(a) * d);
    g.wf = 0.3; limb(g, new V3(0, 0, 0), tip, 0.028, 0.018, '#5c8a45', 4, 0);
    g.wf = 1; blade(g, r, tip, a, 0.6 + r() * 0.35, 0.3, 0.25, 0.9, 5, i % 2 ? '#2f7545' : '#3f8a4f', '#5fa55a', pf);
  }
  return g.build();
}
function gShrub(r, cols, k = 1) { // buisson cartoon : quelques touffes serrées au ras du sol
  const g = new GB(); g.wf = 0.4; const n = 4 + (r() * 2 | 0);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = i ? 0.35 + r() * 0.35 : 0, rad = (0.5 + r() * 0.3) * k; g.wp = r(); puff(g, r, new V3(Math.cos(a) * d * k, rad * 0.75 + r() * 0.25, Math.sin(a) * d * k), rad, cols, { flat: 0.85 }); }
  return g.build();
}
function gBush(r, fr) {
  const P = { len: 0.35, rad: 0.06, segs: 1, wob: 0.4, up: 0.1, kids: [4, 2], spread: 1.0, lenK: 0.9, radK: 0.6, bark: '#5a4a38', cr: 0.5, leaves: 6, cols: ['#447a3c', '#528c42', '#386a34'], co: { ll: 1.0, lw: 0.6 }, nf: 2, flare: 1 };
  const g = new GB(), tips = growTree(g, r, P);
  for (const t of tips) { g.wp = t.ph; g.wf = 0.6; const rad = P.cr * (0.8 + r() * 0.5); puff(g, r, t.p, rad, P.cols, P.co); for (let k = 0; k < 2; k++) { const a = r() * 6.28; const fp = new V3(t.p.x + Math.cos(a) * rad * 0.5, t.p.y + rad * (0.1 + r() * 0.4), t.p.z + Math.sin(a) * rad * 0.5); fp.ph = t.ph; fr.push(fp); } }
  return g.build();
}
function gHibiscus(r) {
  const g = new GB();
  [[0, 0, 0.66], [0.24, 0.12, 0.48], [-0.2, -0.16, 0.54]].forEach((f, k) => {
    g.wp = r(); g.wf = 0.4; limb(g, new V3(f[0] * 0.3, 0, f[1] * 0.3), new V3(f[0], f[2], f[1]), 0.016, 0.012, '#4f7f3c', 4, 0); g.wf = 1;
    const c = new V3(f[0], f[2], f[1]), c1 = lin(k === 1 ? '#f2748a' : '#d93a52'), c2 = lin(k === 1 ? '#ffa2b0' : '#f0607a');
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + k; leaf(g, c, new V3(Math.cos(a), 0.45, Math.sin(a)).normalize(), 0.15, 0.13, c1, c2); }
    g.add(ICO0, '#ffd84a', M(f[0], f[2] + 0.07, f[1], 0.018, 0.06, 0.018), 0);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + k; leaf(g, new V3(f[0] * (0.4 + i * 0.2), f[2] * (0.3 + i * 0.2), f[1] * (0.4 + i * 0.2)), new V3(Math.cos(a), 0.3, Math.sin(a)).normalize(), 0.2, 0.11, lin('#3a7038'), lin('#5a9048')); }
  });
  return g.build();
}
function gDaisy(r) {
  const g = new GB(), w = lin('#ffffff'), w2 = lin('#f1efe2');
  for (let k = 0; k < 4; k++) {
    g.wp = r(); const x = (r() - 0.5) * 0.55, z = (r() - 0.5) * 0.55, hh = 0.2 + r() * 0.2, c = new V3(x, hh, z);
    g.wf = 0.5; limb(g, new V3(x, 0, z), c, 0.01, 0.008, '#5a8f45', 3, 0); g.wf = 1;
    for (let i = 0; i < 7; i++) { const a = i * 0.898; leaf(g, c, new V3(Math.cos(a), 0.12, Math.sin(a)).normalize(), 0.07, 0.035, w2, w); }
    g.add(ICO0, '#f2c230', M(x, hh + 0.012, z, 0.022, 0.014, 0.022), 0);
  }
  return g.build();
}
function gLupin(r) {
  const g = new GB();
  for (let k = 0; k < 3; k++) {
    g.wp = r(); const x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, hh = 0.3 + r() * 0.15;
    g.wf = 0.4; limb(g, new V3(x, 0, z), new V3(x, hh + 0.45, z), 0.013, 0.006, '#5a8f45', 4, 0);
    for (let i = 0; i < 5; i++) { const a = i * 1.26; leaf(g, new V3(x, hh * 0.5, z), new V3(Math.cos(a), 0.5, Math.sin(a)).normalize(), 0.16, 0.05, lin('#4a8040'), lin('#6a9f50')); }
    g.wf = 1; for (let i = 0; i < 8; i++) for (let q = 0; q < 3; q++) { const a = i * 0.9 + q * 2.1; leaf(g, new V3(x, hh + i * 0.055, z), new V3(Math.cos(a), 0.5, Math.sin(a)).normalize(), 0.06 - i * 0.005, 0.04, lin((i + q) % 2 ? '#6f55c8' : '#8f72de'), lin('#b9a2f2')); }
  }
  return g.build();
}
function gGrass(r, dry) {
  const g = new GB(), nb = LOW ? 9 : 14;
  for (let i = 0; i < nb; i++) {
    g.wp = r() * 0.25; const a = r() * 6.28, d = r() * 0.3, bx = Math.cos(a) * d, bz = Math.sin(a) * d, hh = 0.2 + r() * 0.36, w = 0.02 + r() * 0.016, lean = 0.03 + r() * 0.07;
    const sa = a + 1.57 + (r() - 0.5), sx = Math.cos(sa) * w, sz = Math.sin(sa) * w, dx = Math.cos(a), dz = Math.sin(a);
    const isDry = r() < (dry ? 0.75 : 0.1), c0 = lin(isDry ? '#a8973f' : '#3c8a26'), c1 = lin(isDry ? '#d2bd50' : '#6fb234'), c2 = lin(isDry ? '#eedc78' : '#b4dc50');
    const mx = bx + dx * lean * 0.3, mz = bz + dz * lean * 0.3, my = hh * 0.55;
    g.tri(new V3(bx - sx, 0, bz - sz), new V3(bx + sx, 0, bz + sz), new V3(mx + sx * 0.8, my, mz + sz * 0.8), c0, c0, c1, 0, 0, 0.3);
    g.tri(new V3(mx - sx * 0.8, my, mz - sz * 0.8), new V3(mx + sx * 0.8, my, mz + sz * 0.8), new V3(bx + dx * lean, hh, bz + dz * lean), c1, c1, c2, 0.3, 0.3, 1);
    g.tri(new V3(bx - sx, 0, bz - sz), new V3(mx + sx * 0.8, my, mz + sz * 0.8), new V3(mx - sx * 0.8, my, mz - sz * 0.8), c0, c1, c1, 0, 0.3, 0.3);
  }
  return g.build();
}
function gRock(seed, det = 2) {
  const g = new THREE.IcosahedronGeometry(1, det), P = g.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2];
    let s = 0.62 + 0.55 * fbm(x * 1.1 + seed * 7.3 + y * 0.9, z * 1.1 + seed * 3.1 - y * 0.7, 3) + 0.1 * vnoise(x * 5 + seed, z * 5 + y * 4);
    s *= 1 - 0.1 * Math.abs(Math.sin(y * 7 + seed));            // strates
    const fl = Math.max(Math.abs(x), Math.abs(z)); if (fl > 0.72) s *= 1 - (fl - 0.72) * 0.5;   // pans coupés
    P[i] = x * s; P[i + 1] = y * s * 0.74; P[i + 2] = z * s; }
  g.computeVertexNormals();
  const gb = new GB(); gb.add(g, '#8a8078', M(0, 0.22, 0), 0.55, 0.12); return gb.build();
}
// coquillage en spirale (turritelle) : anneaux décroissants enroulés
function gShell() {
  const g = new GB();
  for (let i = 0; i < 8; i++) { const t = i / 7, rad = lerp(0.036, 0.007, Math.pow(t, 0.8)); g.add(SPHL, i % 2 ? '#f1dccb' : '#d9a98f', M(0.07 - t * 0.17, 0.034 - t * 0.012 + (i % 2) * 0.002, (i % 2 ? 0.004 : -0.004), rad, rad, rad * 1.05, 0, 0, 0.3), 0.3, 0.06); }
  g.add(SPHL, '#4f3a34', M(0.088, 0.03, 0.014, 0.018, 0.024, 0.02), 0.2);
  return g.build();
}
// coquille Saint-Jacques : éventail à côtes
function gScallop() {
  const g = new GB(), n = 11, c0 = lin('#f6e3d2'), c1 = lin('#eab79c'), c2 = lin('#d98f78');
  const o = new V3(0, 0.012, -0.07);
  for (let i = 0; i < n; i++) {
    const a0 = lerp(-1.15, 1.15, i / n), a1 = lerp(-1.15, 1.15, (i + 1) / n), am = (a0 + a1) / 2, R = 0.16 * (0.9 + 0.1 * Math.cos(am * 1.3));
    const p0 = new V3(Math.sin(a0) * R, 0.012, -0.07 + Math.cos(a0) * R), p1 = new V3(Math.sin(a1) * R, 0.012, -0.07 + Math.cos(a1) * R), pm = new V3(Math.sin(am) * R * 1.03, 0.04, -0.07 + Math.cos(am) * R * 1.03), mm = new V3(Math.sin(am) * R * 0.5, 0.05, -0.07 + Math.cos(am) * R * 0.5);
    g.tri(o, p0, mm, c2, c1, c0); g.tri(o, mm, p1, c2, c0, c1); g.tri(p0, pm, mm, c1, c0, c0); g.tri(pm, p1, mm, c0, c1, c0);
  }
  g.add(new THREE.BoxGeometry(0.09, 0.016, 0.03), '#e2b79f', M(0, 0.014, -0.075), 0.2);
  return g.build();
}
function gStar() {
  const g = new GB();
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.add(new THREE.ConeGeometry(0.052, 0.2, 6), '#e07a3c', M(Math.cos(a) * 0.105, 0.028, Math.sin(a) * 0.105, 1, 1, 0.6, Math.PI / 2, 0, -a + Math.PI / 2), 0.2, 0.08); for (let k = 0; k < 3; k++) g.add(ICO0, '#f7c08a', M(Math.cos(a) * (0.05 + k * 0.045), 0.05 - k * 0.006, Math.sin(a) * (0.05 + k * 0.045), 0.009), 0); }
  g.add(SPHL, '#ea8e4c', M(0, 0.032, 0, 0.07, 0.04, 0.07), 0.15); g.add(ICO0, '#f7c08a', M(0, 0.07, 0, 0.011), 0);
  return g.build();
}
function gDrift(r) { // bois flotté : un tube continu fermé aux deux bouts, deux branches cassées
  const g = new GB(), pts = [new V3(-1.0, 0.09, 0), new V3(-0.6, 0.13, 0.06), new V3(-0.2, 0.15, 0.1), new V3(0.15, 0.14, 0.07), new V3(0.5, 0.12, 0.02), new V3(1.0, 0.1, -0.2)], rads = [0.1, 0.098, 0.09, 0.082, 0.07, 0.04];
  tube(g, pts, i => rads[i], i => i % 2 ? '#b0a38d' : '#b9ad98', 9, 0.04, () => 0);
  g.add(SPHL, '#a89b85', M(-1.0, 0.09, 0, 0.1), 0.3, 0.05); g.add(SPHL, '#a89b85', M(1.0, 0.1, -0.2, 0.04), 0.3, 0.05);
  limb(g, new V3(0.1, 0.13, 0.08), new V3(0.4, 0.5, 0.4), 0.04, 0.015, '#a89b85', 6, 0); limb(g, new V3(-0.5, 0.12, 0.05), new V3(-0.65, 0.4, -0.25), 0.035, 0.012, '#a89b85', 6, 0);
  g.add(SPHL, '#a89b85', M(0.4, 0.5, 0.4, 0.016), 0.3, 0); g.add(SPHL, '#a89b85', M(-0.65, 0.4, -0.25, 0.013), 0.3, 0);
  return g.build();
}
function lathe(pts, seg = 12) { return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); }
// fruits cartoon : formes rondes et pleines, reflet blanc, petite feuille nervurée
function fLeaf(g, p, d, len, a, b) { d = d.clone().normalize(); const n = new V3(0, 1, 0).addScaledVector(d, -d.y).normalize(); cleaf(g, p, d, n, len, len * 0.55, lin(a || '#3f8a2c'), lin(b || '#7cc444'), n.clone().add(new V3(0, 0.6, 0)).normalize(), 0, 0); }
function shine(g, x, y, z, r) { g.add(SPHL, '#ffffff', M(x, y, z, r, r * 0.7, r * 0.45), 0); }
function gFruit(type) {
  const g = new GB(), stem = '#6a4426';
  if (type === 'apple') {
    g.add(lathe([[0.001, -0.08], [0.03, -0.094], [0.072, -0.074], [0.104, -0.02], [0.106, 0.035], [0.084, 0.08], [0.045, 0.094], [0.016, 0.082], [0.001, 0.066]], 20), '#e3342b', M(0, 0, 0), 0.45, 0.02);
    g.add(lathe([[0.0, 0.07], [0.04, 0.09], [0.07, 0.078]], 20), '#f0603a', M(0, 0.004, 0), 0.2, 0);
    shine(g, -0.05, 0.045, 0.072, 0.02);
    tube(g, [new V3(0, 0.06, 0), new V3(0.004, 0.1, 0), new V3(0.018, 0.13, 0.004)], i => 0.008 - i * 0.001, stem, 6, 0, () => 0);
    fLeaf(g, new V3(0.012, 0.115, 0), new V3(1, 0.45, 0.25), 0.1);
  } else if (type === 'cherry') {
    for (const s2 of [[-0.042, -0.06, 0], [0.046, -0.074, 0.014]]) {
      g.add(SPH, s2[0] < 0 ? '#b8102c' : '#d0182f', M(s2[0], s2[1], s2[2], 0.045, 0.042, 0.045), 0.5, 0); shine(g, s2[0] - 0.015, s2[1] + 0.018, s2[2] + 0.03, 0.011);
      tube(g, [new V3(s2[0], s2[1] + 0.035, s2[2]), new V3(s2[0] * 0.6, 0.02, s2[2] * 0.5), new V3(0, 0.09, 0)], 0.0045, '#6f8f34', 6, 0, () => 0);
    }
    fLeaf(g, new V3(0, 0.088, 0), new V3(0.8, 0.25, -0.4), 0.1);
  } else if (type === 'orange') {
    g.add(SPH, '#ff8f1a', M(0, 0, 0, 0.105, 0.1, 0.105), 0.42, 0.02); shine(g, -0.05, 0.05, 0.065, 0.022);
    for (let i = 0; i < 5; i++) { const a = i * 1.257; g.add(SPHL, '#4a7a2a', M(Math.cos(a) * 0.012, 0.1, Math.sin(a) * 0.012, 0.012, 0.004, 0.006, 0, -a, 0), 0); }
    fLeaf(g, new V3(0, 0.1, 0), new V3(0.7, 0.55, 0.3), 0.12, '#2f7a32', '#5aa640');
  } else if (type === 'lemon') {
    g.add(lathe([[0.001, -0.13], [0.016, -0.118], [0.03, -0.1], [0.064, -0.068], [0.08, -0.01], [0.072, 0.05], [0.042, 0.092], [0.018, 0.108], [0.001, 0.116]], 18), '#ffe03a', M(0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0), 0.35, 0.02);
    shine(g, -0.04, 0.05, -0.02, 0.018);
    g.add(SPHL, '#8a9a35', M(0, 0, -0.112, 0.012), 0); fLeaf(g, new V3(0, 0.015, -0.108), new V3(0.5, 0.5, -0.5), 0.1, '#5f9a3a', '#a2cc55');
  } else {
    [[0, 0, 0], [0.05, 0.008, 0.022], [-0.034, 0.022, 0.038], [0.01, 0.05, -0.012], [-0.024, -0.014, -0.044], [0.034, -0.032, -0.022], [-0.05, -0.02, 0.0]].forEach((p, i) => { g.add(SPH, i % 2 ? '#4e4cc8' : '#3a37a2', M(p[0], p[1], p[2], 0.033), 0.5); g.add(SPHL, '#26246a', M(p[0], p[1] + 0.03, p[2], 0.01, 0.004, 0.01), 0); shine(g, p[0] - 0.012, p[1] + 0.014, p[2] + 0.022, 0.007); });
    fLeaf(g, new V3(0, 0.055, 0), new V3(0.5, 0.6, 0.3), 0.09);
  }
  return g.build();
}

/* ---------- placement ---------- */
const VEG = [], COL = new Map(), TREES = [];
const FRUITS = [], FRUIT_MESH = {};
const SPOTS = {};
// obstacles : x, z, rayon, hauteur (Infinity = arbre, on ne passe pas ; finie = rocher en dôme, on peut sauter dessus)
function addCol(x, z, r, h = Infinity) { const k = Math.floor(x / 8) * 4096 + Math.floor(z / 8); let a = COL.get(k); if (!a) COL.set(k, a = []); a.push(x, z, r, h); }
const colSurf = (a, k, d, R) => heightAt(a[k], a[k + 1]) + a[k + 3] * Math.sqrt(Math.max(0, 1 - (d / R) * (d / R)));
function rockTop(x, z) { // dessus des rochers sous ce point (-Infinity s'il n'y en a pas)
  const cx = Math.floor(x / 8), cz = Math.floor(z / 8); let best = -Infinity;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = COL.get((cx + i) * 4096 + cz + j); if (!a) continue;
    for (let k = 0; k < a.length; k += 4) { if (a[k + 3] === Infinity) continue; const R = a[k + 2] + 0.35, d = Math.hypot(x - a[k], z - a[k + 1]); if (d < R) best = Math.max(best, colSurf(a, k, d, R)); }
  }
  return best;
}
function collide(p, rad) {
  const cx = Math.floor(p.x / 8), cz = Math.floor(p.z / 8);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = COL.get((cx + i) * 4096 + cz + j); if (!a) continue;
    for (let k = 0; k < a.length; k += 4) { const dx = p.x - a[k], dz = p.z - a[k + 1], rr = a[k + 2] + rad, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); if (a[k + 3] !== Infinity && p.y !== undefined && p.y + 0.35 >= colSurf(a, k, Math.max(0, d - 0.3), rr)) continue; /* assez haut : on passe sur le rocher */ p.x = a[k] + dx / d * rr; p.z = a[k + 1] + dz / d * rr; } }
  }
}
const _im = new THREE.Matrix4(), _iq = new THREE.Quaternion(), _ip = new V3(), _is = new V3(), _ic = new THREE.Color();
function seat(e) {
  for (const t of e.tiles) {
    t.list.forEach((it, i) => {
      _ip.set(it.x, (it.y === undefined ? heightAt(it.x, it.z) : it.y) - e.sink * it.s, it.z); _iq.setFromAxisAngle(_up, it.ry); _is.set(it.s, it.s * (it.sy || 1), it.s);
      _im.compose(_ip, _iq, _is); it.m = _im.toArray(it.m || new Array(16)); t.mesh.setMatrixAt(i, _im);
    });
    t.mesh.instanceMatrix.needsUpdate = true; t.st = ''; t.lp.set(1e9, 0, 0);
  }
}
// répartit les arbres d'une tuile entre le maillage détaillé (près) et le simplifié (loin)
const _cl = [0, 0, 0];
function tileFill(t, cp, mode) {
  const hi = t.mesh, lo = t.lo; let nh = 0, nl = 0;
  for (const it of t.list) {
    const far = mode === 'lo' || (mode === 'mix' && Math.hypot(it.x - cp.x, it.z - cp.z) > LODD * (0.8 + it.s * 0.25));
    const m = far ? lo : hi, k = far ? nl++ : nh++;
    m.instanceMatrix.array.set(it.m, k * 16); m.instanceColor.array.set(it.c, k * 3);
  }
  hi.count = nh; lo.count = nl; hi.visible = nh > 0; lo.visible = nl > 0;
  hi.instanceMatrix.needsUpdate = lo.instanceMatrix.needsUpdate = true; hi.instanceColor.needsUpdate = lo.instanceColor.needsUpdate = true;
  t.lp.copy(cp);
}
function nearTree(x, z, sp) { for (let i = 0; i < TREES.length; i += 2) { const dx = TREES[i] - x, dz = TREES[i + 1] - z; if (dx * dx + dz * dz < sp * sp) return true; } return false; }
function scatter(o) {
  const r = mulberry(o.seed); let items = o.list || [];
  if (!o.list) {
    const n = Math.round(o.count * (o.space ? (LOW ? 0.75 : 1) : DENS)); let tries = 0;
    while (items.length < n && tries++ < n * 90) {
      const x = (r() * 2 - 1) * 330, z = (r() * 2 - 1) * 330, h = heightAt(x, z);
      if (h < 0.5) continue;
      if (!o.rule(x, z, h, slopeAt(x, z), r)) continue;
      if (o.space && nearTree(x, z, o.space)) continue;
      items.push({ x, z, s: lerp(o.smin, o.smax, r()), ry: r() * 6.2832, sy: o.sy ? lerp(o.sy[0], o.sy[1], r()) : 1 });
    }
  }
  if (o.seaward) items.forEach(it => it.ry = seaYaw(it.x, it.z, it.ry)); // troncs courbés tournés vers la mer
  const tv = o.tint === undefined ? 0.16 : o.tint;
  items.forEach(it => { if (o.space) TREES.push(it.x, it.z); if (o.col) addCol(it.x, it.z, o.col * it.s, o.climb ? o.climb * it.s * (it.sy || 1) : Infinity); const b = 1 - tv + r() * tv * 2, w = (r() - 0.5) * tv; it.c = [b * (1 + w), b, b * (1 - w * 1.5)]; });
  o.geo.computeBoundingSphere(); const bs = o.geo.boundingSphere;
  const e = { lo: o.lo || null, name: o.name, items, sink: o.sink || 0, geo: o.geo, mat: o.mat, shadow: !!o.shadow, recv: !!o.recv, col: o.col || 0, climb: o.climb || 0, tv, gr: bs.radius + bs.center.length(), maxD: o.maxD || (o.shadow ? 4000 : 190), tiles: [], key: o.key || o.name };
  buildE(e); VEG.push(e); return e;
}
// orientation qui tourne la courbe d'un palmier (vers +x tourné de 0,6 rad dans gPalm) vers la pente qui descend à la mer
function seaYaw(x, z, ry) { const e = 10, gx = heightAt(x + e, z) - heightAt(x - e, z), gz = heightAt(x, z + e) - heightAt(x, z - e); const dx = gx || gz ? -gx : x, dz = gx || gz ? -gz : z; return 0.6 - Math.atan2(dz, dx) + ((ry / 6.2832) - 0.5) * 0.9; }
const TILE = 120, LODD = 75;
function lowG(fn) { const L0 = LOW; LOW = true; let g; try { g = fn(); } finally { LOW = L0; } return g; } // version simplifiée pour le lointain
function buildE(e) {
  for (const t of e.tiles) scene.remove(t.mesh);
  const groups = new Map(); e.tiles = [];
  for (const it of e.items) { if (it.dead) continue; const k = Math.floor((it.x + 500) / TILE) * 1000 + Math.floor((it.z + 500) / TILE); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(it); }
  groups.forEach(list => {
    let cx = 0, cz = 0, ms = 0; for (const it of list) { cx += it.x; cz += it.z; ms = Math.max(ms, it.s * (it.sy || 1)); } cx /= list.length; cz /= list.length;
    let rad = 0; for (const it of list) rad = Math.max(rad, Math.hypot(it.x - cx, it.z - cz)); rad += e.gr * ms + 2;
    const tg = new THREE.BufferGeometry(); for (const k in e.geo.attributes) tg.setAttribute(k, e.geo.attributes[k]);
    tg.boundingSphere = new THREE.Sphere(new V3(cx, heightAt(cx, cz), cz), rad + 30);
    const mesh = new THREE.InstancedMesh(tg, e.mat, list.length);
    list.forEach((it, i) => mesh.setColorAt(i, _ic.setRGB(it.c[0], it.c[1], it.c[2])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = e.shadow; mesh.receiveShadow = e.recv; scene.add(mesh);
    let lo = null;
    if (e.lo) { const lg = new THREE.BufferGeometry(); for (const k in e.lo.attributes) lg.setAttribute(k, e.lo.attributes[k]); lg.boundingSphere = tg.boundingSphere; lo = new THREE.InstancedMesh(lg, e.mat, list.length); list.forEach((it, i) => lo.setColorAt(i, _ic.setRGB(it.c[0], it.c[1], it.c[2]))); lo.receiveShadow = e.recv; lo.count = 0; scene.add(lo); }
    e.tiles.push({ mesh, lo, list, cx, cz, rad, st: '', lp: new V3(1e9, 0, 0) });
  });
  seat(e);
}
// élagage par la distance : les petites plantes lointaines ne sont plus dessinées (le brouillard les cache déjà)
let _lodN = 0;
function updateVegLOD(cp) {
  if (_lodN++ % 15) return;
  for (const e of VEG) for (const t of e.tiles) {
    const d = Math.hypot(t.cx - cp.x, t.cz - cp.z);
    if (!t.lo) { t.mesh.visible = d - t.rad < e.maxD; continue; }
    const mode = d + t.rad < LODD * 0.8 ? 'hi' : d - t.rad > LODD * 1.2 ? 'lo' : 'mix';
    if (mode !== t.st || (mode === 'mix' && t.lp.distanceToSquared(cp) > 9)) { t.st = mode; tileFill(t, cp, mode); }
  }
}
function removeCol(x, z) {
  const a = COL.get(Math.floor(x / 8) * 4096 + Math.floor(z / 8)); if (!a) return;
  for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - x) < 0.01 && Math.abs(a[k + 1] - z) < 0.01) { a.splice(k, 4); return; }
}
function addFruits(e, type, pts, cap) {
  e.items.forEach(it => pts.forEach((p, i) => {
    if (hash2(i * 7 + (it.x * 10 | 0), (it.z * 10 | 0)) > cap) return;
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    FRUITS.push({ type, tree: it, lx: (p.x * c + p.z * s) * it.s, ly: p.y * it.s * (it.sy || 1), lz: (-p.x * s + p.z * c) * it.s, aH: p.y, ph: p.ph || 0, picked: false, regrow: 0, x: 0, y: 0, z: 0, idx: 0 });
  }));
}
function buildFruitMeshes(sw) {
  for (const type of ['apple', 'cherry', 'orange', 'lemon', 'berry']) {
    const list = FRUITS.filter(f => f.type === type), geo = gFruit(type);
    const aT = new Float32Array(list.length * 4); list.forEach((f, i) => { aT[i * 4] = f.tree.x; aT[i * 4 + 1] = f.tree.z; aT[i * 4 + 2] = f.aH; aT[i * 4 + 3] = f.ph; f.idx = i; });
    geo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4));
    const mesh = new THREE.InstancedMesh(geo, mat(Object.assign({ fruit: true, grain: 9, ga: 0.14, ds: true }, sw[type])), list.length);
    mesh.frustumCulled = false; mesh.userData.list = list; scene.add(mesh); FRUIT_MESH[type] = mesh;
  }
  seatFruits();
}
function seatFruits() {
  for (const f of FRUITS) {
    f.x = f.tree.x + f.lx; f.z = f.tree.z + f.lz; f.y = heightAt(f.tree.x, f.tree.z) + f.ly; if (f.tree.dead) { f.picked = true; f.regrow = 1e12; }
    _ip.set(f.x, f.y, f.z); _iq.setFromAxisAngle(_up, f.lx * 9); _is.set(0.95, 0.95, 0.95);
    f.m = _im.compose(_ip, _iq, _is).toArray(f.m || new Array(16));
  }
  cullFruits(null, true);
}
// seuls les fruits proches (non cueillis) sont envoyés à la carte graphique : ils sont détaillés, et invisibles de loin
let _fruitN = 0, _fruitP = new V3(1e9, 0, 0);
function cullFruits(cp, force) {
  if (cp) { if (!force && (_fruitN++ % 12 || _fruitP.distanceToSquared(cp) < 4)) return; _fruitP.copy(cp); } else cp = _fruitP;
  const R2 = 80 * 80;
  for (const k in FRUIT_MESH) {
    const mesh = FRUIT_MESH[k], A = mesh.geometry.attributes.aT, M = mesh.instanceMatrix.array; let n = 0;
    for (const f of mesh.userData.list) { if (f.picked || !f.m) continue; const dx = f.x - cp.x, dz = f.z - cp.z; if (dx * dx + dz * dz > R2) continue;
      M.set(f.m, n * 16); A.array[n * 4] = f.tree.x; A.array[n * 4 + 1] = f.tree.z; A.array[n * 4 + 2] = f.aH; A.array[n * 4 + 3] = f.ph; n++; }
    mesh.count = n; mesh.visible = n > 0; mesh.instanceMatrix.needsUpdate = true; A.needsUpdate = true;
  }
}
function setFruit(f, picked) {
  f.picked = picked; cullFruits(null, true);
}

function buildFlora() {
  const r = mulberry(4242);
  // version lointaine = même arbre (mêmes tirages aléatoires rejoués), seulement moins détaillé
  const tw = fn => { const rec = []; const geo = fn(() => { const v = r(); rec.push(v); return v; }, false); let i = 0; const lo = lowG(() => fn(() => i < rec.length ? rec[i++] : 0.5, true)); return { geo, lo }; };
  SPOTS.spawn = findSpot(Math.PI / 2, 1.0, 1.5);
  SPOTS.apple = findSpot(0.95, 4.5, 9, 0.2, 200); SPOTS.cherry = findSpot(3.05, 4.5, 9, 0.2, 200); SPOTS.orange = findSpot(-2.6, 4.5, 11, 0.2, 200);
  SPOTS.lemon = findSpot(1.75, 12, 22, 0.25, 150);
  const orch = [SPOTS.apple, SPOTS.cherry, SPOTS.orange];
  const clear = (x, z) => { for (const o of orch) if (Math.hypot(x - o.x, z - o.z) < 27) return false; return Math.hypot(x - SPOTS.lemon.x, z - SPOTS.lemon.z) > 13 && Math.hypot(x - SPOTS.spawn.x, z - SPOTS.spawn.z) > 7 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 44 && Math.hypot(x - CAPE.x, z - CAPE.z) > 16; };
  const jn = (x, z) => fbm(x * 0.022 + 8, z * 0.022 + 2, 3);
  const ring = (c, n, seed, smin, smax) => { const rr = mulberry(seed), l = []; let t = 0; while (l.length < n && t++ < 1200) { const a = rr() * 6.2832, d = 4 + Math.sqrt(rr()) * 21, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, h = heightAt(x, z); if (h < 3 || slopeAt(x, z) > 0.4) continue; if (l.some(q => Math.hypot(q.x - x, q.z - z) < 6.5)) continue; l.push({ x, z, s: lerp(smin, smax, rr()), ry: rr() * 6.28 }); } return l; };
  const treeM = mat({ ds: true, bend: 0.012, branch: 0.22, freq: 1.1, grain: 2.2, ga: 0.3, bark: 1 });
  const fa = [], fc = [], fo = [], fl = [], fb = [];
  const eA = scatter({ name: 'Pommier', seed: 1, ...tw((q, lo) => gApple(q, lo ? [] : fa)), mat: treeM, list: ring(SPOTS.apple, 13, 11, 0.7, 1.55), col: 0.26, space: 1, shadow: 1 });
  const eC = scatter({ name: 'Cerisier', seed: 2, ...tw((q, lo) => gCherry(q, lo ? [] : fc)), mat: treeM, list: ring(SPOTS.cherry, 12, 12, 0.7, 1.6), col: 0.2, space: 1, shadow: 1, tint: 0.07 });
  const eO = scatter({ name: 'Oranger', seed: 3, ...tw((q, lo) => gOrange(q, lo ? [] : fo)), mat: treeM, list: ring(SPOTS.orange, 12, 13, 0.7, 1.5), col: 0.2, space: 1, shadow: 1 });
  const eL = scatter({ name: 'Citronnier', seed: 4, geo: gLemon(r, fl), mat: treeM, list: [{ x: SPOTS.lemon.x, z: SPOTS.lemon.z, s: 1.3, ry: 1 }], col: 0.26, space: 1, shadow: 1, tint: 0 });
  addFruits(eA, 'apple', fa, 0.75); addFruits(eC, 'cherry', fc, 0.85); addFruits(eO, 'orange', fo, 0.75); addFruits(eL, 'lemon', fl, 0.9);
  const palmM = mat({ ds: true, bend: 0.011, branch: 0.3, freq: 1.3, grain: 2.5, bark: 1, back: 0.48 });
  scatter({ name: 'Palmier', seed: 5, seaward: 1, ...tw((q, lo) => gPalm(q)), mat: palmM, count: 75, smin: 0.65, smax: 1.45, sy: [0.7, 1.45], col: 0.3, space: 5.5, shadow: 1, sink: 0.1, rule: (x, z, h, sl) => h > 1.0 && h < 3.6 && sl < 0.22 && clear(x, z) });
  scatter({ name: 'Palmier penché', seed: 31, seaward: 1, ...tw((q, lo) => gPalm(q, { h: 8.4, bend: 5.2 })), mat: palmM, count: 45, smin: 0.65, smax: 1.45, sy: [0.7, 1.45], col: 0.3, space: 6, shadow: 1, sink: 0.1, rule: (x, z, h, sl) => h > 1.0 && h < 3.6 && sl < 0.22 && clear(x, z) });
  scatter({ name: 'Palmier tordu', seed: 32, seaward: 1, ...tw((q, lo) => gPalm(q, { h: 7.2, bend: 1.4, s: -1.3, side: 1.1 })), mat: palmM, count: 40, smin: 0.65, smax: 1.45, sy: [0.7, 1.45], col: 0.3, space: 6, shadow: 1, sink: 0.1, rule: (x, z, h, sl) => h > 1.0 && h < 3.6 && sl < 0.22 && clear(x, z) });
  scatter({ name: 'Grand arbre de jungle', seed: 6, ...tw((q, lo) => gJungle(q)), mat: mat({ ds: true, bend: 0.0058, branch: 0.3, freq: 0.9, grain: 2.2, ga: 0.3, bark: 1 }), count: 230, smin: 0.55, smax: 1.6, sy: [0.8, 1.35], col: 0.6, space: 6.5, shadow: 1, sink: 0.2, rule: (x, z, h, sl, rr) => h > 3.6 && h < 34 && sl < 0.5 && clear(x, z) && jn(x, z) > 0.42 + rr() * 0.15 });
  scatter({ name: 'Frangipanier', seed: 24, ...tw((q, lo) => gFrangi(q)), mat: treeM, count: 45, smin: 0.6, smax: 1.7, col: 0.24, space: 5, shadow: 1, rule: (x, z, h, sl) => h > 2.8 && h < 16 && sl < 0.35 && clear(x, z) && jn(x + 200, z) > 0.5 });
  scatter({ name: 'Pin colonnaire', seed: 7, ...tw((q, lo) => gPine(q)), mat: mat({ ds: true, bend: 0.0045, branch: 0.16, freq: 1.0, grain: 2.5, bark: 1 }), count: 150, smin: 0.5, smax: 1.6, sy: [0.85, 1.45], col: 0.28, space: 4.5, shadow: 1, sink: 0.2, rule: (x, z, h, sl, rr) => h > 16 && h < 78 && sl < 0.85 && clear(x, z) && rr() < smooth(16, 30, h) });
  scatter({ name: 'Fougère arborescente', seed: 8, ...tw((q, lo) => gTreeFern(q)), mat: mat({ ds: true, bend: 0.018, branch: 0.22, freq: 1.5, grain: 3, bark: 1 }), count: 120, smin: 0.8, smax: 1.4, col: 0.2, space: 4, shadow: 1, rule: (x, z, h, sl) => h > 4 && h < 40 && sl < 0.7 && clear(x, z) && jn(x + 50, z) > 0.45 });
  scatter({ name: 'Bananier', seed: 25, geo: gBanana(r), mat: mat({ ds: true, bend: 0.03, branch: 0.2, freq: 1.3, grain: 3, ga: 0.2 }), count: 70, smin: 0.8, smax: 1.35, col: 0.2, space: 3.5, shadow: 1, rule: (x, z, h, sl) => h > 2.8 && h < 14 && sl < 0.35 && clear(x, z) && fbm(x * 0.03 + 40, z * 0.03 + 60, 2) > 0.56 });
  scatter({ name: 'Bambou', seed: 9, geo: gBamboo(r), mat: mat({ ds: true, bend: 0.009, branch: 0.12, freq: 1.4, grain: 3 }), count: 50, smin: 0.8, smax: 1.3, col: 0.7, space: 5, shadow: 1, rule: (x, z, h, sl) => h > 3 && h < 18 && sl < 0.4 && clear(x, z) && fbm(x * 0.03 + 90, z * 0.03, 2) > 0.6 });
  const shrubM = mat({ ds: true, bend: 0.03, branch: 0.06, freq: 1.8, grain: 3 });
  scatter({ name: 'Buisson', maxD: 210, seed: 41, ...tw((q, lo) => gShrub(q, ['#4f9a38', '#5fae40', '#3f8a32', '#72b848'])), mat: shrubM, count: 1200, smin: 0.6, smax: 1.5, sy: [0.7, 1.2], tint: 0.14, col: 0.35, rule: (x, z, h, sl) => h > 3 && h < 45 && sl < 0.55 && clear(x, z) && fbm(x * 0.04 + 9, z * 0.04 - 3, 2) > 0.42 });
  scatter({ name: 'Buisson de jungle', maxD: 210, seed: 42, ...tw((q, lo) => gShrub(q, ['#2f7a3a', '#3c8c40', '#246a32', '#4a9a48'], 1.25)), mat: shrubM, count: 900, smin: 0.7, smax: 1.6, sy: [0.8, 1.3], tint: 0.12, col: 0.4, rule: (x, z, h, sl, rr) => h > 3.4 && h < 36 && sl < 0.5 && clear(x, z) && jn(x, z) > 0.3 + rr() * 0.1 });
  const eB = scatter({ name: 'Buisson à baies', seed: 10, ...tw((q, lo) => gBush(q, lo ? [] : fb)), mat: mat({ ds: true, bend: 0.03, branch: 0.06, freq: 1.8, grain: 3 }), count: 60, smin: 1.2, smax: 2.0, col: 0.5, space: 3.5, shadow: 1, rule: (x, z, h, sl) => h > 3.2 && h < 30 && sl < 0.5 && clear(x, z) });
  addFruits(eB, 'berry', fb, 0.5);
  const under = (x, z, h, sl) => h > 2.9 && h < 52 && sl < 0.7 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 36;
  scatter({ name: 'Fougère', maxD: 150, seed: 11, geo: gFern(r, '#2c8030', '#8fcc4c', 7, 1.15), mat: mat({ ds: true, bend: 0.1, branch: 0.1, freq: 2.0, grain: 4, ga: 0.2 }), count: 1400, smin: 0.7, smax: 1.6, rule: (x, z, h, sl, rr) => under(x, z, h, sl) && jn(x, z) > 0.3 + rr() * 0.25 });
  scatter({ name: 'Fougère bleutée', maxD: 150, seed: 12, geo: gFern(r, '#1f7350', '#5fc088', 6, 1.5), mat: mat({ ds: true, bend: 0.08, branch: 0.12, freq: 1.8, grain: 4, ga: 0.2 }), count: 550, smin: 0.7, smax: 1.4, rule: (x, z, h, sl, rr) => under(x, z, h, sl) && h > 8 && jn(x + 30, z + 30) > 0.4 + rr() * 0.2 });
  scatter({ name: 'Plante à grandes feuilles', maxD: 160, seed: 13, geo: gBroad(r), mat: mat({ ds: true, bend: 0.06, branch: 0.07, freq: 1.7, grain: 4, ga: 0.2 }), count: 700, smin: 0.8, smax: 1.7, rule: (x, z, h, sl, rr) => h > 2.8 && h < 24 && sl < 0.5 && jn(x, z + 70) > 0.4 + rr() * 0.2 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 36 });
  const grassM = mat({ ds: true, bend: 0.25, branch: 0.05, freq: 2.6, grain: 6, ga: 0.16, grass: 1 });
  const gOK = (x, z, h, sl) => h > 2.5 && h < 60 && sl < 0.55 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 30;
  scatter({ name: 'Herbe', maxD: 140, seed: 14, geo: gGrass(r, false), mat: grassM, count: 3500, smin: 1.0, smax: 2.0, tint: 0.2, recv: 1, rule: (x, z, h, sl, rr) => gOK(x, z, h, sl) && fbm(x * 0.06, z * 0.06, 2) < 0.62 + rr() * 0.1 });
  scatter({ name: 'Herbe sèche', maxD: 140, seed: 26, geo: gGrass(r, true), mat: grassM, count: 1500, smin: 1.0, smax: 2.0, tint: 0.15, recv: 1, rule: (x, z, h, sl, rr) => (gOK(x, z, h, sl) && fbm(x * 0.06, z * 0.06, 2) > 0.55) || (h > 1.7 && h < 2.6 && rr() < 0.3) });
  const flM = mat({ ds: true, bend: 0.3, branch: 0.04, freq: 2.2, grain: 6, ga: 0.1 });
  scatter({ name: 'Hibiscus', maxD: 170, seed: 15, geo: gHibiscus(r), mat: flM, count: 520, smin: 0.9, smax: 1.5, tint: 0.06, rule: (x, z, h, sl) => h > 2.7 && h < 20 && sl < 0.45 && fbm(x * 0.05, z * 0.05 + 20, 2) > 0.52 });
  scatter({ name: 'Marguerites', maxD: 150, seed: 16, geo: gDaisy(r), mat: flM, count: 700, smin: 0.9, smax: 1.6, tint: 0.04, rule: (x, z, h, sl) => h > 2.7 && h < 44 && sl < 0.5 && fbm(x * 0.05 + 33, z * 0.05, 2) > 0.5 });
  scatter({ name: 'Lupins', maxD: 170, seed: 17, geo: gLupin(r), mat: flM, count: 450, smin: 0.9, smax: 1.6, tint: 0.06, rule: (x, z, h, sl) => h > 12 && h < 70 && sl < 0.7 && fbm(x * 0.05 + 70, z * 0.05 + 70, 2) > 0.48 });
  const rockM = mat({ grain: 1.6, ga: 0.5 });
  scatter({ name: 'Rocher', seed: 18, geo: gRock(1), mat: rockM, count: 320, smin: 0.5, smax: 3.4, sy: [0.6, 1.4], col: 0.8, climb: 0.8, shadow: 1, recv: 1, sink: 0.1, tint: 0.1, rule: (x, z, h, sl, rr) => (h > 40 || sl > 0.8 || (h > 1 && rr() < 0.07)) && clear(x, z) });
  scatter({ name: 'Galet', maxD: 90, seed: 19, geo: gRock(5, 1), mat: rockM, count: 320, smin: 0.1, smax: 0.4, tint: 0.14, recv: 1, rule: (x, z, h) => h > 0.6 && h < 2.6 || h > 40 });
  const shM = mat({ ds: true, grain: 14, ga: 0.12 });
  scatter({ name: 'Coquillage spiralé', maxD: 70, seed: 20, geo: gShell(), mat: shM, count: 110, smin: 0.7, smax: 1.5, tint: 0.08, rule: (x, z, h) => h > 0.5 && h < 1.9 });
  scatter({ name: 'Coquille en éventail', maxD: 70, seed: 27, geo: gScallop(), mat: shM, count: 110, smin: 0.5, smax: 1.1, tint: 0.1, rule: (x, z, h) => h > 0.5 && h < 1.9 });
  scatter({ name: 'Étoile de mer', maxD: 70, seed: 21, geo: gStar(), mat: shM, count: 60, smin: 0.9, smax: 1.6, tint: 0.1, rule: (x, z, h) => h > 0.45 && h < 1.2 });
  scatter({ name: 'Bois flotté', seed: 22, geo: gDrift(r), mat: mat({ grain: 5, ga: 0.3 }), count: 36, smin: 0.8, smax: 1.6, shadow: 1, rule: (x, z, h) => h > 0.9 && h < 2.2 });
  const wl = []; for (let i = 0; i < 11; i++) { const a = i / 11 * 6.2832; wl.push({ x: SPOTS.lemon.x + Math.cos(a) * 4.2, z: SPOTS.lemon.z + Math.sin(a) * 4.2, s: 0.32 + (i % 3) * 0.06, ry: i }); }
  const wg = new GB(); wg.add(ICO, '#efe9dc', M(0, 0.3, 0, 1, 0.75, 1), 0.3);
  scatter({ name: 'Pierre blanche', seed: 23, geo: wg.build(), mat: rockM, list: wl, shadow: 1, tint: 0.03 });
  const fs = { bend: 0.012, branch: 0.22, freq: 1.1 }; // mêmes réglages de vent que les vergers (treeM)
  buildFruitMeshes({ apple: fs, cherry: fs, orange: fs, lemon: fs, berry: { bend: 0.03, branch: 0.06, freq: 1.8 } });
}
function reseatAll() { VEG.forEach(seat); seatFruits(); NG.cx = 1e9; }
/* herbe dense autour du joueur : une grille de touffes qui se replace à mesure qu'on avance */
const NG = { n: LOW ? 52 : 100, cell: LOW ? 0.85 : 0.55, cx: 1e9, cz: 1e9, mesh: null, ci: null, cj: null };
function buildNearGrass() {
  const n = NG.n, r = mulberry(5);
  NG.mesh = new THREE.InstancedMesh(gGrass(r, false), mat({ ds: true, bend: 0.25, branch: 0.05, freq: 2.6, grain: 6, ga: 0.16, fade: n * NG.cell * 0.5, grass: 1 }), n * n);
  NG.mesh.frustumCulled = false; NG.mesh.receiveShadow = true; NG.ci = new Int32Array(n * n).fill(1e9); NG.cj = new Int32Array(n * n).fill(1e9);
  for (let i = 0; i < n * n; i++) { NG.mesh.setMatrixAt(i, _im.makeScale(0, 0, 0)); NG.mesh.setColorAt(i, _ic.setRGB(1, 1, 1)); }
  scene.add(NG.mesh);
}
function updateNearGrass(px, pz) {
  const n = NG.n, c = NG.cell, cx = Math.floor(px / c), cz = Math.floor(pz / c); if (cx === NG.cx && cz === NG.cz) return;
  NG.cx = cx; NG.cz = cz; const bx = cx - (n >> 1), bz = cz - (n >> 1); let ch = false;
  for (let sj = 0; sj < n; sj++) { const wj = bz + (((sj - bz) % n) + n) % n; for (let si = 0; si < n; si++) {
    const wi = bx + (((si - bx) % n) + n) % n, k = sj * n + si; if (NG.ci[k] === wi && NG.cj[k] === wj) continue;
    NG.ci[k] = wi; NG.cj[k] = wj; ch = true;
    const x = (wi + hash2(wi, wj)) * c, z = (wj + hash2(wj + 91, wi)) * c, h = heightAt(x, z), rr = hash2(wi * 3 + 7, wj * 5 + 1);
    const ok = h > 2.45 && h < 64 && slopeAt(x, z) < 0.6 && fbm(x * 0.045, z * 0.045, 2) > 0.3 + rr * 0.2 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 30;
    if (!ok) { NG.mesh.setMatrixAt(k, _im.makeScale(0, 0, 0)); continue; }
    const s = (0.75 + rr * 0.9) * (0.45 + 0.55 * smooth(2.45, 3.6, h)), dry = smooth(0.5, 0.85, fbm(x * 0.06, z * 0.06, 2)), b = 0.85 + hash2(wi + 13, wj) * 0.3;
    _ip.set(x, h, z); _iq.setFromAxisAngle(_up, rr * 40); _is.set(s, s * (0.8 + hash2(wj, wi) * 0.5), s);
    NG.mesh.setMatrixAt(k, _im.compose(_ip, _iq, _is)); NG.mesh.setColorAt(k, _ic.setRGB(b * (1 + dry * 0.55), b * (1 + dry * 0.25), b * (1 - dry * 0.2)));
  } }
  if (ch) { NG.mesh.instanceMatrix.needsUpdate = true; NG.mesh.instanceColor.needsUpdate = true; }
}

/* ---------- vie : mouettes, vols d'oiseaux, lucioles, filets de vent ---------- */
const DOT = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const birds = [], flies = []; let fireflies, windLines = [], pollen, petals;
function makeBird(m, sc) {
  const g = new THREE.Group(), wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.22, 0.75, 0.02, -0.12, 0, 0, 0.2, 0, 0, 0.2, 0.75, 0.02, -0.12, 0.72, 0.02, 0.12], 3));
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0.85, 0, 0.0, 0, 0, 0.12], 3));
  const mk = sg => { const a = new THREE.Group(), w1 = new THREE.Mesh(wg, m), b = new THREE.Group(), w2 = new THREE.Mesh(tg, m); b.position.x = 0.73; b.add(w2); a.add(w1, b); a.scale.x = sg; g.add(a); return { a, b }; };
  const L = mk(1), R = mk(-1), body = new THREE.Mesh(SPHL, m); body.scale.set(0.13, 0.11, 0.42); g.add(body);
  const tail = new THREE.Mesh(tg, m); tail.rotation.y = -Math.PI / 2; tail.scale.set(0.35, 1, 1.2); tail.position.z = 0.35; g.add(tail);
  g.scale.setScalar(sc); g.userData = { L, R, sc }; g.traverse(o => { o.frustumCulled = false; }); scene.add(g); return g;
}
function buildLife() {
  const r = mulberry(9), white = new THREE.MeshBasicMaterial({ color: 0xf4f4f0, side: THREE.DoubleSide }), dark = new THREE.MeshBasicMaterial({ color: 0x2a2f3a, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) { const g = makeBird(white, 1.25); Object.assign(g.userData, { kind: 'gull', ph: r() * 6.28, rad: 50 + r() * 70, a: r() * 6.28, h: 20 + r() * 26, sp: 0.09 + r() * 0.07, ca: r() * 6.28 }); birds.push(g); }
  for (let f = 0; f < 4; f++) {
    const fl = { a: r() * 6.28, rad: 140 + r() * 140, h: 70 + r() * 60, sp: (0.045 + r() * 0.03) * (f % 2 ? 1 : -1), cx: (r() - 0.5) * 120, cz: (r() - 0.5) * 120, wob: r() * 6 }, n = 5 + (r() * 5 | 0);
    for (let i = 0; i < n; i++) { const g = makeBird(dark, 0.9 + r() * 0.3), row = Math.ceil(i / 2), sd = i % 2 ? 1 : -1; Object.assign(g.userData, { kind: 'flock', fl, back: row * 3.2 + r(), side: sd * row * 2.6, up: (r() - 0.5) * 1.5, ph: r() * 6.28 }); birds.push(g); }
  }
  const n = 70, fp = new Float32Array(n * 3);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.2, map: DOT, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  fireflies.frustumCulled = false; fireflies.userData.seed = Array.from({ length: n }, () => [r() * 60 - 30, r() * 60 - 30, r() * 6.28, 0.6 + r() * 2.2]);
  scene.add(fireflies);
  // pollen en suspension dans la lumière, pétales de cerisier, papillons
  const mkPts = (n, col, size) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, map: DOT, transparent: true, opacity: 0, depthWrite: false })); p.frustumCulled = false; p.userData.seed = Array.from({ length: n }, () => [r(), r(), r(), r()]); scene.add(p); return p; };
  pollen = mkPts(320, 0xfff6c8, 0.045); petals = mkPts(260, 0xffc4d8, 0.1);
  const bm = [0xff9a2e, 0x4a8cff, 0xfff4e0, 0xffd23a].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.05, 0.11, 0, -0.09, 0.09, 0, 0.06, 0, 0, -0.05, 0.09, 0, 0.06, 0, 0, 0.05], 3));
  const hib = VEG.find(e => e.name === 'Hibiscus').items;
  for (let i = 0; i < 26; i++) { const g = new THREE.Group(), l = new THREE.Mesh(bg, bm[i % 4]), rt = new THREE.Mesh(bg, bm[i % 4]); rt.scale.x = -1; g.add(l, rt); const h = hib[(r() * hib.length) | 0]; g.userData = { l, rt, hx: h.x, hz: h.z, ph: r() * 6.28, sp: 0.5 + r() * 0.6, rad: 1.2 + r() * 2.5 }; scene.add(g); flies.push(g); }
  for (let i = 0; i < 6; i++) {
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(26 * 3), 3));
    const l = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
    l.frustumCulled = false; l.userData = { s: r() * 60, off: new V3(r() * 80 - 40, 3 + r() * 14, r() * 80 - 40), k: 0.3 + r() * 0.4 }; scene.add(l); windLines.push(l);
  }
}
