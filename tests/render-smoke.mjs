// Render smoke test: boot the game WITH a (stub) canvas so every render
// path executes, and walk all the screens. Any ReferenceError/TypeError in
// render code surfaces here instead of on the family's screen.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = process.argv[2] || dirname(dirname(fileURLToPath(import.meta.url)));
const load = p => import(pathToFileURL(join(root, p)).href);

const gradient = { addColorStop() {} };
function makeCtx() {
  return new Proxy({ _s: {} }, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 20 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop in t._s) return t._s[prop];
      return () => {};
    },
    set(t, prop, v) { t._s[prop] = v; return true; },
  });
}
const makeCanvas = (w = 1280, h = 720) => ({ width: w, height: h, getContext: () => makeCtx(), style: {} });
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
globalThis.document = { createElement: () => makeCanvas(64, 64), getElementById: () => makeCanvas() };
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { Game } = await load('src/game.js');

let stage = 'boot';
try {
  const g = new Game(makeCanvas());
  const step = n => { for (let i = 0; i < n; i++) g.frame(1 / 60); };

  stage = 'intro';
  step(30);
  stage = 'saves';
  g.state = 'saves'; g.ui.saveIdx = 0; g.ui.saveMode = 'pick';
  step(10);
  stage = 'title';
  g.chooseSlot(0);
  g.input.assign(0, 'kb1');
  step(10);
  stage = 'quests';
  g.state = 'quests'; step(5); g.state = 'title';
  stage = 'train';
  g.state = 'train'; g.ui.trainIdx = 0; g.ui.trainTab = 0; step(5);
  g.ui.trainTab = 1; step(5); g.state = 'title';
  stage = 'loadout';
  g.state = 'loadout'; g.ui.loSlot = 0; g.ui.loIdx = 0; step(10);
  stage = 'run (all characters)';
  for (let ch = 0; ch < 4; ch++) {
    g.save.chars = [ch, 0];
    g.startRun();
    g.input.keys.add('KeyD');
    step(120);
    g.input.keys.delete('KeyD');
    g.input.keys.add('Space'); step(5); g.input.keys.delete('Space');
    g.input.keys.add('ShiftLeft'); step(5); g.input.keys.delete('ShiftLeft');
  }
  stage = 'run in every arena';
  for (let a = 0; a < 7; a++) {
    g.save.arenasUnlocked = a; g.save.arena = a;
    g.startRun();
    step(180); // spawns + weather + vents + render
  }
  stage = 'boss render';
  g.startRun();
  g.enemies.spawnNow(g, 'supervisor', g.players[0].x + 300, g.players[0].y);
  step(60);
  stage = 'crossroads + shop';
  g.waveT = 0; g.enemies.clear(); g.celebration = null; g.bolts.length = 0;
  step(5);
  if (g.state === 'crossroads') { g.ui.shopMode = true; g.ui.shopIdx = 0; g.ui.shopOffers = g.makeShop(); step(5); }
  stage = 'gameover + draft';
  g.state = 'run';
  g.save.secondChances = 0;
  for (const p of g.players) { p.invuln = 0; p.hurt(g, 99999, null); }
  step(5);
  if (g.draftOffers && g.draftOffers.length) { g.state = 'draft'; g.ui.draftIdx = 0; step(5); }
  stage = 'pause';
  g.state = 'run'; g.paused = true; step(5);

  console.log('RENDER SMOKE: ALL SCREENS OK');
  process.exit(0);
} catch (err) {
  console.error('RENDER SMOKE FAILED at stage:', stage);
  console.error(err.stack || err);
  process.exit(1);
}
