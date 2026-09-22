import { MONO, esc, n, counter, COUNTER_CSS } from './svg.mjs';

// A street corner in Berlin, drawn from a GitHub profile.
// Dark is night; light is the city's honest default weather.
// Every piece of furniture is a real Berlin object: Fernsehturm, Ampelmännchen,
// Litfaßsäule (invented here), the white enamel street sign, the U-Bahn plate,
// and a BVG double-decker on the M-line.
const PALETTE = {
  dark: {
    sky1:'#080c22', sky2:'#1d2450', sky3:'#3a2f55',
    star:'#ffffff', moon:'#f4eccd',
    far:'#181e42', turm:'#232a56', turmLit:'#8f9ee0', turmGlass:'#c8d4ff',
    face:'#262e5e', side:'#161c40', roof:'#333c76', edge:'#4b56a0',
    winOn:'#ffcf6b', winOn2:'#ffb347', winGh:'#39d353', winOff:'#1b2148',
    road:'#11142c', roadLine:'#4a5185', kerb:'#2c3465', pave:'#1e2450', paveLine:'#2b3266',
    lamp:'#ffd98a', lampGlow:'#ffbf4d',
    text:'#cdd4f5', dim:'#7c85c0', bright:'#ffffff', rule:'#2b3266',
    neonA:'#ff4d9d', neonB:'#4ddbff', neonC:'#ffd93d', neonD:'#5ef08a',
    signBg:'#f4f2ec', signInk:'#15161c', uBlue:'#00539f', sGreen:'#00823c',
    bus:'#f5c518', busDark:'#c99b0d', busGlass:'#2a3358',
    railHi:'#5d6699', railLo:'#0e1128', tram:'#f2d024', tramDark:'#b99a10',
    spati:'#232a55', spatiLit:'#ffd479', trabi:'#cfd8e8', trabiDark:'#8e9ab5',
    rain:'#9fb0ff', wet:'#7c88d8',
  },
  light: {
    sky1:'#cfd9e4', sky2:'#e6e9e6', sky3:'#f2efe6',
    star:'#ffffff', moon:'#fdfbf2',
    far:'#c2c7c9', turm:'#cdcabf', turmLit:'#a9a89d', turmGlass:'#8e9aa8',
    face:'#ece6d9', side:'#d3ccbb', roof:'#bdb5a3', edge:'#a79e8a',
    winOn:'#6d7789', winOn2:'#59637a', winGh:'#2f6f4f', winOff:'#c7c0b0',
    road:'#b3afa6', roadLine:'#efece3', kerb:'#cdc7ba', pave:'#d9d3c6', paveLine:'#c6bfb0',
    lamp:'#8a8375', lampGlow:'#c9c2b2',
    text:'#2b2822', dim:'#726b5d', bright:'#14120e', rule:'#c6bfb0',
    neonA:'#c2185b', neonB:'#00707f', neonC:'#9a6b00', neonD:'#2f7d4a',
    signBg:'#fbfaf6', signInk:'#15161c', uBlue:'#00539f', sGreen:'#00823c',
    bus:'#e8bc12', busDark:'#b08c07', busGlass:'#9aa3b5',
    railHi:'#8d887c', railLo:'#cfc9bc', tram:'#e8c41a', tramDark:'#a8870b',
    spati:'#dcd5c6', spatiLit:'#ffe9a8', trabi:'#e4e0d6', trabiDark:'#b5ae9d',
    rain:'#8f9aa8', wet:'#a8b0bc',
  },
};

const W = 880;
const KX = 1.12, KY = 0.13;   // along the street
const DX = 0.50, DY = 0.62;   // into the scene — steeper, so the road has a near kerb
const SP = 52, FP = 42, MAXH = 150;

export function scene(D, t) {
  const c = PALETTE[t];
  const night = t === 'dark';
  const maxV = Math.max(...D.byYear.map(y => y[1]));
  const pr = (wx, wy, wz) => [wx * KX - wy * DX, wx * KY + wy * DY - wz];

  const towers = D.byYear.map(([yr, v], i) => ({
    yr, v, i, x: i * SP, h: Math.round((v / maxV) * MAXH),
  }));

  const tallest = towers.reduce((a, b) => (b.v > a.v ? b : a));
  const latest = towers[towers.length - 1];

  const xs = towers.flatMap(o => [pr(o.x, FP, 0)[0], pr(o.x + FP, 0, 0)[0]]);
  const OX = (W - (Math.max(...xs) - Math.min(...xs))) / 2 - Math.min(...xs);
  const OY = 196;
  const P = (wx, wy, wz) => { const [a, b] = pr(wx, wy, wz); return [+(a + OX).toFixed(1), +(b + OY).toFixed(1)]; };
  const poly = (pts) => pts.map(q => q.join(',')).join(' ');

  const X_LO = -96, X_HI = towers[towers.length - 1].x + FP + 96;
  const Y_PAVE = FP, Y_KERB = 62, Y_BIKE = 66, Y_LANE = 78, Y_ROAD = 116, Y_NEAR = 120, Y_FRONT = 150;
  const Y_FURN = 138;   // where the street furniture stands, on the near pavement

  /* ---------- sky ---------- */
  let stars = '';
  if (night) {
    for (let i = 0; i < 64; i++) {
      const sx = (i * 137.5) % W, sy = 12 + ((i * 61.8) % 150), r = (i % 5) ? 0.9 : 1.5;
      stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r}" fill="${c.star}" class="tw" style="animation-delay:${((i % 13) * 0.42).toFixed(2)}s;--o:${(i % 4) ? .55 : .9}"/>`;
    }
  }
  const moon = night
    ? `<circle cx="126" cy="66" r="21" fill="${c.moon}" opacity=".92"/><circle cx="116" cy="60" r="19" fill="${c.sky1}" opacity=".85"/>`
    : `<circle cx="126" cy="66" r="26" fill="${c.moon}" opacity=".55"/>`;
  const cloud = (x, y, s, dur, delay, op) =>
    `<g class="drift" style="animation-duration:${dur}s;animation-delay:-${delay}s" opacity="${op}">`
    + `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<ellipse cx="0" cy="0" rx="46" ry="13" fill="${night ? c.sky3 : '#ffffff'}"/>`
    + `<ellipse cx="26" cy="-7" rx="30" ry="12" fill="${night ? c.sky3 : '#ffffff'}"/>`
    + `<ellipse cx="-24" cy="-4" rx="24" ry="10" fill="${night ? c.sky3 : '#ffffff'}"/></g></g>`;
  const clouds = cloud(-80, 58, 1, 74, 0, night ? .26 : .95)
    + cloud(-260, 108, .72, 96, 30, night ? .2 : .8)
    + cloud(-460, 32, .9, 120, 62, night ? .16 : .7);

  /* ---------- Fernsehturm ---------- */
  const FT_X = 838, FT_BASE = 316;
  const turm = `<g class="ft">
<polygon points="${FT_X - 13},${FT_BASE} ${FT_X + 13},${FT_BASE} ${FT_X + 5},142 ${FT_X - 5},142" fill="${c.turm}"/>
<polygon points="${FT_X - 13},${FT_BASE} ${FT_X - 5},142 ${FT_X - 1},142 ${FT_X - 4},${FT_BASE}" fill="${c.far}" opacity=".55"/>
<circle cx="${FT_X}" cy="126" r="22" fill="${c.turm}"/>
<path d="M${FT_X - 22} 126a22 22 0 0 1 44 0z" fill="${c.turmLit}" opacity=".55"/>
<rect x="${FT_X - 22}" y="120" width="44" height="9" fill="${c.turmGlass}" opacity=".85"/>
<circle cx="${FT_X}" cy="126" r="22" fill="none" stroke="${c.edge}" stroke-width=".8" opacity=".6"/>
<polygon points="${FT_X - 4},104 ${FT_X + 4},104 ${FT_X + 2},62 ${FT_X - 2},62" fill="${c.turm}"/>
<rect x="${FT_X - 1.3}" y="26" width="2.6" height="38" fill="${c.turm}"/>
<circle cx="${FT_X}" cy="24" r="3.4" fill="#ff4d4d" class="beacon"/>
<g class="shimmer"><path d="M${FT_X - 20} 118a22 22 0 0 1 9-12l5 4a22 22 0 0 0-9 12z" fill="${c.turmGlass}" opacity=".5"/></g>
</g>`;

  /* ---------- towers ---------- */
  let city = '', clips = '', roofstuff = '';
  towers.forEach(o => {
    const { x, h, i } = o;
    const top   = [P(x, 0, h), P(x + FP, 0, h), P(x + FP, FP, h), P(x, FP, h)];
    const right = [P(x + FP, 0, 0), P(x + FP, FP, 0), P(x + FP, FP, h), P(x + FP, 0, h)];
    const left  = [P(x, FP, 0), P(x + FP, FP, 0), P(x + FP, FP, h), P(x, FP, h)];

    const floors = Math.max(1, Math.floor(h / 18));
    let wins = '';
    for (let f = 0; f < floors; f++) {
      const z0 = 8 + f * 18, z1 = z0 + 9;
      if (z1 > h - 4) break;
      for (let k = 0; k < 3; k++) {
        const u0 = 6 + k * 11.5, u1 = u0 + 7.5;
        const seed = (i * 7 + f * 3 + k * 5);
        const on = night ? (seed % 11) < 7 : true;
        const gh = night && (seed % 17) === 0;
        const fl = (seed % 23) === 0;
        const dl = (0.9 + i * 0.12 + f * 0.05 + k * 0.03).toFixed(2);
        const col = !night ? c.winOn : gh ? c.winGh : (seed % 3 ? c.winOn : c.winOn2);
        wins += `<polygon points="${poly([P(x + u0, FP, z0), P(x + u1, FP, z0), P(x + u1, FP, z1), P(x + u0, FP, z1)])}" fill="${on ? col : c.winOff}" class="w${fl ? ' fl' : ''}" style="--o:${on ? 1 : .5};animation-delay:${dl}s"/>`;
        wins += `<polygon points="${poly([P(x + FP, u0, z0), P(x + FP, u1, z0), P(x + FP, u1, z1), P(x + FP, u0, z1)])}" fill="${on ? col : c.winOff}" class="w" style="--o:${on ? .72 : .38};animation-delay:${(+dl + 0.05).toFixed(2)}s"/>`;
      }
    }

    const gtop = P(x, FP, 0), gtopz = P(x, 0, h + 10);
    clips += `<clipPath id="bc${i}"><rect x="${P(x, FP, 0)[0] - 6}" y="${gtopz[1]}" width="${(FP * (KX + DX) + 14).toFixed(1)}" height="${(gtop[1] - gtopz[1] + 8).toFixed(1)}" class="clip" style="animation-delay:${(0.3 + i * 0.12).toFixed(2)}s"/></clipPath>`;

    city += `<g clip-path="url(#bc${i})">`
      + `<polygon points="${poly(right)}" fill="${c.side}"/>`
      + `<polygon points="${poly(left)}" fill="${c.face}"/>`
      + wins
      + `<polygon points="${poly(top)}" fill="${c.roof}"/>`
      + `<polyline points="${poly([left[3], left[2], right[3]])}" fill="none" stroke="${c.edge}" stroke-width=".9"/>`
      + `<line x1="${left[1][0]}" y1="${left[1][1]}" x2="${left[2][0]}" y2="${left[2][1]}" stroke="${c.edge}" stroke-width=".9"/>`
      + `</g>`;

    // Rooftop clutter: chimneys and aerials, so the skyline edge isn't a clean sawtooth.
    if (i % 2 === 0) {
      const ch = P(x + 10, 10, h);
      roofstuff += `<g class="lab" style="animation-delay:${(1.5 + i * 0.1).toFixed(2)}s"><rect x="${ch[0] - 3}" y="${ch[1] - 11}" width="6" height="11" fill="${c.roof}" stroke="${c.edge}" stroke-width=".6"/></g>`;
    } else {
      const an = P(x + 28, 12, h);
      roofstuff += `<g class="lab" style="animation-delay:${(1.5 + i * 0.1).toFixed(2)}s"><line x1="${an[0]}" y1="${an[1]}" x2="${an[0]}" y2="${an[1] - 15}" stroke="${c.edge}" stroke-width="1"/>`
        + `<line x1="${an[0] - 4}" y1="${an[1] - 12}" x2="${an[0] + 4}" y2="${an[1] - 12}" stroke="${c.edge}" stroke-width="1"/></g>`;
    }
  });

  /* ---------- rooftop neon ---------- */
  const neonOn = (x, y, w, h, col, label, value, delay, cls) => `
<g class="neon ${cls}" style="animation-delay:${delay}s">
 <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${night ? '#0006' : '#fff8'}" stroke="${col}" stroke-width="1.6"/>
 <text x="${x + w / 2}" y="${y + 13}" class="nlab" fill="${col}">${label}</text>
 <text x="${x + w / 2}" y="${y + h - 7}" class="nval" fill="${col}">${value}</text>
</g>`;
  const nA = P(towers[6].x + 4, 6, towers[6].h);
  const nB = P(towers[8].x + 2, 6, towers[8].h);
  const nC = P(towers[1].x + 2, 6, towers[1].h);
  const neon =
      neonOn(nA[0] - 6, nA[1] - 40, 104, 34, c.neonA, `${latest.yr} SO FAR`, n(latest.v), '2.2', 'fk1')
    + neonOn(nB[0] - 12, nB[1] - 40, 96, 34, c.neonB, 'FOLLOWERS', n(D.followers), '2.5', 'fk2')
    + neonOn(nC[0] - 10, nC[1] - 36, 92, 30, c.neonD, 'STATUS', 'OFFEN', '2.8', 'fk3');

  /* ---------- street ---------- */
  const band = (y0, y1, fill) => `<polygon points="${poly([P(X_LO, y0, 0), P(X_HI, y0, 0), P(X_HI, y1, 0), P(X_LO, y1, 0)])}" fill="${fill}"/>`;
  let dashes = '';
  for (let x = X_LO + 20; x < X_HI; x += 46) {
    const a = P(x, 97, 0), b = P(x + 24, 97, 0);
    dashes += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.roadLine}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  }
  // Tram rails: two grooved lines set into the asphalt, not sleepers on ballast.
  const rail = (wy) => {
    const a = P(X_LO, wy, 0), b = P(X_HI, wy, 0);
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.railHi}" stroke-width="2.4" stroke-linecap="round"/>`
      + `<line x1="${a[0]}" y1="${a[1] + 1.4}" x2="${b[0]}" y2="${b[1] + 1.4}" stroke="${c.railLo}" stroke-width="1" stroke-linecap="round"/>`;
  };
  let flags = '';
  for (let x = X_LO; x < X_HI; x += 26) {
    const a = P(x, Y_NEAR + 3, 0), b = P(x, Y_FRONT - 2, 0);
    flags += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c.paveLine}" stroke-width=".8"/>`;
  }
  const street = band(Y_PAVE, Y_KERB, c.pave) + flags
    + band(Y_KERB, Y_BIKE, c.kerb)
    + band(Y_BIKE, Y_LANE, night ? '#6b2f3a' : '#c99a86')
    + band(Y_LANE, Y_ROAD, c.road) + dashes
    + band(Y_ROAD, Y_NEAR, c.kerb)
    + band(Y_NEAR, Y_FRONT, c.pave)
    + rail(83) + rail(91);

  /* ---------- street furniture (billboard sprites on the pavement) ---------- */
  const at = (wx, wy) => { const q = P(wx, wy, 0); return `translate(${q[0]} ${q[1]})`; };
  // Outer <g> positions, inner <g> animates — see the note in the stylesheet.
  const place = (wx, wy, d, body) => `<g transform="${at(wx, wy)}"><g class="lab" style="animation-delay:${d}s">${body}</g></g>`;

  const lamp = (wx, d) => place(wx, Y_FURN, d, `
<ellipse cx="18" cy="0" rx="42" ry="11" fill="url(#lampG)" class="glow"/>
<rect x="-2" y="-74" width="4" height="74" fill="${c.edge}"/>
<path d="M0 -74q0 -14 18 -14" fill="none" stroke="${c.edge}" stroke-width="4"/>
<ellipse cx="18" cy="-88" rx="34" ry="30" fill="url(#lampG)" class="glow"/>
<ellipse cx="18" cy="-88" rx="9" ry="4.5" fill="${c.lamp}"/>`);

  const streetSign = (wx, d) => place(wx, Y_FURN, d, `
<rect x="-1.8" y="-62" width="3.6" height="62" fill="${c.edge}"/>
<g transform="translate(-86 -86)">
 <rect width="172" height="30" rx="2" fill="${c.signBg}" stroke="${c.signInk}" stroke-width="1.4"/>
 <rect x="3" y="3" width="166" height="24" rx="1" fill="none" stroke="${c.signInk}" stroke-width=".7"/>
 <text x="86" y="20" class="stName">NAVIDABDI-STR.</text>
</g>
<g transform="translate(-86 -54)">
 <rect width="172" height="19" rx="2" fill="${c.signBg}" stroke="${c.signInk}" stroke-width="1.1"/>
 <text x="9" y="13.5" class="stSub">${D.district}</text>
 <text x="163" y="13.5" class="stSubR">1&#8211;${D.repos}</text>
</g>`);

  const ubahn = (wx, d) => place(wx, Y_FURN, d, `
<rect x="-1.6" y="-68" width="3.2" height="68" fill="${c.edge}"/>
<rect x="-21" y="-104" width="42" height="42" rx="2" fill="${c.uBlue}"/>
<text x="0" y="-72" class="uMark">U</text>
<rect x="-52" y="-60" width="104" height="20" rx="2" fill="${c.signBg}" stroke="${c.signInk}" stroke-width="1"/>
<text x="0" y="-46" class="stStation">SEIT ${D.since}</text>`);

  const sbahn = (wx, d) => place(wx, Y_FURN, d, `
<rect x="-1.4" y="-58" width="2.8" height="58" fill="${c.edge}"/>
<circle cx="0" cy="-74" r="20" fill="${c.sGreen}"/>
<text x="0" y="-67" class="uMark">S</text>
<rect x="-46" y="-48" width="92" height="19" rx="2" fill="${c.signBg}" stroke="${c.signInk}" stroke-width="1"/>
<text x="0" y="-34.5" class="stStation">${D.stars} STARS</text>`);

  // Ampelmännchen — the account status light. Cycles red, rests on green.
  const ampel = (wx, d) => place(wx, Y_FURN, d, `
<rect x="-2.4" y="-66" width="4.8" height="66" fill="${c.edge}"/>
<rect x="-19" y="-116" width="38" height="62" rx="5" fill="${night ? '#14161f' : '#3a3d44'}" stroke="${c.edge}" stroke-width="1"/>
<circle cx="0" cy="-100" r="13" fill="${night ? '#2a1418' : '#2c2e33'}"/>
<circle cx="0" cy="-70" r="13" fill="${night ? '#14231a' : '#2c2e33'}"/>
<g class="ampRed"><circle cx="0" cy="-100" r="13" fill="#e8434a"/>
 <g fill="#2a0d10" transform="translate(0 -100)">
  <rect x="-6.5" y="-9.4" width="13" height="1.7" rx=".8"/>
  <circle cx="0" cy="-6" r="2.5"/>
  <rect x="-1.9" y="-3.4" width="3.8" height="5.6" rx="1"/>
  <rect x="-7.4" y="-2.9" width="14.8" height="1.9" rx=".9"/>
  <rect x="-4.6" y="2.2" width="2.9" height="5.4" rx="1" transform="rotate(10 -3 4)"/>
  <rect x="1.7" y="2.2" width="2.9" height="5.4" rx="1" transform="rotate(-10 3 4)"/>
 </g></g>
<g class="ampGreen"><circle cx="0" cy="-70" r="13" fill="#3fd06b"/>
 <g fill="#0b2a16" transform="translate(-1 -70)">
  <rect x="-5.6" y="-9.6" width="12.6" height="1.7" rx=".8" transform="rotate(-8 0 -8.8)"/>
  <circle cx="1" cy="-6.2" r="2.5"/>
  <rect x="-1.2" y="-3.6" width="4" height="5.6" rx="1.2" transform="rotate(8 .8 -.8)"/>
  <rect x="-6.4" y="-3.2" width="6.6" height="1.8" rx=".9" transform="rotate(28 -3 -2.3)"/>
  <rect x="2.4" y="-4.4" width="6.4" height="1.8" rx=".9" transform="rotate(-22 5.6 -3.5)"/>
  <rect x="-6.4" y="1.8" width="3" height="6.2" rx="1" transform="rotate(26 -5 5)"/>
  <rect x="1.8" y="1.6" width="3" height="6.4" rx="1" transform="rotate(-16 3.3 4.8)"/>
 </g></g>
<rect x="-56" y="-142" width="112" height="18" rx="2" fill="${c.neonD}" opacity="${night ? .18 : .24}" stroke="${c.neonD}" stroke-width="1" stroke-opacity=".6"/>
<text x="0" y="-129" class="statusTxt">OPEN TO COLLAB</text>`);

  // Litfaßsäule — the advertising column, a Berlin invention. Carries the view count.
  const litfass = (wx, d) => place(wx, Y_FURN, d, `
<ellipse cx="0" cy="0" rx="30" ry="7" fill="${night ? '#0006' : '#0002'}"/>
<path d="M-27 0v-96h54v96z" fill="${c.face}"/>
<path d="M-27 -96h20v96h-20z" fill="${c.side}" opacity=".7"/>
<ellipse cx="0" cy="-96" rx="27" ry="7" fill="${c.roof}"/>
<path d="M-31 -100h62l-6 -10h-50z" fill="${c.roof}" stroke="${c.edge}" stroke-width=".7"/>
<path d="M-15 -110h30l-15 -16z" fill="${c.roof}" stroke="${c.edge}" stroke-width=".7"/>
<rect x="-21" y="-86" width="42" height="56" rx="2" fill="${c.signBg}"/>
<text x="0" y="-72" class="posterK">PROFILE</text>
<text x="0" y="-62" class="posterK">VIEWS</text>
${counter(D.views, 0, -44, 'posterV', 2.6, 12, 1.5)}
<rect x="-21" y="-24" width="42" height="16" rx="1.5" fill="${c.neonC}" opacity=".9"/>
<text x="0" y="-12.5" class="posterS">BEST ${n(tallest.v)}</text>`);


  // Späti — the late-night corner shop. Its window is the warmest thing in the scene.
  const spati = (wx, d) => place(wx, Y_FURN + 4, d, `
<rect x="-56" y="-78" width="112" height="78" rx="3" fill="${c.spati}" stroke="${c.edge}" stroke-width="1"/>
<rect x="-56" y="-78" width="112" height="78" rx="3" fill="${c.side}" opacity=".35"/>
<rect x="-46" y="-62" width="58" height="40" rx="2" fill="${c.spatiLit}" class="spatiWin"/>
<rect x="-46" y="-62" width="58" height="9" fill="${c.tramDark}" opacity=".45"/>
<rect x="20" y="-58" width="26" height="58" rx="2" fill="${c.side}" stroke="${c.edge}" stroke-width=".8"/>
<circle cx="24" cy="-30" r="1.8" fill="${c.edge}"/>
<path d="M-62 -78h124l-8 -13h-108z" fill="${c.neonA}" opacity=".85"/>
<path d="M-62 -78h124" stroke="${c.edge}" stroke-width="1"/>
<rect x="-52" y="-98" width="104" height="17" rx="2" fill="${c.signBg}" stroke="${c.signInk}" stroke-width="1"/>
<text x="0" y="-85.5" class="spatiTxt">SP&#196;TI 24H</text>
<g fill="${c.tramDark}" opacity=".9">
 <rect x="-54" y="-14" width="17" height="14" rx="1.5"/><rect x="-35" y="-14" width="17" height="14" rx="1.5"/>
 <rect x="-45" y="-27" width="17" height="13" rx="1.5"/></g>
${night ? `<ellipse cx="-17" cy="-42" rx="62" ry="46" fill="url(#lampG)" class="glow"/>` : ''}`);

  const furniture = spati(0, 1.85) + streetSign(140, 1.95) + ampel(240, 2.05)
    + lamp(310, 2.15) + ubahn(390, 2.3) + sbahn(480, 2.4) + litfass(555, 2.5) + lamp(630, 2.6);

  /* ---------- vehicles ---------- */
  const travel = (id, x0, x1, wy, dur, delay) => {
    const a = P(x0, wy, 0), b = P(x1, wy, 0);
    return { kf: `@keyframes ${id}{from{transform:translate(${a[0]}px,${a[1]}px)}to{transform:translate(${b[0]}px,${b[1]}px)}}`,
             style: `animation-name:${id};animation-duration:${dur}s;animation-delay:${delay}s` };
  };

  const bikeT = travel('bikemv', X_HI + 90, X_LO - 110, 71, 13, 5.4);
  const tramT = travel('trammv', X_HI + 230, X_LO - 230, 94, 19, 4.2);


  let tramWin = '';
  for (let k = 0; k < 9; k++) tramWin += `<rect x="${-96 + k * 22}" y="-32" width="16" height="15" rx="2" fill="${c.busGlass}"/>`;
  const tram = `<g class="vehicle" style="${tramT.style}">
<rect x="-104" y="-40" width="208" height="34" rx="7" fill="${c.tram}"/>
<rect x="-104" y="-14" width="208" height="9" rx="3" fill="${c.tramDark}"/>
<rect x="-6" y="-40" width="8" height="34" fill="${c.tramDark}" opacity=".5"/>
${tramWin}
<rect x="-102" y="-38.5" width="204" height="3" rx="1.5" fill="#fff" opacity=".22"/>
<path d="M-30 -40l14 -13h26l14 13" fill="none" stroke="${c.edge}" stroke-width="1.6"/>
<line x1="-16" y1="-53" x2="24" y2="-53" stroke="${c.edge}" stroke-width="1.6"/>
<text x="-74" y="-19.5" class="busLine">M10</text>
<text x="34" y="-19.5" class="busDest">NAVIDABDI-STR.</text>
<circle cx="-70" cy="-3" r="5.5" fill="#1a1a1f"/><circle cx="-46" cy="-3" r="5.5" fill="#1a1a1f"/>
<circle cx="48" cy="-3" r="5.5" fill="#1a1a1f"/><circle cx="72" cy="-3" r="5.5" fill="#1a1a1f"/>
${night ? `<circle cx="-104" cy="-24" r="3" fill="#fff3c4"/><ellipse cx="-126" cy="-24" rx="24" ry="6" fill="#fff3c4" opacity=".18"/>` : ''}
</g>`;

  // A Trabant parked at the kerb, in the two-box shape everyone recognises.
  const trabiPos = P(150, 112, 0);
  const trabi = `<g transform="translate(${trabiPos[0]} ${trabiPos[1]})"><g class="lab" style="animation-delay:1.75s">
<path d="M-34 -4v-11q0 -3 3 -3h5l7 -11q1.5 -2.5 4.5 -2.5h19q3 0 4.5 2.5l7 11h5q3 0 3 3v11q0 3 -3 3h-52q-3 0 -3 -3z" fill="${c.trabi}" stroke="${c.trabiDark}" stroke-width="1"/>
<path d="M-15 -18l5.5 -8.5h8v8.5zM-4.5 -18v-8.5h9l5.5 8.5z" fill="${c.busGlass}"/>
<rect x="-35" y="-13" width="4" height="4" rx="1" fill="${night ? '#fff3c4' : '#d8d2c2'}"/>
<rect x="31" y="-13" width="4" height="4" rx="1" fill="#e8686e"/>
<circle cx="-21" cy="-1" r="6" fill="#1a1a1f"/><circle cx="-21" cy="-1" r="2.4" fill="#6b6b74"/>
<circle cx="21" cy="-1" r="6" fill="#1a1a1f"/><circle cx="21" cy="-1" r="2.4" fill="#6b6b74"/>
</g></g>`;

  // Pigeons on the pavement — they peck, then scatter every few seconds.
  const pigPos = P(200, 145, 0);
  let pigeons = '';
  [[0, 0, 0], [15, -4, 1], [-13, 3, 2], [28, 2, 3]].forEach(([px, py, k]) => {
    pigeons += `<g class="pigeon p${k}" style="animation-delay:${(4 + k * 0.12).toFixed(2)}s">`
      + `<ellipse cx="${px}" cy="${py}" rx="6" ry="4" fill="${c.dim}"/>`
      + `<circle cx="${px + 5.2}" cy="${py - 4}" r="2.5" fill="${c.dim}"/>`
      + `<path d="M${px + 6.2} ${py - 3.6}l2.4 .9l-2.4 .9z" fill="${c.neonC}"/>`
      + `<path d="M${px - 5} ${py - .5}l-3.6 1.6l3.6 1.2z" fill="${c.text}" opacity=".5"/></g>`;
  });
  pigeons = `<g transform="translate(${pigPos[0]} ${pigPos[1]})">${pigeons}</g>`;

  const bike = `<g class="vehicle" style="${bikeT.style}">
<circle cx="-11" cy="-5" r="7" fill="none" stroke="${c.text}" stroke-width="1.6"/>
<circle cx="11" cy="-5" r="7" fill="none" stroke="${c.text}" stroke-width="1.6"/>
<path d="M-11 -5 -2 -18 11 -5M-2 -18 4 -18M-11 -5 4 -12" fill="none" stroke="${c.text}" stroke-width="1.4"/>
<circle cx="-1" cy="-30" r="4" fill="${c.text}"/>
<path d="M-1 -26 -2 -16M-2 -16 -8 -8M-2 -16 3 -9M-1 -24 6 -19" fill="none" stroke="${c.text}" stroke-width="2.2" stroke-linecap="round"/>
</g>`;


  /* ---------- rain and wet road ---------- */
  // Reflections are cast straight down onto the carriageway from each light source,
  // so they line up with the lamp or sign that makes them.
  const roadAt = (sx) => {
    const wx = (sx - OX + 97 * DX) / KX;
    return wx * KY + 97 * DY + OY;
  };
  const wet = (sx, col, w, h, d) =>
    `<ellipse cx="${sx.toFixed(1)}" cy="${roadAt(sx).toFixed(1)}" rx="${w}" ry="${h}" fill="${col}"`
    + ` opacity="${night ? .3 : .14}" filter="url(#soft)" class="wet" style="animation-delay:${d}s"/>`;
  const reflections = [
    wet(P(310, Y_FURN, 0)[0], c.lampGlow, 11, 17, 0),
    wet(P(630, Y_FURN, 0)[0], c.lampGlow, 11, 17, .7),
    wet(P(0, Y_FURN, 0)[0], c.spatiLit, 15, 15, 1.3),
    wet(nA[0] + 46, c.neonA, 9, 19, .4),
    wet(nB[0] + 36, c.neonB, 8, 19, 1.1),
    wet(nC[0] + 36, c.neonD, 8, 16, 1.8),
  ].join('');

  let rain = '';
  for (let i = 0; i < 165; i++) {
    const rx = ((i * 137.9) % (W + 160)) - 80;
    const ry = ((i * 61.3) % 360) - 24;
    const len = 6 + (i % 4) * 2.6;
    const dur = (0.52 + ((i * 7) % 9) * 0.045).toFixed(2);
    rain += `<line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${(rx - len * 0.28).toFixed(1)}" y2="${(ry + len).toFixed(1)}"`
      + ` stroke="${c.rain}" stroke-width="${i % 6 ? 0.7 : 1}" stroke-linecap="round" opacity="${night ? (i % 3 ? .2 : .32) : (i % 3 ? .14 : .24)}"`
      + ` class="rain" style="animation-duration:${dur}s;animation-delay:-${((i * 31) % 100) / 100}s"/>`;
  }

  /* ---------- data band ---------- */
  const BY = 396;
  let plaques = '';
  towers.forEach(o => {
    const lx = P(o.x + FP / 2, FP / 2, 0)[0];
    plaques += `<g class="lab" style="animation-delay:${(1.4 + o.i * 0.1).toFixed(2)}s">`
      + `<text x="${lx}" y="${BY}" class="yr">'${String(o.yr).slice(2)}</text>`
      + `<text x="${lx}" y="${BY + 14}" class="cm">${n(o.v)}</text></g>`;
  });

  const kpis = [[n(D.contributions), 'CONTRIBUTIONS'], [n(latest.v), `IN ${latest.yr}`],
                [n(tallest.v), `BEST YEAR &#183; ${tallest.yr}`], [n(D.repos), 'PUBLIC REPOS'],
                [n(D.views), 'PROFILE VIEWS']];
  let kpi = '', kx = 40;
  kpis.forEach(([v, l], i) => {
    kpi += `<g class="lab" style="animation-delay:${(3.0 + i * 0.1).toFixed(2)}s">`
      + `<text x="${kx}" y="${BY + 62}" class="kv">${v}</text>`
      + `<text x="${kx}" y="${BY + 78}" class="kl">${l}</text></g>`;
    kx += 168;
  });

  const H = BY + 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="A Berlin street corner built from ${esc(D.name)}'s GitHub activity: one building per year from ${D.byYear[0][0]} to ${D.byYear[D.byYear.length - 1][0]}, tallest is ${tallest.yr} with ${n(tallest.v)} contributions; ${n(D.contributions)} contributions in total, ${D.repos} public repositories, ${D.stars} stars and ${n(D.views)} profile views">
<title>${esc(D.name)} &#8212; Navidabdi-Stra&#223;e, ${D.district} Berlin</title>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="${c.sky1}"/><stop offset=".62" stop-color="${c.sky2}"/><stop offset="1" stop-color="${c.sky3}"/></linearGradient>
<radialGradient id="lampG"><stop offset="0" stop-color="${c.lampGlow}" stop-opacity="${night ? .5 : .2}"/><stop offset="1" stop-color="${c.lampGlow}" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="nglow" x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="scene"><rect x="0" y="0" width="${W}" height="${BY - 26}" rx="10"/></clipPath>
${clips}
</defs>
<style>
text{font-family:${MONO}}
.yr{font-size:11px;fill:${c.text};text-anchor:middle;font-weight:700;letter-spacing:.05em}
.cm{font-size:10px;fill:${c.dim};text-anchor:middle}
.kv{font-size:20px;fill:${c.bright};font-weight:700}
.kl{font-size:9px;fill:${c.dim};letter-spacing:.2em}
.hd{font-size:11px;fill:${c.dim};letter-spacing:.2em}
.hdR{font-size:11px;fill:${c.dim};letter-spacing:.2em;text-anchor:end}
.nlab{font-size:8px;text-anchor:middle;letter-spacing:.2em}
.nval{font-size:15px;text-anchor:middle;font-weight:700}
.stName{font-size:15px;fill:${c.signInk};text-anchor:middle;font-weight:700;letter-spacing:.02em}
.stSub{font-size:10px;fill:${c.signInk};letter-spacing:.06em}
.stSubR{font-size:10px;fill:${c.signInk};text-anchor:end;letter-spacing:.06em}
.stStation{font-size:10px;fill:${c.signInk};text-anchor:middle;font-weight:700;letter-spacing:.1em}
.uMark{font-size:30px;fill:#fff;text-anchor:middle;font-weight:700}
.statusTxt{font-size:8px;fill:${c.neonD};text-anchor:middle;font-weight:700;letter-spacing:.14em}
.posterK{font-size:7.5px;fill:${c.signInk};text-anchor:middle;letter-spacing:.16em;font-weight:700}
.posterV{font-size:16px;fill:${c.signInk};text-anchor:middle;font-weight:700}
.posterS{font-size:7px;fill:${c.signInk};text-anchor:middle;font-weight:700;letter-spacing:.06em}
.spatiTxt{font-size:9px;fill:${c.signInk};text-anchor:middle;font-weight:700;letter-spacing:.14em}
.spatiWin{animation:spati 7s ease-in-out 3s infinite}
@keyframes spati{0%,100%{opacity:1}52%{opacity:.86}}
.wet{animation:wet 4.5s ease-in-out infinite}
@keyframes wet{0%,100%{transform:scaleY(1);opacity:1}50%{transform:scaleY(.82);opacity:.72}}
.rain{animation-name:fall;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes fall{from{transform:translate(0,0)}to{transform:translate(-30px,190px)}}
.pigeon{animation:scatter 9.5s ease-in-out infinite}
.p0{--dx:-26px}.p1{--dx:20px}.p2{--dx:-38px}.p3{--dx:34px}
@keyframes scatter{
0%,28%{transform:translate(0,0);opacity:1}
32%{transform:translate(1px,-2px)}
36%,68%{transform:translate(0,0);opacity:1}
76%{transform:translate(calc(var(--dx)*.45),-20px);opacity:1}
84%{transform:translate(var(--dx),-40px);opacity:0}
92%{transform:translate(0,0);opacity:0}
100%{transform:translate(0,0);opacity:1}}
.busLine{font-size:11px;fill:#1a1a1f;font-weight:700;text-anchor:middle}
.busDest{font-size:8px;fill:#1a1a1f;text-anchor:middle;letter-spacing:.1em}

/* .lab animates transform, so it must never share an element with a transform attribute. */
.clip{transform-box:fill-box;transform-origin:50% 100%;animation:grow .8s cubic-bezier(.2,1.05,.35,1) both}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.w{opacity:0;animation:lit .34s ease-out both}
@keyframes lit{from{opacity:0}to{opacity:var(--o,1)}}
.fl{animation:lit .34s ease-out both,flick 6.5s steps(1) 4s infinite}
@keyframes flick{0%,86%{opacity:var(--o,1)}88%,92%{opacity:.12}94%,100%{opacity:var(--o,1)}}
.lab{opacity:0;animation:fd .5s ease-out both}
@keyframes fd{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.ft{opacity:0;animation:fdp 1.1s ease-out .15s both}
@keyframes fdp{from{opacity:0}to{opacity:1}}
.tw{animation:tw 3.4s ease-in-out infinite;opacity:var(--o,.7)}
@keyframes tw{0%,100%{opacity:var(--o,.7)}50%{opacity:.12}}
.drift{animation-name:drift;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(${W + 560}px)}}
.beacon{animation:beac 2.2s steps(1) infinite}
@keyframes beac{0%,44%{opacity:1}46%,100%{opacity:.12}}
.shimmer{animation:shim 9s ease-in-out infinite;transform-origin:${FT_X}px 126px}
@keyframes shim{0%,100%{transform:rotate(0);opacity:.35}50%{transform:rotate(360deg);opacity:.7}}
.neon{opacity:0;filter:url(#nglow);animation:neonOn 1.5s steps(1) both,neonHum 4.5s ease-in-out 3.6s infinite}
@keyframes neonOn{0%{opacity:0}12%{opacity:1}18%{opacity:.15}26%{opacity:1}34%{opacity:.2}44%{opacity:1}52%{opacity:.35}60%,100%{opacity:1}}
@keyframes neonHum{0%,100%{opacity:1}48%{opacity:.82}}
.glow{animation:glow 5.5s ease-in-out 2s infinite}
@keyframes glow{0%,100%{opacity:1}50%{opacity:.62}}
.ampRed{animation:ampR 7s steps(1) 2.6s infinite;opacity:0}
@keyframes ampR{0%,26%{opacity:1}27%,100%{opacity:0}}
.ampGreen{animation:ampG 7s steps(1) 2.6s infinite;opacity:0}
@keyframes ampG{0%,26%{opacity:0}27%,100%{opacity:1}}
.vehicle{animation-timing-function:linear;animation-iteration-count:infinite}
${bikeT.kf}${tramT.kf}
${COUNTER_CSS}
@media (prefers-reduced-motion:reduce){
.clip,.lab,.ft,.w,.neon,.glow,.tw{animation:none}
.lab,.ft,.neon{opacity:1;transform:none}.w{opacity:var(--o,1)}.tw{opacity:var(--o,.7)}
.fl{animation:none;opacity:var(--o,1)}
.drift,.vehicle,.beacon,.shimmer,.rain,.pigeon{display:none}
.wet,.spatiWin{animation:none}
.ampRed{animation:none;opacity:0}.ampGreen{animation:none;opacity:1}
.cf{display:none}.cf-last{opacity:1;animation:none}}
</style>
<rect width="${W}" height="${H}" rx="10" fill="${c.sky3}"/>
<g clip-path="url(#scene)">
<rect width="${W}" height="${BY - 26}" fill="url(#sky)"/>
${stars}${moon}${clouds}${turm}
${city}${roofstuff}${neon}
${street}${reflections}
${bike}${tram}${trabi}
${furniture}${pigeons}
${rain}
</g>
<text x="34" y="26" class="hd">${esc(D.name.toUpperCase())} &#183; NAVIDABDI-STRASSE, ${D.district} BERLIN</text>
<text x="${W - 34}" y="26" class="hdR">${D.byYear[0][0]}&#8211;${D.byYear[D.byYear.length - 1][0]}</text>
${plaques}
<line x1="34" y1="${BY + 32}" x2="${W - 34}" y2="${BY + 32}" stroke="${c.rule}" stroke-width="1"/>
${kpi}
</svg>`;
}
