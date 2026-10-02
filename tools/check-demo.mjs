/**
 * Checks the site's mini-case the way the game checks its own cases, then checks
 * what only the site has.
 *
 *   node tools/check-demo.mjs
 *
 * 1. The game's validate-case.js on content/demo-case.json — the same rules as the
 *    five app cases. Its warnings about the app's own registries (videos.ts, the
 *    call recordings, the location photos) do not apply to a case that lives only
 *    on the site; the site's media is checked in step 3 instead.
 * 2. The game's simulate-case.mjs: every legal route, played by the real engine —
 *    winnable in time, every call fires, every ending reachable, the right reason
 *    earned rather than given.
 * 3. The site: every clue, ending, call and the briefing has its recording and its
 *    word times, each recording still says what the text says now (a changed line
 *    needs a new take), and every picture and the camera clip are on disk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/dev/nekri-grammi';
const CASE = join(SITE, 'content', 'demo-case.json');
const data = JSON.parse(readFileSync(CASE, 'utf8'));
let failed = false;

const run = (label, args) => {
  console.log(`\n### ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: GAME, stdio: 'inherit' });
  if (r.status !== 0) failed = true;
};
run('Το validate-case.js του παιχνιδιού', [join(GAME, 'scripts', 'validate-case.js'), CASE]);
run('Το simulate-case.mjs του παιχνιδιού', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(GAME, 'scripts', 'simulate-case.mjs'), CASE]);

// --- 3. the site's own media ---------------------------------------------------
console.log('\n### Τα μέσα της σελίδας');
const errors = [];
const site = data.site;
const timingsJs = readFileSync(join(SITE, 'js', 'timings.js'), 'utf8');
const timings = JSON.parse(timingsJs.slice(timingsJs.indexOf('{'), timingsJs.lastIndexOf('}') + 1));
const py = spawnSync('python', [join(SITE, 'tools', 'voice_script.py'), '--json'], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
if (py.status !== 0) errors.push(`voice_script.py --json failed: ${py.stderr}`);
const script = py.status === 0 ? JSON.parse(py.stdout) : {};

const words = (s) => s.split(/\s+/).filter(Boolean).join(' ');
function clip(key, what) {
  if (!key) return errors.push(`${what}: no recording named in site.audio`);
  if (!existsSync(join(SITE, 'media', 'audio', `${key}.mp3`))) errors.push(`${what}: media/audio/${key}.mp3 is missing`);
  const t = timings[key];
  if (!t) return errors.push(`${what}: no word times for "${key}" (run tools/cut_site.py)`);
  const said = script[key];
  if (said === undefined) return errors.push(`${what}: "${key}" is in no take of tools/voice_script.py`);
  if (words(t.words.map((w) => w[0]).join(' ')) !== words(said)) {
    errors.push(`${what}: the recording "${key}" no longer matches its text — record it again`);
  }
}
clip(site.audio.intro, 'briefing');
for (const e of data.evidence) clip(site.audio.evidence[e.id], `evidence ${e.id}`);
for (const t of data.solution.tiers) clip(site.audio.tiers[String(t.minScore)], `ending «${t.title}»`);
clip(site.audio.time, 'ending «time»');
for (const c of data.calls) clip(c.audioKey, `call ${c.id}`);
clip('landing-call', 'the hero call');

for (const l of data.locations) {
  const img = site.images[l.id];
  if (!img || !existsSync(join(SITE, 'media', 'img', img))) errors.push(`${l.id}: no picture at media/img/${img}`);
  if (!site.map[l.id]) errors.push(`${l.id}: not placed on the little map (site.map)`);
}
for (const [id, cam] of Object.entries(site.cctv || {})) {
  if (!data.evidence.some((e) => e.id === id)) errors.push(`cctv "${id}" is not an evidence id`);
  if (!existsSync(join(SITE, cam.clip))) errors.push(`cctv ${id}: ${cam.clip} is missing`);
  if (!existsSync(join(SITE, cam.clip.replace(/\.mp4$/, '.jpg')))) errors.push(`cctv ${id}: poster is missing`);
  if (!/^\d{2}:\d{2}:\d{2}$/.test(cam.eventAt)) errors.push(`cctv ${id}: eventAt must be HH:MM:SS`);
  for (const f of ['camera', 'date', 'event']) if (!cam[f]?.trim()) errors.push(`cctv ${id}: ${f} is missing`);
}
// The written text and the narration must tell the same clock.
const hours = data.timeBudgetMinutes / 60;
const said = { 1: 'μία ώρα', 2: 'δύο ώρες', 3: 'τρεις ώρες' }[hours];
if (said && !data.briefing.includes(said)) errors.push(`briefing: the clock is ${hours}h but the briefing does not say «${said}»`);

for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(errors.length ? `\nsite media: ${errors.length} problem(s)` : `site media: OK — ${Object.keys(timings).length} recordings timed, pictures and camera clip present`);
if (errors.length) failed = true;
process.exit(failed ? 1 : 0);
