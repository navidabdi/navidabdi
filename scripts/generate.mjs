#!/usr/bin/env node
// Redraws the profile header from live GitHub data.
//
// Everything below is readable with the workflow's built-in GITHUB_TOKEN, because
// "Include private contributions on my profile" is switched on: GitHub then publishes
// the contribution TOTAL for private work. It never publishes the breakdown, so this
// script deliberately shows no commit / pull-request / review counts — those would
// need a personal access token and would silently go stale without one.
//
// Usage:  GITHUB_TOKEN=... node scripts/generate.mjs
//         node scripts/generate.mjs --check    (exit 1 if output would change)

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scene } from './scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = process.env.PROFILE_LOGIN || 'navidabdi';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = { dark: 'assets/berlin-night.svg', light: 'assets/berlin-day.svg' };

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required (the workflow supplies it automatically).');
  process.exit(1);
}

async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json',
               'User-Agent': `${LOGIN}-profile` },
  });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function graphql(query) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json',
               'User-Agent': `${LOGIN}-profile` },
    body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

// The komarev badge is what actually counts a profile visit — GitHub has no view API,
// and only an image loading in the README can register one. We read its number back out
// of the SVG it returns. If it is unreachable, keep whatever the committed scene shows.
async function profileViews(fallback) {
  try {
    const r = await fetch(`https://komarev.com/ghpvc/?username=${LOGIN}`,
      { headers: { 'User-Agent': `${LOGIN}-profile` } });
    if (!r.ok) throw new Error(String(r.status));
    const matches = [...(await r.text()).matchAll(/>([\d,]{2,})</g)].map((m) => m[1]);
    const value = Number(matches.at(-1)?.replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch (err) {
    console.warn(`profile views unavailable (${err.message}) — keeping ${fallback}`);
    return fallback;
  }
}

function previousViews() {
  const f = join(ROOT, OUT.dark);
  if (!existsSync(f)) return 0;
  const m = readFileSync(f, 'utf8').match(/and ([\d,]+) profile views/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

const user = await gh(`/users/${LOGIN}`);
const firstYear = new Date(user.created_at).getUTCFullYear();
const thisYear = new Date().getUTCFullYear();

const years = [];
for (let y = firstYear; y <= thisYear; y++) years.push(y);
const calendar = await graphql(`{ user(login: "${LOGIN}") { ${years.map((y) =>
  `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z")`
  + ` { contributionCalendar { totalContributions } }`).join(' ')} } }`);

// Drop leading dormant years so the street starts where the work does.
let byYear = years.map((y) => [y, calendar.user[`y${y}`].contributionCalendar.totalContributions]);
while (byYear.length > 1 && byYear[0][1] === 0) byYear.shift();

let repos = [], page = 1;
for (;;) {
  const batch = await gh(`/users/${LOGIN}/repos?per_page=100&page=${page++}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}
const owned = repos.filter((r) => !r.fork);

const D = {
  login: LOGIN,
  name: user.name || LOGIN,
  role: process.env.PROFILE_ROLE || 'software engineer & maker',
  district: process.env.PROFILE_DISTRICT || '10405',
  repos: owned.length,
  stars: owned.reduce((s, r) => s + r.stargazers_count, 0),
  followers: user.followers,
  since: firstYear,
  years: thisYear - firstYear + 1,
  contributions: byYear.reduce((s, [, v]) => s + v, 0),
  views: await profileViews(previousViews()),
  byYear,
};

console.log(`${D.name}: ${n(D.contributions)} contributions ${byYear[0][0]}–${byYear.at(-1)[0]}, `
  + `${D.repos} repos, ${D.stars} stars, ${D.followers} followers, ${n(D.views)} views`);

let changed = false;
for (const [theme, file] of Object.entries(OUT)) {
  const path = join(ROOT, file);
  const next = scene(D, theme);
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (prev === next) continue;
  changed = true;
  if (process.argv.includes('--check')) { console.log(`would change ${file}`); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  console.log(`wrote ${file} (${(Buffer.byteLength(next) / 1024).toFixed(1)} KB)`);
}
if (!changed) console.log('no change');
if (process.argv.includes('--check') && changed) process.exit(1);

function n(v) { return Number(v).toLocaleString('en-US'); }
