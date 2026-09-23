/* Navidabdi-Straße — a Berlin street corner built from a GitHub contribution history.
   One building per year, height set by that year's contributions.

   This runs live in the browser because GitHub Pages serves a real page. The README on
   the profile itself gets a pre-rendered SVG instead: a README is sanitised, and no
   script of any kind survives it.

   Numbers come from docs/data.json, written weekly by .github/workflows/profile.yml —
   a browser cannot fetch them from the API directly, because unauthenticated requests
   are capped at 60 an hour per visitor IP. */

let DATA = {
  byYear: [[2017,464],[2018,598],[2019,767],[2020,545],[2021,1022],
           [2022,1309],[2023,2169],[2024,1657],[2025,1425],[2026,1987]],
  contributions: 11943, repos: 46, stars: 101, followers: 54, views: 7656,
  login: 'navidabdi', district: '10405',
};

const PALETTE = {
  night: {
    sky:0x0a0f24, fog:0x141a3c, ground:0x141834, road:0x0f1228, pave:0x1d2348,
    kerb:0x2a3164, bike:0x5c2b35, facade:0x2b3366, roof:0x3a4480, trim:0x4d57a0,
    win:0xffcf6b, winAlt:0x39d353, sun:0xaab6ff, sunI:0.34, amb:0x2a3160, ambI:0.75,
    lamp:0xffbf4d, lampI:2.2, spati:0xffd479,
    signBg:'#f4f2ec', signInk:'#15161c', tram:0xf2d024, trabi:0xcfd8e8,
    turm:0x2a3166, rail:0x5d6699, rain:0x9fb0ff, rainO:0.34, star:true,
  },
  day: {
    sky:0xd3dce6, fog:0xdfe4e2, ground:0xdcd7ca, road:0xb3afa6, pave:0xd9d3c6,
    kerb:0xcdc7ba, bike:0xc09484, facade:0xece6d9, roof:0xc3bba9, trim:0xa79e8a,
    win:0x6d7789, winAlt:0x2f6f4f, sun:0xfff6e2, sunI:0.95, amb:0xc9d2dd, ambI:0.95,
    lamp:0xffdca8, lampI:0.0, spati:0xffe9a8,
    signBg:'#fbfaf6', signInk:'#15161c', tram:0xe8c41a, trabi:0xe4e0d6,
    turm:0xcdcabf, rail:0x8d887c, rain:0x8f9aa8, rainO:0.2, star:false,
  },
};

const S = {
  spacing: 12, footprint: 7.2, maxHeight: 34, streetWidth: 13,
  camDist: 96, camHeight: 27, camAngle: 26, fov: 38,
  theme: 'night', rain: true, motion: true,
};

let renderer, scene, camera, root, clock, raf;
let movers = [], rainPts = null, lampLights = [];
let maxV = Math.max(...DATA.byYear.map((d) => d[1]));

/* ---------- canvas-drawn textures (the only way to get text onto a mesh) ---------- */

function windowTexture(seed, floors, theme) {
  const cols = 4, cw = 64, ch = 52;
  const c = document.createElement('canvas');
  c.width = cols * cw; c.height = floors * ch;
  const g = c.getContext('2d');
  const P = PALETTE[theme];
  g.fillStyle = '#' + P.facade.toString(16).padStart(6, '0');
  g.fillRect(0, 0, c.width, c.height);
  for (let f = 0; f < floors; f++) {
    for (let k = 0; k < cols; k++) {
      const s = (seed * 7 + f * 13 + k * 29) % 23;
      const lit = theme === 'night' ? s < 15 : true;
      const alt = s === 3 || s === 11;
      g.fillStyle = lit
        ? '#' + (alt ? P.winAlt : P.win).toString(16).padStart(6, '0')
        : '#' + P.kerb.toString(16).padStart(6, '0');
      g.globalAlpha = lit ? 1 : 0.55;
      g.fillRect(k * cw + 16, f * ch + 14, cw - 32, ch - 28);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function signTexture(lines, theme, opts = {}) {
  const P = PALETTE[theme];
  const w = opts.w || 512, h = opts.h || 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || P.signBg;
  g.fillRect(0, 0, w, h);
  if (opts.border !== false) {
    g.strokeStyle = opts.ink || P.signInk;
    g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  }
  g.fillStyle = opts.ink || P.signInk;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    g.font = `${ln.weight || 700} ${ln.size || 54}px ui-monospace, Menlo, monospace`;
    if (ln.color) g.fillStyle = ln.color;
    g.fillText(ln.text, w / 2, h * ((i + 0.5) / lines.length));
    g.fillStyle = opts.ink || P.signInk;
  });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

const signPlane = (tex, w, h, double = true) => new THREE.Mesh(
  new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: double ? THREE.DoubleSide : THREE.FrontSide })
);

/* ---------- scene pieces ---------- */

function buildCity(P) {
  const g = new THREE.Group();
  const n = DATA.byYear.length;
  const span = (n - 1) * S.spacing;

  DATA.byYear.forEach(([yr, v], i) => {
    const h = (v / maxV) * S.maxHeight;
    const floors = Math.max(2, Math.round(h / 3.4));
    const x = i * S.spacing - span / 2;

    const sideTex = windowTexture(i + 1, floors, S.theme);
    sideTex.wrapS = sideTex.wrapT = THREE.ClampToEdgeWrapping;
    const plain = new THREE.MeshStandardMaterial({ color: P.facade, roughness: 0.92, metalness: 0 });
    const glass = new THREE.MeshStandardMaterial({
      map: sideTex, roughness: 0.75, metalness: 0,
      emissiveMap: S.theme === 'night' ? sideTex : null,
      emissive: S.theme === 'night' ? 0xffffff : 0x000000,
      emissiveIntensity: S.theme === 'night' ? 0.85 : 0,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: P.roof, roughness: 0.95 });
    // order: +x, -x, +y, -y, +z, -z
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(S.footprint, h, S.footprint),
      [glass, glass, roofMat, roofMat, glass, plain]
    );
    box.position.set(x, h / 2, 0);
    box.castShadow = box.receiveShadow = true;
    g.add(box);

    // Cornice, so the rooflines aren't bare cubes.
    const cor = new THREE.Mesh(
      new THREE.BoxGeometry(S.footprint + 0.7, 0.55, S.footprint + 0.7),
      new THREE.MeshStandardMaterial({ color: P.trim, roughness: 0.9 })
    );
    cor.position.set(x, h + 0.2, 0);
    cor.castShadow = true;
    g.add(cor);

    if (i % 2 === 0) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), roofMat);
      ch.position.set(x - 2, h + 1.4, -1.8); ch.castShadow = true; g.add(ch);
    }

    // Year plaque standing on the far pavement.
    const plaque = signPlane(signTexture(
      [{ text: `'${String(yr).slice(2)}`, size: 62 }, { text: v.toLocaleString('en-US'), size: 44, weight: 500 }],
      S.theme, { w: 256, h: 160, border: false, bg: 'rgba(0,0,0,0)', ink: S.theme === 'night' ? '#cdd4f5' : '#2b2822' }
    ), 3.6, 2.2);
    plaque.position.set(x, 1.6, S.footprint / 2 + 2.2);
    g.add(plaque);
  });
  return g;
}

function buildStreet(P) {
  const g = new THREE.Group();
  const n = DATA.byYear.length;
  const L = (n + 4) * S.spacing;
  const z0 = S.footprint / 2;

  const slab = (w, d, z, color, y = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.96 }));
    m.position.set(0, y, z); m.receiveShadow = true; g.add(m); return m;
  };

  slab(L, 6, z0 + 3, P.pave, 0.2);                       // far pavement
  slab(L, 0.8, z0 + 6.3, P.kerb, 0.32);
  slab(L, 2.4, z0 + 7.7, P.bike, 0.12);                  // bike lane
  slab(L, S.streetWidth, z0 + 15.5, P.road, 0.08);       // carriageway
  slab(L, 0.8, z0 + 22.4, P.kerb, 0.32);
  slab(L, 9, z0 + 27.3, P.pave, 0.2);                    // near pavement

  [z0 + 12.5, z0 + 15.2].forEach((z) => {                // tram rails
    const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.34),
      new THREE.MeshStandardMaterial({ color: P.rail, roughness: 0.4, metalness: 0.75 }));
    r.position.set(0, 0.3, z); g.add(r);
  });

  for (let x = -L / 2 + 3; x < L / 2; x += 7) {          // lane dashes
    const d = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.28),
      new THREE.MeshBasicMaterial({ color: S.theme === 'night' ? 0x4a5185 : 0xefece3 }));
    d.position.set(x, 0.3, z0 + 19.5); g.add(d);
  }
  return g;
}

function lampPost(P, x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: P.trim, roughness: 0.7, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 10), mat);
  pole.position.y = 5.5; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.22), mat);
  arm.position.set(1.3, 11, 0); g.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshBasicMaterial({ color: P.lamp }));
  head.position.set(2.5, 10.8, 0); g.add(head);
  if (P.lampI > 0) {
    const l = new THREE.PointLight(P.lamp, P.lampI, 34, 2);
    l.position.set(2.5, 10.4, 0);
    g.add(l); lampLights.push(l);
  }
  g.position.set(x, 0.4, z);
  return g;
}

function buildFurniture(P) {
  const g = new THREE.Group();
  const n = DATA.byYear.length;
  const span = (n - 1) * S.spacing;
  const zNear = S.footprint / 2 + 26;
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

  // Späti on the corner, with a warm light inside.
  const spati = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(11, 7.5, 7), mat(P.facade));
  body.position.y = 3.75; body.castShadow = body.receiveShadow = true; spati.add(body);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4),
    new THREE.MeshBasicMaterial({ color: P.spati }));
  win.position.set(-1.2, 4.2, 3.55); spati.add(win);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 2.4), mat(0xff4d9d, 0.7));
  awn.position.set(0, 7.4, 4.2); awn.rotation.x = -0.2; awn.castShadow = true; spati.add(awn);
  const sSign = signPlane(signTexture([{ text: 'SPÄTI 24H', size: 62 }], S.theme, { w: 512, h: 110 }), 8, 1.7);
  sSign.position.set(0, 9, 3.6); spati.add(sSign);
  if (S.theme === 'night') {
    const l = new THREE.PointLight(P.spati, 2.4, 30, 2);
    l.position.set(-1, 4.5, 5); spati.add(l); lampLights.push(l);
  }
  spati.position.set(-span / 2 - 15, 0.4, zNear - 2);
  g.add(spati);

  // Berlin street sign.
  const post = (h, x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, h, 8), mat(P.trim, 0.6));
    p.position.set(x, h / 2 + 0.4, z); p.castShadow = true; return p;
  };
  g.add(post(8.4, -span / 2 + 2, zNear));
  const st = signPlane(signTexture([{ text: 'NAVIDABDI-STR.', size: 60 }], S.theme, { w: 640, h: 128 }), 10.6, 2.1);
  st.position.set(-span / 2 + 2, 8.2, zNear); g.add(st);
  const st2 = signPlane(signTexture([{ text: `${DATA.district}          1–${DATA.repos}`, size: 44, weight: 500 }], S.theme, { w: 640, h: 96 }), 10.6, 1.6);
  st2.position.set(-span / 2 + 2, 6.5, zNear); g.add(st2);

  // Ampelmännchen: box, two lenses, a status plate above.
  const ax = -span / 2 + 17;
  g.add(post(7.6, ax, zNear));
  const tlBox = new THREE.Mesh(new THREE.BoxGeometry(2, 4.4, 1.2), mat(0x14161f, 0.8));
  tlBox.position.set(ax, 9.6, zNear); tlBox.castShadow = true; g.add(tlBox);
  const lens = (y, col) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), new THREE.MeshBasicMaterial({ color: col }));
    m.position.set(ax, y, zNear + 0.63); return m;
  };
  g.add(lens(10.7, 0x3a1418));
  const green = lens(8.6, 0x3fd06b); g.add(green);
  const amp = signPlane(signTexture([{ text: 'OPEN TO COLLAB', size: 46 }], S.theme,
    { w: 640, h: 96, bg: 'rgba(0,0,0,0)', border: false, ink: '#3fd06b' }), 9, 1.4);
  amp.position.set(ax, 12.6, zNear); g.add(amp);

  // U-Bahn and S-Bahn plates.
  const ux = -span / 2 + 34;
  g.add(post(7.8, ux, zNear));
  const uSq = signPlane(signTexture([{ text: 'U', size: 150 }], S.theme,
    { w: 256, h: 256, bg: '#00539f', ink: '#ffffff', border: false }), 3.4, 3.4);
  uSq.position.set(ux, 10.6, zNear); g.add(uSq);
  const uPl = signPlane(signTexture([{ text: `SEIT ${DATA.byYear[0][0]}`, size: 54 }], S.theme, { w: 512, h: 110 }), 7, 1.5);
  uPl.position.set(ux, 8, zNear); g.add(uPl);

  const sx = -span / 2 + 50;
  g.add(post(7, sx, zNear));
  const sCirc = signPlane(signTexture([{ text: 'S', size: 150 }], S.theme,
    { w: 256, h: 256, bg: 'rgba(0,0,0,0)', ink: '#ffffff', border: false }), 3.2, 3.2);
  const sBack = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), new THREE.MeshBasicMaterial({ color: 0x00823c }));
  sBack.position.set(sx, 9.6, zNear - 0.02); g.add(sBack);
  sCirc.position.set(sx, 9.6, zNear); g.add(sCirc);
  const sPl = signPlane(signTexture([{ text: `${DATA.stars} STARS`, size: 54 }], S.theme, { w: 512, h: 110 }), 6.4, 1.4);
  sPl.position.set(sx, 7.2, zNear); g.add(sPl);

  // Litfaßsäule — cylinder, crown, and the view count wrapped around it.
  const lx = -span / 2 + 66;
  const col = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 9, 24), mat(P.facade));
  drum.position.y = 4.5; drum.castShadow = drum.receiveShadow = true; col.add(drum);
  const poster = new THREE.Mesh(new THREE.CylinderGeometry(2.13, 2.13, 5.4, 24, 1, true),
    new THREE.MeshBasicMaterial({
      map: signTexture([
        { text: 'PROFILE VIEWS', size: 40, weight: 500 },
        { text: DATA.views.toLocaleString('en-US'), size: 86 },
      ], S.theme, { w: 1024, h: 320, border: false }),
      side: THREE.DoubleSide,
    }));
  poster.position.y = 5.1; col.add(poster);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.6, 1.6, 24), mat(P.roof));
  crown.position.y = 9.8; crown.castShadow = true; col.add(crown);
  col.position.set(lx, 0.4, zNear - 1);
  g.add(col);

  g.add(lampPost(P, -span / 2 + 26, zNear + 1.5));
  g.add(lampPost(P, -span / 2 + 60, zNear + 1.5));
  g.add(lampPost(P, -span / 2 + 92, zNear + 1.5));
  return g;
}

function buildTurm(P) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: P.turm, roughness: 0.85 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.6, 46, 18), m);
  shaft.position.y = 23; shaft.castShadow = true; g.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(4.4, 24, 18),
    new THREE.MeshStandardMaterial({ color: P.turm, roughness: 0.35, metalness: 0.55 }));
  ball.position.y = 48; ball.castShadow = true; g.add(ball);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 4.45, 1.5, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: S.theme === 'night' ? 0xc8d4ff : 0x8e9aa8, side: THREE.DoubleSide }));
  band.position.y = 48.6; g.add(band);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 24, 10), m);
  ant.position.y = 64; g.add(ant);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
  beacon.position.y = 76.5; g.add(beacon);
  g.userData.beacon = beacon;
  const span = (DATA.byYear.length - 1) * S.spacing;
  g.position.set(span / 2 + 34, 0, -26);
  return g;
}

function buildTram(P) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: P.tram, roughness: 0.55, metalness: 0.15 });
  for (let s = 0; s < 2; s++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(11.5, 3.4, 2.9), bodyMat);
    car.position.set(s * 12 - 6, 2.4, 0); car.castShadow = true; g.add(car);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 3.0),
      new THREE.MeshBasicMaterial({ color: S.theme === 'night' ? 0x2a3358 : 0x9aa3b5 }));
    strip.position.set(s * 12 - 6, 3.2, 0); g.add(strip);
  }
  const dest = signPlane(signTexture([{ text: 'M10  NAVIDABDI-STR.', size: 48 }], S.theme,
    { w: 640, h: 96, bg: 'rgba(0,0,0,0)', border: false, ink: '#1a1a1f' }), 8, 1.2, false);
  dest.position.set(-6, 1.6, 1.5); g.add(dest);
  const pan = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: P.trim, metalness: 0.8, roughness: 0.3 }));
  pan.position.set(0, 4.6, 0); g.add(pan);
  g.position.set(0, 0.35, S.footprint / 2 + 13.8);
  return g;
}

function buildTrabi(P) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: P.trabi, roughness: 0.6, metalness: 0.1 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.3, 2.3), m);
  lower.position.y = 1.05; lower.castShadow = true; g.add(lower);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.1), m);
  cabin.position.set(-0.2, 2.2, 0); cabin.castShadow = true; g.add(cabin);
  const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
  const wm = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.9 });
  [[-1.6, 1.15], [-1.6, -1.15], [1.6, 1.15], [1.6, -1.15]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheel, wm);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w);
  });
  const span = (DATA.byYear.length - 1) * S.spacing;
  g.position.set(-span / 2 + 41, 0.35, S.footprint / 2 + 21);
  return g;
}

function buildRain(P) {
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 220;
    pos[i * 3 + 1] = Math.random() * 90;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 130 + 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: P.rain, size: 0.34, transparent: true, opacity: P.rainO, depthWrite: false,
  }));
  return pts;
}

function buildStars() {
  const n = 420, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 260, t = Math.random() * Math.PI * 2, p = Math.random() * 0.42 + 0.05;
    pos[i * 3] = Math.cos(t) * Math.sin(p) * r;
    pos[i * 3 + 1] = Math.cos(p) * r;
    pos[i * 3 + 2] = Math.sin(t) * Math.sin(p) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.85 }));
}

/* ---------- assembly ---------- */

function rebuild() {
  const P = PALETTE[S.theme];
  lampLights = []; movers = [];
  if (root) { scene.remove(root); disposeTree(root); }
  root = new THREE.Group();

  scene.background = new THREE.Color(P.sky);
  scene.fog = new THREE.Fog(P.fog, 110, 285);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: P.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  root.add(ground);

  root.add(buildStreet(P));
  root.add(buildCity(P));
  root.add(buildFurniture(P));
  const turm = buildTurm(P); root.add(turm);
  const tram = buildTram(P); root.add(tram);
  root.add(buildTrabi(P));
  if (S.theme === 'night') root.add(buildStars());
  rainPts = S.rain ? buildRain(P) : null;
  if (rainPts) root.add(rainPts);

  movers.push({ obj: tram, kind: 'tram' }, { obj: turm, kind: 'turm' });

  scene.add(root);
}

function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const m = n.material;
    if (Array.isArray(m)) m.forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); });
    else if (m) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function placeCamera() {
  const a = (S.camAngle * Math.PI) / 180;
  camera.fov = S.fov;
  camera.position.set(Math.sin(a) * S.camDist, S.camHeight, Math.cos(a) * S.camDist);
  camera.lookAt(0, 10, 6);
  camera.updateProjectionMatrix();
}

function init(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(S.fov, 16 / 9, 0.5, 900);
  clock = new THREE.Clock();

  const P = PALETTE[S.theme];
  const sun = new THREE.DirectionalLight(P.sun, P.sunI);
  sun.position.set(-70, 96, 66);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 105;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 320 });
  sun.shadow.bias = -0.0009;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(P.amb, P.ambI));
  scene.userData.sun = sun;

  rebuild();
  placeCamera();
  resize();
  animate();
}

function refreshLights() {
  const P = PALETTE[S.theme];
  const sun = scene.userData.sun;
  sun.color.setHex(P.sun); sun.intensity = P.sunI;
  scene.children.forEach((c) => {
    if (c.isAmbientLight) { c.color.setHex(P.amb); c.intensity = P.ambI; }
  });
}

function resize() {
  const c = renderer.domElement;
  const w = c.clientWidth, h = Math.round(w * 9 / 16);
  if (c.width !== w * Math.min(devicePixelRatio, 2) || c.height !== h * Math.min(devicePixelRatio, 2)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  raf = requestAnimationFrame(animate);
  resize();
  const t = clock.getElapsedTime();
  const dt = Math.min(clock.getDelta(), 0.05);

  if (S.motion) {
    const span = (DATA.byYear.length - 1) * S.spacing;
    movers.forEach(({ obj, kind }) => {
      if (kind === 'tram') {
        obj.position.x -= dt * 13;
        if (obj.position.x < -span / 2 - 70) obj.position.x = span / 2 + 70;
      }
      if (kind === 'turm') obj.userData.beacon.visible = (t % 2.2) < 1;
    });
    if (rainPts) {
      const p = rainPts.geometry.attributes.position;
      for (let i = 1; i < p.array.length; i += 3) {
        p.array[i] -= dt * 46;
        if (p.array[i] < 0) p.array[i] = 90;
      }
      p.needsUpdate = true;
    }
    lampLights.forEach((l, i) => {
      l.intensity = l.userData.base ?? (l.userData.base = l.intensity);
      l.intensity *= 0.97 + 0.03 * Math.sin(t * 1.7 + i);
    });
  }
  renderer.render(scene, camera);
}

/* ---------- orbit (hand-rolled: OrbitControls is not in the core UMD build) ---------- */

function attachOrbit(canvas) {
  let dragging = false, lx = 0, ly = 0;
  const down = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const up = (e) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} };
  const move = (e) => {
    if (!dragging) return;
    S.camAngle = Math.max(-80, Math.min(80, S.camAngle - (e.clientX - lx) * 0.28));
    S.camHeight = Math.max(4, Math.min(120, S.camHeight + (e.clientY - ly) * 0.35));
    lx = e.clientX; ly = e.clientY;
    syncInputs(); placeCamera();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    S.camDist = Math.max(35, Math.min(260, S.camDist + e.deltaY * 0.12));
    syncInputs(); placeCamera();
  }, { passive: false });
}

/* ---------- controls ---------- */

const INPUTS = [
  ['spacing', 'Street spacing', 8, 22, 0.5, () => rebuild()],
  ['footprint', 'Building width', 4, 11, 0.2, () => rebuild()],
  ['maxHeight', 'Tallest building', 18, 60, 1, () => rebuild()],
  ['streetWidth', 'Road width', 8, 26, 0.5, () => rebuild()],
  ['camDist', 'Camera distance', 35, 260, 1, () => placeCamera()],
  ['camHeight', 'Camera height', 4, 120, 1, () => placeCamera()],
  ['camAngle', 'Camera angle', -80, 80, 1, () => placeCamera()],
  ['fov', 'Lens (field of view)', 18, 70, 1, () => placeCamera()],
];

function syncInputs() {
  INPUTS.forEach(([key]) => {
    const el = document.getElementById('c-' + key);
    if (!el) return;
    el.value = S[key];
    const out = document.getElementById('v-' + key);
    if (out) out.textContent = Number(S[key]).toFixed(key === 'spacing' || key === 'footprint' ? 1 : 0);
  });
}

function buildControls(host) {
  host.innerHTML = INPUTS.map(([key, label, min, max, step]) => `
    <label class="ctl" for="c-${key}">
      <span class="ctl-l">${label}</span>
      <input id="c-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}">
      <output id="v-${key}" class="ctl-v">${S[key]}</output>
    </label>`).join('');
  INPUTS.forEach(([key, , , , , after]) => {
    document.getElementById('c-' + key).addEventListener('input', (e) => {
      S[key] = parseFloat(e.target.value);
      syncInputs();
      after();
    });
  });
  syncInputs();
}

// Replace the baked fallback with whatever the weekly job wrote.
function setData(next) {
  if (!next || !Array.isArray(next.byYear) || !next.byYear.length) return false;
  DATA = Object.assign(DATA, next);
  maxV = Math.max(...DATA.byYear.map((d) => d[1]));
  return true;
}

const getData = () => DATA;

window.CITY = { init, attachOrbit, buildControls, rebuild, placeCamera, refreshLights, setData, getData, S };
