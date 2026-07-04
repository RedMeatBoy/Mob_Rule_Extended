// loopify.mjs — turn a Suno download into a seamless game loop.
// Usage:  node tools/loopify.mjs <input.mp3|wav> <trackname> [startSec] [endSec]
// Output: assets/music/<trackname>.ogg  (trimmed, tail crossfaded into head)
// Needs ffmpeg on PATH (winget install ffmpeg / apt install ffmpeg).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , input, name, startSec, endSec] = process.argv;
if (!input || !name) {
  console.log('usage: node tools/loopify.mjs <input.mp3> <trackname> [startSec] [endSec]');
  console.log('trackname is one of the names in MUSIC_PROMPTS.md (e.g. backyard)');
  process.exit(1);
}
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'assets', 'music');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, name + '.ogg');

// 1) optional manual trim, 2) strip silence at both ends, 3) crossfade the
// last second into the first second so the loop point is inaudible.
const XFADE = 1.0;
const trim = (startSec || endSec)
  ? `-ss ${startSec || 0} ${endSec ? `-to ${endSec}` : ''}`
  : '';
const tmp = join(outDir, '_tmp_' + name + '.wav');
run(`ffmpeg -y ${trim} -i "${input}" -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" "${tmp}"`);
// Duration probe for the crossfade split.
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${tmp}"`).toString());
const main = Math.max(1, dur - XFADE);
run(`ffmpeg -y -i "${tmp}" -filter_complex "[0:a]atrim=start=${XFADE},asetpts=PTS-STARTPTS[body];[0:a]atrim=end=${XFADE},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=${XFADE}:c1=tri:c2=tri[out]" -map "[out]" -c:a libvorbis -q:a 5 "${out}"`);
run(process.platform === 'win32' ? `del "${tmp}"` : `rm "${tmp}"`, true);
console.log('LOOP READY:', out, `(${(dur - XFADE).toFixed(1)}s loop)`);
console.log('Drop-in complete — the game picks it up on next load.');

function run(cmd, soft) {
  try { execSync(cmd, { stdio: 'pipe', shell: true }); }
  catch (e) { if (!soft) { console.error('FAILED:', cmd, '\n', e.stderr?.toString() || e.message); process.exit(1); } }
}
