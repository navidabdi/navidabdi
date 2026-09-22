// Small helpers shared by the scene renderer.
// Everything here has to survive GitHub's <img> sandbox: no external fonts, no
// scripts, no network. Motion is CSS only (never SMIL) so a single
// prefers-reduced-motion rule can switch all of it off.

export const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const n = (v) => Number(v).toLocaleString('en-US');

// SVG text content cannot be animated, so a number that counts up is really N
// stacked <text> nodes revealed one after another.
export function counter(final, x, y, cls, delay, frames = 10, dur = 1.2) {
  const step = dur / frames;
  let out = '';
  for (let i = 0; i < frames; i++) {
    const t = (i + 1) / frames;
    const last = i === frames - 1;
    const v = last ? final : Math.round(final * (1 - Math.pow(1 - t, 2.4)));
    const begin = (delay + i * step).toFixed(3);
    out += `<text x="${x}" y="${y}" class="${cls} ${last ? 'cf-last' : 'cf'}"`
      + ` style="animation-duration:${step.toFixed(3)}s;animation-delay:${begin}s">${n(v)}</text>`;
  }
  return out;
}

export const COUNTER_CSS = `
.cf,.cf-last{opacity:0;animation-timing-function:linear;animation-fill-mode:forwards}
.cf{animation-name:cfOn}
.cf-last{animation-name:cfHold}
@keyframes cfOn{0%{opacity:1}99%{opacity:1}100%{opacity:0}}
@keyframes cfHold{0%{opacity:1}100%{opacity:1}}
`;
