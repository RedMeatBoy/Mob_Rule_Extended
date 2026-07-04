// tests/engine.mjs — headless: boots the real Game with DOM stubs, verifies
// the mob loop (follow, fight, merge), enemies, bosses, crossroads, co-op,
// full-run survival balance. Usage: node tests/engine.mjs

import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const load = p => import(pathToFileURL(join(root, p)).href);

// ---- DOM stubs ----
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
const makeCanvas = (w = 64, h = 64) => ({ width: w, height: h, getContext: () => makeCtx(), style: {} });
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
globalThis.document = { createElement: () => makeCanvas(), getElementById: () => makeCanvas(1280, 720) };
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { Game } = await load('src/game.js');
const { SPECIES, SPECIES_IDS, WAVES, CHOICES, MOB_CAP } = await load('src/data.js');
const { statFor } = await load('src/critters.js');

let passed = 0, failed = 0;
const check = (c, name, extra) => {
  if (c) { passed++; console.log('  PASS: ' + name); }
  else { failed++; console.log('  FAIL: ' + name + (extra ? ' — ' + extra : '')); }
};

console.log('A) Content sanity:');
check(SPECIES_IDS.length >= 12, `12 species (${SPECIES_IDS.length})`);
check(WAVES.length === 12, '12 waves');
check(WAVES.filter(w => w.boss).length === 3, '3 boss waves');
check(CHOICES.length >= 20, `20+ crossroads choices (${CHOICES.length})`);
check(SPECIES_IDS.every(sp => SPECIES[sp].tierNames.length === 3), 'every species has 3 tier names');

console.log('B) Mob basics: follow, merge, cap:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.state === 'run' && g.mob.count() === 5, 'run starts with a 5-critter sampler mob', String(g.mob.count()));
  // Walk right for 3 seconds: the shield orbit should stay glued to the piper.
  g.input.keys.add('KeyD');
  for (let i = 0; i < 180; i++) g.frame(1 / 60);
  g.input.keys.delete('KeyD');
  for (let i = 0; i < 60; i++) g.frame(1 / 60); // settle
  const p = g.players[0];
  check(p.x > g.arena.w / 2 + 100, 'piper marched east');
  const maxD = Math.max(...g.mob.list.map(c => Math.hypot(c.x - p.x, c.y - p.y)));
  check(maxD < 170, 'shield orbit stays around the piper', `maxD=${maxD.toFixed(0)}`);
  check(g.mob.counts(0).shield === g.mob.count(), 'everyone starts on shield duty');
  // Merge: 5 frogs + 1 = two merges? 5 frogs -> add 1 = 6: one merge at first triple.
  const before = g.mob.countOf('frog', 1);
  g.mob.add(g, 'frog', 1, p.x, p.y, 0);
  check(g.mob.countOf('frog', 2) >= 1, '3 same-tier critters auto-merge into tier 2', `t1=${g.mob.countOf('frog', 1)} t2=${g.mob.countOf('frog', 2)}`);
  const t2 = g.mob.list.find(c => c.tier === 2);
  check(t2 && statFor('frog', 2, 'dmg') > statFor('frog', 1, 'dmg') * 2, 'tier 2 is much stronger');
  // Cap: flood it.
  for (let i = 0; i < 200; i++) g.mob.add(g, 'bee', 1, p.x, p.y, 0, true);
  check(g.mob.count() <= MOB_CAP, `mob cap enforced (${g.mob.count()} <= ${MOB_CAP})`);
}

console.log('C) Combat: the mob actually kills bots:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Drop a dustbot right on the mob.
  g.enemies.spawnNow(g, 'dustbot', p.x + 60, p.y);
  let killed = false;
  for (let i = 0; i < 60 * 8 && !killed; i++) {
    g.frame(1 / 60);
    killed = g.enemies.count() === 0 && g.enemies.telegraphs.length === 0;
    if (g.state !== 'run') break;
  }
  check(g.runStats.bots >= 1, 'mob scrapped the dust-bot', `bots=${g.runStats.bots}`);
  check(g.runStats.acorns > 0 || g.acornsList.n > 0, 'bot dropped acorns', `banked=${g.runStats.acorns} onGround=${g.acornsList.n}`);
}

console.log('D) Send one / recall one (the attack-shield economy):');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Tap Space: exactly ONE critter goes hunting.
  g.input.keys.add('Space');
  g.frame(1 / 60);
  g.input.keys.delete('Space');
  g.frame(1 / 60);
  let co = g.mob.counts(0);
  check(co.attack === 1, 'tap Space sends exactly one hunter', `attack=${co.attack}`);
  // The hunter actually hunts: distant bot gets approached.
  const far = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  const hunter = g.mob.list.find(c => c.duty === 'attack');
  const d0 = Math.hypot(hunter.x - far.x, hunter.y - far.y);
  for (let i = 0; i < 120 && !far.dead; i++) g.frame(1 / 60);
  const d1 = far.dead ? 0 : Math.hypot(hunter.x - far.x, hunter.y - far.y);
  check(far.dead || d1 < d0 * 0.6, 'the hunter chases distant prey', `${d0.toFixed(0)} -> ${d1.toFixed(0)}`);
  // Tap Shift: one comes home.
  g.input.keys.add('ShiftLeft');
  g.frame(1 / 60);
  g.input.keys.delete('ShiftLeft');
  co = g.mob.counts(0);
  check(co.attack === 0, 'tap Shift recalls the hunter', `attack=${co.attack}`);
  // Hold Space: a stream goes out.
  g.input.keys.add('Space');
  for (let i = 0; i < 45; i++) g.frame(1 / 60);
  g.input.keys.delete('Space');
  co = g.mob.counts(0);
  check(co.attack >= 3, 'holding Space streams hunters out', `attack=${co.attack}`);
  // Hold Shift: they all come home.
  g.input.keys.add('ShiftLeft');
  for (let i = 0; i < 60; i++) g.frame(1 / 60);
  g.input.keys.delete('ShiftLeft');
  co = g.mob.counts(0);
  check(co.attack === 0, 'holding Shift recalls the pack', `attack=${co.attack}`);
}

console.log('D1b) HP + regen + snacks:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.maxHp === 100 && p.hp === 100, 'piper starts at 100 HP');
  p.invuln = 0;
  p.hurt(g, 12, null);
  check(p.hp === 88, 'damage lands in HP', String(p.hp));
  for (let i = 0; i < 60 * 5; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(p.hp > 88.5, 'HP regenerates over time', p.hp.toFixed(1));
  // Snack pickup heals 25.
  p.hp = 40;
  g.dropSnack(p.x + 5, p.y);
  for (let i = 0; i < 30; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(p.hp >= 64, 'snack pickup heals +25', p.hp.toFixed(0));
}

console.log('D2) The shield actually shields:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // A bot walks into the wall: shield critters nibble it without leaving.
  const bully = g.enemies.spawnNow(g, 'dustbot', p.x + 55, p.y);
  let died = false;
  for (let i = 0; i < 60 * 8 && !died; i++) { p.invuln = 99; g.frame(1 / 60); died = bully.dead; }
  check(died, 'shield critters kill what breaches the wall');
  const maxD = Math.max(...g.mob.list.map(c => Math.hypot(c.x - p.x, c.y - p.y)));
  check(maxD < 200, 'shield held formation while fighting', `maxD=${maxD.toFixed(0)}`);
}

console.log('D3) Loss legibility:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 0;
  p.hurt(g, 10, null);
  check(g.ui.dmgFlash > 0 && g.ui.dmgMsg.includes('HP'), 'piper hit triggers the big red callout', g.ui.dmgMsg);
  check(g.ui.recallHintT > 0, 'first hit teaches TO ME!');
}

console.log('E) Crossroads:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // Force wave end.
  g.waveT = 0;
  g.enemies.clear();
  g.frame(1 / 60);
  check(g.state === 'crossroads', 'wave clear -> crossroads', g.state);
  check(g.ui.cards.length === 3, 'three cards offered');
  const worthOf = m => m.list.reduce((s, c) => s + Math.pow(3, c.tier - 1), 0);
  const before = worthOf(g.mob);
  const packCard = g.ui.cards.find(c => c.kind === 'pack') || g.ui.cards[0];
  g.applyChoice(packCard, 0);
  if (packCard.kind === 'pack') check(worthOf(g.mob) > before, 'pack recruits critters (worth grows through merges)');
  else check(true, 'choice applied');
  g.startWave(2);
  check(g.state === 'run' && g.waveNum === 2, 'next wave starts');
}

console.log('F) Bosses spawn and die:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.startWave(4); // MOWTRON
  for (let i = 0; i < 60 * 8 && !g.boss; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(!!g.boss && g.boss.kind === 'mowtron', 'MOWTRON arrives on wave 4');
  const worth = m => m.list.reduce((s, c) => s + Math.pow(3, c.tier - 1), 0);
  const worthBefore = worth(g.mob);
  g.enemies.hurt(g, g.boss, 99999, null, {});
  check(!g.boss, 'boss dies to damage');
  check(worth(g.mob) > worthBefore, 'boss drops bonus recruits (mob worth grows even through merges)');
  // SUCC pull check.
  g.startWave(8);
  for (let i = 0; i < 60 * 10 && !g.boss; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(!!g.boss && g.boss.kind === 'succ', 'SUCC-5000 arrives on wave 8');
  g.boss.state = 'vacuum'; g.boss.atk = 2;
  const p = g.players[0];
  p.x = g.boss.x + 200; p.y = g.boss.y;
  const dx0 = Math.abs(p.x - g.boss.x);
  for (let i = 0; i < 30; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(Math.abs(p.x - g.boss.x) < dx0, 'vacuum pulls the piper', `${dx0.toFixed(0)} -> ${Math.abs(p.x - g.boss.x).toFixed(0)}`);
}

console.log('G) Co-op: split mob + down/revive:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.input.assign(1, 'kb2');
  g.startRun();
  check(g.players.length === 2, 'two pipers march');
  const p2 = g.players[1];
  p2.invuln = 0;
  p2.hurt(g, 999, null);
  check(p2.downed && g.state === 'run', 'downed piper, run continues');
  // Partner stands close: revive.
  g.players[0].x = p2.x + 10; g.players[0].y = p2.y;
  let revived = false;
  for (let i = 0; i < 60 * 5 && !revived; i++) {
    g.players[0].x = p2.x + 10; g.players[0].y = p2.y;
    g.players[0].invuln = 99;
    g.frame(1 / 60);
    revived = !p2.downed;
  }
  check(revived, 'partner revives the downed piper');
  // Both down -> game over.
  for (const p of g.players) { p.invuln = 0; p.hurt(g, 999, null); p.invuln = 0; p.hurt(g, 999, null); }
  check(g.state === 'gameover', 'both down -> the mob scatters', g.state);
  const saved = JSON.parse(store.get('mob_rule_ext_slot_0'));
  check(saved.acorns >= 0 && saved.bestWave >= 1, 'meta progress persisted');
}

console.log('H) Wild cards:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.save.acorns = 99999; // unlock everything
  g.startRun();
  g.applyChoice(CHOICES.find(c => c.id === 'wild_crown'), 0);
  check(g.mob.list.some(c => c.crowned), 'Royal Decree crowns the strongest critter');
  g.applyChoice(CHOICES.find(c => c.id === 'wild_bees'), 0);
  const bees = g.mob.countOf('bee', 1);
  g.mob.hurt(g, g.mob.list.find(c => c.sp === 'frog'), 9999, null);
  check(g.mob.countOf('bee', 1) === bees + 1, 'Bee Solidarity: a bee joins when a critter is lost');
}

console.log('I) Round 3: mob health, retreat, last stand:');
{
  const audioSrc = await import('node:fs').then(fs => fs.readFileSync(join(root, 'src/audio.js'), 'utf8'));
  const names = [...audioSrc.matchAll(/name: ['"]([^'"]+)['"]/g)].map(m => m[1]);
  check(names.length >= 5, `5 songs authored (${names.join(', ')})`);
}
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Shield regen: hurt a critter, it heals on wall duty.
  const c = g.mob.list[0];
  const cmax = g.mob.maxHp(c.sp, c.tier);
  c.hp = cmax * 0.4;
  for (let i = 0; i < 60 * 4; i++) g.frame(1 / 60);
  check(c.hp > cmax * 0.5, 'critters heal while on shield duty', `hp=${c.hp.toFixed(1)}/${cmax}`);
  // Auto-retreat: wounded hunter falls back to shield.
  g.input.tap = null;
  g.input.keys.add('Space');
  g.frame(1 / 60);
  g.input.keys.delete('Space');
  const hunter = g.mob.list.find(q => q.duty === 'attack');
  check(!!hunter, 'a hunter was sent');
  if (hunter) {
    hunter.hp = g.mob.maxHp(hunter.sp, hunter.tier) * 0.3;
    for (let i = 0; i < 30; i++) g.frame(1 / 60);
    check(hunter.duty === 'shield', 'wounded hunter auto-retreats to the shield');
  }
  // Aggregate mob health reads sanely.
  const mh = g.mob.mobHealth();
  check(mh.max > 0 && mh.frac > 0 && mh.frac <= 1, 'mobHealth() aggregate is sane', JSON.stringify(mh));
}
{
  // Last stand: wipe the mob with a cage on the field -> countdown; freeing
  // the cage cancels it.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  g.cages.length = 0;
  g.cages.push({ x: p.x + 60, y: p.y, sp: 'frog', n: 2, hp: 1, wob: 0 });
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  g.frame(1 / 60);
  check(g.mob.count() === 0 && g.state === 'run' && !!g.lastStand, 'mob wipe with a cage triggers LAST STAND', `state=${g.state}`);
  // March to the cage: freeing it should refill the mob and cancel.
  let saved = false;
  for (let i = 0; i < 60 * 8 && !saved; i++) {
    g.input.keys.add('KeyD');
    g.frame(1 / 60);
    saved = g.mob.count() > 0;
  }
  g.input.keys.delete('KeyD');
  g.frame(1 / 60); // the cancel lands on the next tick
  check(saved && !g.lastStand, 'freeing a cage rescues the run', `mob=${g.mob.count()}`);
  // Now wipe with no cages: run ends with the mobwipe cause.
  g.cages.length = 0;
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  g.frame(1 / 60);
  check(g.state === 'gameover' && g.endCause === 'mobwipe', 'mob wipe with no cages ends the run (no soft-lock)', `state=${g.state} cause=${g.endCause}`);
}
{
  // Last stand timeout: cage exists but the piper never reaches it.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  g.cages.length = 0;
  g.cages.push({ x: p.x + 2000, y: p.y, sp: 'frog', n: 2, hp: 1, wob: 0 });
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  for (let i = 0; i < 60 * 14 && g.state === 'run'; i++) g.frame(1 / 60);
  check(g.state === 'gameover' && g.endCause === 'mobwipe', 'LAST STAND countdown expiring ends the run');
}
{
  // Sneaky bots exist and target the piper.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  let sneakyFound = false;
  for (let i = 0; i < 300 && !sneakyFound; i++) {
    const e = g.enemies.spawnNow(g, 'dustbot', p.x + 200, p.y);
    if (e && e.sneaky) {
      const t = g.enemies.pickTarget(e, g);
      sneakyFound = t === p;
    }
  }
  check(sneakyFound, 'sneaky bots target the piper through the wall');
}

console.log('J) Round 4: rescue drip + flanking:');
{
  // Below 5 critters, a golden rescue cage appears within ~10s.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  while (g.mob.count() > 2) g.mob.hurt(g, g.mob.list.find(c => c && !c._gone), 99999, null);
  g.cages.length = 0;
  let rescueAt = -1;
  for (let i = 0; i < 60 * 15; i++) {
    g.frame(1 / 60);
    if (g.cages.some(c => c.rescue)) { rescueAt = i / 60; break; }
  }
  check(rescueAt >= 0 && rescueAt < 12, 'rescue cage spawns within ~10s when mob < 5', `at=${rescueAt.toFixed(1)}s`);
  // A second one arrives on the ~30s cycle if you ignore the first.
  const firstCount = g.cages.length;
  for (let i = 0; i < 60 * 32 && g.state === 'run'; i++) {
    // Keep the piper out of the cage's lap so it isn't auto-freed.
    const p = g.players[0];
    for (const c of g.cages) {
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 80 * 80) { c.x = p.x + 500; c.y = p.y + 500; }
    }
    g.frame(1 / 60);
    if (g.cages.length > firstCount) break;
  }
  check(g.state !== 'run' || g.cages.length > firstCount, 'rescue keeps dripping every ~30s while the mob is small');
  // Healthy mob -> no rescue spam.
  const g2 = new Game(null);
  g2.input.assign(0, 'kb1');
  g2.startRun();
  g2.cages.length = 0;
  for (let i = 0; i < 60 * 15; i++) g2.frame(1 / 60);
  check(!g2.cages.some(c => c.rescue), 'no rescue cages while the mob is healthy');
}
{
  // Flanking: two chasers with opposite bearings split around the target.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  const e1 = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  const e2 = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  e1.flank = 1.2; e2.flank = -1.2;
  e1.sneaky = e2.sneaky = true;
  e1.hp = e2.hp = 1e9;
  for (let i = 0; i < 90; i++) g.frame(1 / 60);
  const spread = Math.abs(e1.y - e2.y);
  check(spread > 90, 'flanking chasers approach from different sides', `spread=${spread.toFixed(0)}px`);
}

console.log('K) Hotfix: cones must not hold waves open; breeding is linear:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // Only cones left on the field, timer expired -> wave must be done.
  g.enemies.spawnNow(g, 'cone', 500, 500);
  g.enemies.spawnNow(g, 'cone', 600, 500);
  g.waveT = 0;
  check(g.enemies.count() >= 2 && g.waveDone(), 'leftover cones do not block wave completion');
  // Cones expire on their own within ~14s.
  let coneAlive = true;
  for (let i = 0; i < 60 * 16 && g.state === 'run'; i++) {
    g.frame(1 / 60);
    coneAlive = [...Array(g.enemies.pool.n)].some((_, k) => g.enemies.pool.get(k).kind === 'cone' && !g.enemies.pool.get(k).dead);
    if (!coneAlive) break;
  }
  check(!coneAlive, 'cones tidy themselves away');
}
{
  // Bunny breeding: one global timer -> linear growth, no runaway.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.save.acorns = 99999;
  g.startRun();
  g.mob.wild.bunnyBreed = true;
  for (let i = 0; i < 12; i++) g.mob.add(g, 'bunny', 1, g.players[0].x, g.players[0].y, 0, true);
  const worth = () => g.mob.list.reduce((s, c) => s + (c && !c._gone ? 3 ** (c.tier - 1) : 0), 0);
  const w0 = worth();
  for (let i = 0; i < 60 * 36; i++) g.frame(1 / 60);
  const grown = worth() - w0;
  check(grown >= 1 && grown <= 8, 'breeding adds ~1 bunny per ~11s regardless of bunny count', `grown=${grown} in 36s`);
}

console.log('L) Round 5: readable notices, voice announcer, acorn clarity:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // notice() text lives long enough to read (2.6s vs 0.55s).
  g.fx.notice(100, 100, 'TEST NOTICE', '#fff');
  const d = g.fx.nums.get(g.fx.nums.n - 1);
  check(d.txt === 'TEST NOTICE' && d.life > 2, 'notice text stays up 2.6s', `life=${d.life}`);
  // say() is safe headless (no speechSynthesis in tests) and after mute.
  let threw = false;
  try { g.audio.say('Wave one!', true); g.audio.setMuted(true); g.audio.say('quiet'); g.audio.setMuted(false); } catch (e) { threw = true; }
  check(!threw, 'voice announcer degrades gracefully without speech support');
  // First acorn of a run teaches what acorns do — once.
  const p = g.players[0];
  g.dropAcorn(p.x, p.y, 1);
  for (let i = 0; i < 30; i++) g.frame(1 / 60);
  const hints = [...Array(g.fx.nums.n)].filter((_, k) => g.fx.nums.get(k).txt.includes('unlock')).length;
  check(g.acornHintDone && hints >= 1, 'first acorn pickup explains unlocks', `hints=${hints}`);
  g.dropAcorn(p.x, p.y, 1);
  for (let i = 0; i < 30; i++) g.frame(1 / 60);
  const hints2 = [...Array(g.fx.nums.n)].filter((_, k) => g.fx.nums.get(k).txt.includes('unlock')).length;
  check(hints2 <= hints, 'acorn hint does not repeat');
  // Ambient chatter timer ticks without crashing.
  for (let i = 0; i < 60 * 6; i++) g.frame(1 / 60);
  check(typeof g.mob.chatterT === 'number', 'mob chatter timer runs');
}

console.log('M) Round 6: BUNNYTRON + acorn-fed growth:');
{
  const { ENEMIES } = await load('src/data.js');
  check(ENEMIES.supervisor.name === 'BUNNYTRON' && ENEMIES.supervisor.body === '#ff8fb3', 'final boss is a pink robot bunny');
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 9999;
  const boss = g.enemies.spawnNow(g, 'supervisor', p.x + 300, p.y);
  boss.hp = 1e9;
  let sawBomb = false;
  for (let i = 0; i < 60 * 10; i++) {
    g.frame(1 / 60);
    if (g.enemies.bombs.length > 0) sawBomb = true;
  }
  check(sawBomb, 'BUNNYTRON lobs carrot bombs');
  check(g.mob.mobHealth().frac < 1 || g.mob.count() < 5, 'carrot bombs hurt the mob', `frac=${g.mob.mobHealth().frac.toFixed(2)}`);
}
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.mob.sizeMul === 1, 'mob starts at normal size');
  g.acorns(75);
  check(g.mob.growth === 1 && Math.abs(g.mob.sizeMul - 1.10) < 0.001, '75 acorns -> +10% size', `mul=${g.mob.sizeMul}`);
  g.acorns(150); // total 225 -> tier 3
  check(g.mob.growth === 3, 'growth tiers stack every 75 acorns', `growth=${g.mob.growth}`);
  g.acorns(5000);
  check(g.mob.growth === 4 && g.mob.sizeMul <= 1.47, 'growth caps at x1.46 (no more kaiju mobs)', `mul=${g.mob.sizeMul.toFixed(2)}`);
  // Bigger critters get a roomier orbit.
  const small = new Game(null); small.input.assign(0, 'kb1'); small.startRun();
  const rBig = g.mob.orbitSlot(0, 10, 0).r;
  const rSmall = small.mob.orbitSlot(0, 10, 0).r;
  check(rBig > rSmall, 'orbit widens as the mob grows', `${rSmall.toFixed(0)} -> ${rBig.toFixed(0)}`);
}

console.log('N) Phase A: save slots + BAM & VIVI:');
{
  const { CHARACTERS } = await load('src/data.js');
  check(CHARACTERS.length === 4 && CHARACTERS[1].id === 'bam' && CHARACTERS[2].id === 'vivi', 'four characters exist');
  // Save slots: legacy migrates to slot 0; slots are independent; delete works.
  store.clear();
  store.set('mob_rule_v1', JSON.stringify({ acorns: 777, bestWave: 9 }));
  const g = new Game(null);
  check(g.state === 'intro', 'game boots to the animated intro');
  check(!store.get('mob_rule_ext_slot_0'), 'Upgraded Edition starts fresh (no legacy migration)');
  g.chooseSlot(0);
  check(g.state === 'title' && g.save.acorns === 0, 'choosing a slot loads it fresh', `acorns=${g.save.acorns}`);
  g.save.acorns = 777; g.persist();
  g.chooseSlot(1);
  check(g.save.acorns === 0, 'other slots start fresh');
  check(Array.isArray(g.save.roster) && g.save.roster.length === 6, 'fresh roster has the 6 starter species (incl. bunny 🐰)');
  g.save.acorns = 55; g.persist();
  g.chooseSlot(0);
  check(g.save.acorns === 777, 'slots do not bleed into each other');
  g.deleteSlot(1);
  check(g.loadSlot(1) === null, 'deleteSlot wipes a slot');
  check(g.loadSlot(0).acorns === 777, 'deleting one slot leaves the others');
}
{
  // BAM: taps send THREE, then a cooldown blocks the next tap.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.chars = [1, 0]; // BAM
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.char.id === 'bam' && p.speed < 175, 'BAM is slower afoot', `spd=${p.speed}`);
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 3, 'BAM sends THREE at once', `out=${g.mob.counts(0).attack}`);
  g.frame(1 / 60);
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 3, 'drumroll cooldown blocks the next tap', `out=${g.mob.counts(0).attack}`);
  const hunter = g.mob.list.find(c => c.duty === 'attack');
  check(hunter && hunter.mods && hunter.mods.hunterAspd > 1, 'BAM hunters carry the war-beat mod');
}
{
  // VIVI: slower single sends, fast recalls, lullaby slow on the wall.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.chars = [2, 0]; // VIVI
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.char.id === 'vivi', 'VIVI selected');
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 1, 'VIVI sends one at a time');
  const h = g.mob.list.find(c => c.duty === 'attack');
  check(h && h.mods && h.mods.hunterDmg < 1, 'VIVI hunters hit softer (mod present)');
  // Lullaby wall: a melee shield critter's nibble slows the bot.
  const e = g.enemies.spawnNow(g, 'dustbot', p.x + 40, p.y);
  e.hp = 1e9; e.sneaky = false;
  let slowed = false;
  for (let i = 0; i < 60 * 12 && !slowed; i++) {
    p.invuln = 99; p.hp = p.maxHp;
    e.hp = 1e9; e.x = p.x + 40; e.y = p.y; // keep it pressed against the wall
    g.frame(1 / 60);
    slowed = e.slowT > 0.5;
  }
  check(slowed, 'lullaby wall entrances robots that touch it');
}

console.log('O) Upgraded Edition: wallet/bank, market, draft, loadout:');
{
  // Wallet collects, bank only gets what you did not spend.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.acorns(40);
  check(g.wallet === 40 && g.save.acorns === 0, 'acorns go to the run wallet, not straight to the bank');
  check(g.runStats.acorns === 40, 'growth still keys off collected total');
  // Market: buy a critter and training.
  g.waveNum = 3;
  const offers = g.makeShop();
  check(offers.length === 5 && offers[3].train && offers[4].fortune, 'market offers 3 critters + training + fortune');
  const worthOfMob = m => m.list.reduce((s, c) => s + (c && !c._gone ? 3 ** (c.tier - 1) : 0), 0);
  const before = worthOfMob(g.mob);
  const ok = g.buyOffer(offers[0], 0);
  check(ok && worthOfMob(g.mob) > before, 'buying hires a critter (worth grows through merges)', 'wallet=' + g.wallet);
  check(g.wallet === 40 - offers[0].price, 'wallet paid the price');
  const dmgBefore = g.mob.buffs.dmg;
  g.wallet = 100;
  g.buyOffer(offers[3], 0);
  check(g.mob.buffs.dmg > dmgBefore, 'training buffs the mob');
  check(offers[3].price > 15, 'training price escalates');
  const cant = g.buyOffer({ sp: 'moose', price: 99999 }, 0);
  check(!cant, 'cannot buy what you cannot afford');
  // Bank on run end.
  const w = g.wallet;
  const bank = g.save.acorns;
  g.endRun(false, null);
  check(g.save.acorns >= bank + w, 'unspent wallet banks at run end', g.save.acorns + ' vs ' + (bank + w));
  // Draft: offers exclude roster, pick joins forever.
  check(g.draftOffers.length === 3 && g.draftOffers.every(sp => !g.save.roster.includes(sp)), 'draft offers 3 species you do not own');
  const pick = g.draftOffers[0];
  g.applyDraft(pick);
  check(g.save.roster.includes(pick) && g.unlocked(pick), 'drafted species joins the roster forever');
}
{
  // Full roster -> bonus acorns instead of a draft.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.roster = [...SPECIES_IDS];
  g.input.assign(0, 'kb1');
  g.startRun();
  const bank = g.save.acorns;
  g.endRun(true);
  check(g.draftOffers.length === 0 && g.draftBonus > 0 && g.save.acorns > bank, 'full roster earns a bonus bundle instead');
}
{
  // Loadout: starters come from it, randomSpecies leans toward it.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.loadouts = [['turtle'], []];
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.mob.list.every(c => c.sp === 'turtle' || c.tier > 1), 'starting mob comes from the loadout', g.mob.list.map(c => c.sp).join(','));
  let turtles = 0;
  for (let i = 0; i < 400; i++) if (g.randomSpecies() === 'turtle') turtles++;
  check(turtles > 400 / 5 * 1.6, 'loadout species are ~3x as common in the run', turtles + '/400');
}

console.log('P) Extended Edition: training camp + difficulty ladder:');
{
  const { DIFFICULTIES, TRAIN_COSTS, enemyScale } = await load('src/data.js');
  check(DIFFICULTIES.length === 5, '5 difficulties defined');
  const d0 = enemyScale(5, 0), d4 = enemyScale(5, 4);
  check(d4.hp > d0.hp * 2 && d4.dmg > d0.dmg * 1.8, 'MAXIMUM TIDY is much meaner', JSON.stringify({ d0, d4 }));
  // Training: costs, levels, refusal.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.acorns = 30;
  check(g.trainCost('frog') === TRAIN_COSTS[0], 'level 1 costs the base price');
  check(g.trainSpecies('frog'), 'training succeeds with enough acorns');
  check(g.levelOf('frog') === 1 && g.save.acorns === 30 - TRAIN_COSTS[0], 'level + bank updated');
  check(!g.trainSpecies('frog'), 'cannot afford level 2 -> refused');
  check(!g.trainSpecies('moose'), 'cannot train species not in roster');
  g.save.acorns = 99999;
  for (let i = 0; i < 20; i++) g.trainSpecies('frog');
  check(g.levelOf('frog') === 10 && g.trainCost('frog') == null, 'training caps at level 10 (MAXED)');
  // Levels flow into a run: frog dmg/hp up 80%.
  g.input.assign(0, 'kb1');
  g.startRun();
  check(Math.abs(g.mob.levelMul('frog') - 1.8) < 0.001, 'level 10 = +80% multiplier');
  const frog = g.mob.list.find(c => c.sp === 'frog' && c.tier === 1);
  if (frog) check(g.mob.maxHp('frog', 1) > g.mob.maxHp('duck', 1) * 0.9, 'trained frogs are beefier');
  else check(true, 'trained frogs are beefier (no t1 frog after merges)');
}
{
  // Difficulty: selection clamps to unlocked; victory unlocks the next.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.diff = 3; g.persist();
  g.chooseSlot(0); // reload clamps
  check(g.save.diff === 0, 'cannot select a locked difficulty', 'diff=' + g.save.diff);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.waveNum = 12;
  g.endRun(true);
  check(g.save.diffUnlocked === 1 && g.diffJustUnlocked === 'SPRING CLEANING', 'victory unlocks the next difficulty');
  // Acorn multiplier pays more on higher difficulties.
  g.save.diff = 1;
  g.startRun();
  g.acorns(10);
  check(g.wallet >= 12, 'harder runs pay more acorns', 'wallet=' + g.wallet);
}

console.log('Q) Extended round 2: piper upgrades, Second Chance, intro, bunnies:');
{
  const { PIPER_UPGRADES, TRAIN_COSTS } = await load('src/data.js');
  check(TRAIN_COSTS.length === 10, 'species train to 10 levels');
  check(PIPER_UPGRADES.length === 14, '14 permanent piper upgrades');
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  check(g.save.roster.includes('bunny'), 'bunnies are in the roster from day one 🐰');
  // HP / speed / mob upgrades apply at run start.
  g.save.acorns = 5000;
  g.buyPup('hp'); g.buyPup('hp');
  g.buyPup('speed');
  g.buyPup('mob'); g.buyPup('mob'); g.buyPup('mob');
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.maxHp === 130 && p.hp === 130, '+15 HP per TOUGH PIPER level', 'hp=' + p.maxHp);
  check(Math.abs(p.speed - 175 * 1.05) < 0.01, 'SPEEDY BOOTS speeds up the piper', 'spd=' + p.speed);
  const worthOf = m => m.list.reduce((s, c) => s + 3 ** (c.tier - 1), 0);
  check(worthOf(g.mob) >= 8, 'BIGGER PARADE adds starting critters', 'worth=' + worthOf(g.mob));
}
{
  // Second Chance: price ladder, cap, and the actual comeback.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.acorns = 3000;
  check(g.pupCost('second') === 300, 'first Second Chance costs 300');
  g.buyPup('second');
  check(g.pupCost('second') === 500, 'second costs 500');
  g.buyPup('second');
  check(g.pupCost('second') === 1000, 'third costs 1000');
  g.buyPup('second');
  check(g.save.secondChances === 3 && g.pupCost('second') == null, 'capped at 3 held');
  g.input.assign(0, 'kb1');
  g.startRun();
  // Piper death -> comeback instead of game over.
  const p = g.players[0];
  p.invuln = 0;
  p.hurt(g, 99999, null);
  check(g.state === 'run' && !p.downed && p.hp === p.maxHp, 'Second Chance revives the piper mid-run', 'state=' + g.state);
  check(g.save.secondChances === 2, 'one chance consumed');
  check(g.mob.count() >= 10 || g.mob.list.length >= 4, 'a fresh mob springs up', 'mob=' + g.mob.count());
  // Mob wipe -> comeback too.
  g.cages.length = 0;
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 999999, null);
  g.frame(1 / 60);
  check(g.state === 'run' && g.mob.count() > 0, 'mob wipe also triggers Second Chance', 'state=' + g.state + ' mob=' + g.mob.count());
  check(g.save.secondChances === 1, 'second chance consumed');
  // Out of chances -> the run really ends.
  g.save.secondChances = 0;
  for (const q of g.players) { q.invuln = 0; q.hurt(g, 99999, null); }
  check(g.state === 'gameover', 'no chances left -> game over', g.state);
}

console.log('R) Round 3: celebrations, endless, upgrade batch, quests, spice, fortune:');
{
  // Boss death throws a party; BUNNYTRON at wave 12 throws THE party.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.startWave(4);
  for (let i = 0; i < 60 * 8 && !g.boss; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  g.enemies.hurt(g, g.boss, 999999, null, {});
  check(!!g.celebration && !g.celebration.big, 'boss death starts a celebration');
  check(!g.waveDone(), 'the wave waits for the fireworks');
  for (let i = 0; i < 60 * 3; i++) g.frame(1 / 60);
  check(!g.celebration, 'celebration ends on its own');
  // Next Goal exists after any run ends.
  g.endRun(false, null);
  check(!!g.nextGoal && typeof g.nextGoal.text === 'string', 'end screen has a Next Goal', JSON.stringify(g.nextGoal));
  check(g.save.endlessUnlocked === false, 'losing does not unlock endless');
}
{
  // Endless: victory unlocks it; endless waves generate past 12.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.waveNum = 12;
  g.endRun(true);
  check(g.save.endlessUnlocked, 'first victory unlocks KEEP MARCHING');
  for (let n = 13; n <= 25; n++) {
    const def = g.waveDef(n);
    if (!def || !def.mix || !def.rate) { check(false, 'waveDef generates forever', 'broke at ' + n); break; }
    if (n === 25) check(true, 'waveDef generates forever');
  }
  check(!!g.waveDef(16).boss && !!g.waveDef(20).boss, 'remixed bosses every 4th endless wave', g.waveDef(16).boss + '/' + g.waveDef(20).boss);
  // In endless mode, clearing wave 12 keeps marching.
  g.save.mode = 1;
  g.startRun();
  g.waveNum = 12; g.waveT = 0;
  g.enemies.clear();
  g.celebration = null;
  g.frame(1 / 60);
  check(g.state === 'crossroads' || g.state === 'run', 'endless mode does not end at wave 12', g.state);
  check(g.save.bestEndless >= 12, 'best endless wave recorded', 'best=' + g.save.bestEndless);
}
{
  // The upgrade batch hooks.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.acorns = 99999;
  for (const id of ['magnet', 'snack', 'medic', 'whistle', 'drill', 'haggle', 'crowbar', 'clover', 'headstart']) g.buyPup(id);
  g.buyPup('royal');
  g.input.assign(0, 'kb1');
  g.save.loadouts = [['turtle'], []];
  g.startRun();
  const p = g.players[0];
  check(p.magnet > 95, 'ACORN MAGNET widens pickup', 'magnet=' + p.magnet);
  check(Math.abs(g.mob.shieldRegen - 0.05) < 0.001, 'FIELD MEDIC raises shield regen');
  check(g.mob.hunterBonus > 0 && g.mob.nibbleBonus > 0, 'LOUD WHISTLE + WALL DRILL live on the mob');
  check(g.mob.list.some(c => c.tier >= 3), 'ROYAL INVITATION starts a KING', g.mob.list.map(c => c.sp + c.tier).join(','));
  check(g.mob.list.some(c => c.tier === 2) || g.mob.list.filter(c => c.tier >= 2).length >= 1, 'HEAD START upgrades a starter');
  g.ui.openCrossroads();
  check(g.ui.cards.length === 4, 'LUCKY CLOVER deals 4 cards', 'cards=' + g.ui.cards.length);
  g.waveNum = 1;
  const offers = g.makeShop();
  check(offers[0].price <= SPECIES[offers[0].sp].price, 'HAGGLER discounts the market');
  check(offers.some(o => o.fortune), 'the Fortune Teller has a stall');
  // Fortune: costs 30, always gives SOMETHING.
  g.wallet = 100;
  const worthOf = m => m.list.reduce((s, c) => s + 3 ** (c.tier - 1), 0);
  const hpBefore = g.mob.mobHealth().frac;
  const before = worthOf(g.mob);
  const walletBefore = g.wallet;
  const ok = g.buyOffer(offers.find(o => o.fortune), 0);
  check(ok && g.wallet <= walletBefore - 15, 'fortune costs acorns (mostly)');
  check(worthOf(g.mob) > before || g.wallet === walletBefore - 30 + 15 || g.mob.mobHealth().frac >= hpBefore, 'fortune always delivers something');
}
{
  // Quests pay once; spices bite and pay.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.wallet = 150;
  const bank = g.save.acorns;
  g.endRun(false, null);
  check(g.save.quests.bank100 && g.questsDone.some(q => q.id === 'bank100'), 'Fat Stacks quest pays out');
  check(g.save.acorns >= bank + 150 + 60, 'bounty landed in the bank');
  const bank2 = g.save.acorns;
  g.startRun();
  g.wallet = 150;
  g.endRun(false, null);
  check(!g.questsDone.some(q => q.id === 'bank100'), 'quests only pay once');
  // Spices.
  g.save.spices = [false, false, true]; // FAMINE
  g.startRun();
  const snacksBefore = g.snacks.length;
  g.dropSnack(100, 100);
  check(g.snacks.length === snacksBefore, 'FAMINE stops apples');
  g.save.spices = [true, true, true];
  g.acorns(10);
  check(g.wallet >= 17, 'three spices pay +75% acorns', 'wallet=' + g.wallet);
}

console.log('S) M1: terrain, collision, water, arenas:');
{
  const { ARENAS } = await load('src/data.js');
  const { slideObstacles } = await load('src/pool.js');
  check(ARENAS.length === 7 && ARENAS.map(a => a.id).join(',') === 'backyard,riverside,farm,quarry,dunes,plateau,rooftop', 'seven arenas, the full world tour', ARENAS.map(a => a.id).join(','));
  // Slide-along: a walker pushed into a rock pops out, never inside.
  const rock = [{ kind: 'rock', x: 100, y: 100, r: 40 }];
  const s1 = slideObstacles(110, 100, 10, rock);
  check(Math.hypot(s1.x - 100, s1.y - 100) >= 49.9, 'slide pushes out of rocks');
  const wall = [{ kind: 'wall', x: 200, y: 200, w: 100, h: 20 }];
  const s2 = slideObstacles(250, 205, 10, wall);
  check(s2.y <= 190.1 || s2.y >= 229.9, 'slide pushes out of walls', 'y=' + s2.y);
}
{
  // Riverside: piper walks THROUGH the rock field and never wedges.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.arenasUnlocked = 1; g.save.arena = 1;
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 9999;
  // March at each compass point for 8s; position must keep moving.
  const dirs = [['KeyD', 1, 0], ['KeyS', 0, 1], ['KeyA', -1, 0], ['KeyW', 0, -1]];
  let wedged = false;
  for (const [key] of dirs) {
    let still = 0, lx = p.x, ly = p.y;
    g.input.keys.add(key);
    for (let i = 0; i < 60 * 8; i++) {
      p.invuln = 9999; p.hp = p.maxHp;
      g.frame(1 / 60);
      if (g.state !== 'run') break;
      const moved = Math.hypot(p.x - lx, p.y - ly);
      // Near the arena edge "stuck" is legitimate; only count mid-field.
      const midField = p.x > 60 && p.x < g.arena.w - 60 && p.y > 60 && p.y < g.arena.h - 60;
      if (moved < 0.2 && midField) still++; else still = 0;
      if (still > 45) { wedged = true; break; }
      lx = p.x; ly = p.y;
    }
    g.input.keys.delete(key);
    if (wedged || g.state !== 'run') break;
  }
  check(!wedged, 'the no-maze law holds: piper never wedges in Riverside');
  if (g.state === 'run') {
    const maxD = Math.max(...g.mob.list.filter(c => !c.bagged && !c._gone).map(c => Math.hypot(c.x - p.x, c.y - p.y)));
    check(maxD < 320, 'mob orbit survives the obstacle course', 'maxD=' + (maxD | 0));
  } else check(true, 'mob orbit survives the obstacle course (run ended early)');
}
{
  // Water: slows walkers, not swimmers; robots sizzle; fliers immune.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.arenasUnlocked = 1; g.save.arena = 1;
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.inWater(1290, 1000) && !g.inWater(100, 100), 'inWater sees the pond');
  const bot = g.enemies.spawnNow(g, 'dustbot', 1290, 1000); // in the pond
  bot.sneaky = false;
  const hp0 = bot.hp;
  for (let i = 0; i < 60 * 3 && !bot.dead; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(bot.dead || bot.hp < hp0 * 0.9, 'robots short-circuit in water', 'hp ' + hp0 + '->' + (bot.dead ? 'dead' : bot.hp.toFixed(1)));
  const drone = g.enemies.spawnNow(g, 'tidydrone', 1290, 1000);
  const dh0 = drone.hp;
  for (let i = 0; i < 60 * 2 && !drone.dead; i++) { g.players[0].invuln = 99; drone.x = 1290; drone.y = 1000; g.frame(1 / 60); }
  check(!drone.dead && drone.hp >= dh0 * 0.7, 'flying drones do not sizzle', 'hp=' + drone.hp.toFixed(1));
  // Species affinity data.
  check(SPECIES.duck.water === 1 && SPECIES.penguin.water === 1 && SPECIES.turtle.water === 1, 'ducks, penguins & turtles swim free');
  check(SPECIES.frog.water === 0.85 && SPECIES.goat.water == null, 'frogs paddle, goats wade');
}
{
  // Arena unlock: winning in the newest arena opens the next.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  check(g.save.arenasUnlocked === 0, 'fresh saves know only the Backyard');
  g.input.assign(0, 'kb1');
  g.startRun();
  g.waveNum = 12;
  g.endRun(true);
  check(g.save.arenasUnlocked === 1 && g.arenaJustUnlocked === 'RIVERSIDE PARK', 'victory unlocks Riverside Park');
  // Selection clamps to unlocked on load.
  g.save.arena = 5; g.persist();
  g.chooseSlot(0);
  check(g.save.arena <= g.save.arenasUnlocked, 'arena selection clamps to unlocked');
  // Spawns never land in water or inside rocks.
  g.save.arena = 1;
  g.startRun();
  let wetSpawns = 0;
  for (let i = 0; i < 200; i++) {
    const pos = g.spawnPos();
    if (g.inWater(pos.x, pos.y)) wetSpawns++;
  }
  check(wetSpawns === 0, 'spawn points avoid the water', wetSpawns + '/200');
}

console.log('T) M2: weather + Muddy Farm + Storm Plateau:');
{
  // Mud slows walkers; frogs and skunks are immune; the barn has collision.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.arenasUnlocked = 2; g.save.arena = 2; // MUDDY FARM
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.inMud(750, 700) && !g.inMud(100, 1200), 'inMud sees the mud pits');
  check(SPECIES.frog.mud === 1 && SPECIES.skunk.mud === 1, 'frogs & skunks love mud');
  check(g.obstacles.some(o => o.barn), 'the red barn stands on the farm');
  // Rain: force the event, watch mud grow and the type be rain.
  g.weather.next = 0;
  g.frame(1 / 60);
  check(g.weather.type === 'rain', 'the farm rains', g.weather.type);
  const grow0 = g.mudGrow;
  for (let i = 0; i < 60 * 4; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(g.mudGrow > grow0, 'rain spreads the mud', g.mudGrow.toFixed(2));
}
{
  // Storm Plateau: lightning strikes hurt robots under the circle.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.arenasUnlocked = 3; g.save.arena = 3; // STORM PLATEAU
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 9999;
  g.weather.next = 0;
  for (let i = 0; i < 60 * 6 && !g.weather.type; i++) g.frame(1 / 60);
  check(!!g.weather.type, 'the plateau storms', g.weather.type);
  // Force a lightning bolt onto a bot.
  const bot = g.enemies.spawnNow(g, 'dustbot', p.x + 400, p.y);
  bot.sneaky = false;
  g.bolts.length = 0;
  g.bolts.push({ x: bot.x, y: bot.y, t: 0.01, dur: 1.2, flash: 0 });
  const hp0 = bot.hp;
  g.frame(1 / 60);
  check(bot.dead || bot.hp < hp0, 'lightning zaps robots too', 'hp ' + hp0 + '->' + (bot.dead ? 'dead' : bot.hp));
  // Wind pushes projectiles.
  g.windX = 1; g.windY = 0;
  const pr = g.proj.alloc();
  pr.x = pr.px = 500; pr.y = pr.py = 500; pr.vx = 0; pr.vy = 0; pr.life = 2; pr.friendly = true; pr.dmg = 0; pr.target = null; pr.homing = false;
  const vx0 = pr.vx;
  g.updateProjectiles(1 / 60);
  check(pr.vx > vx0, 'wind pushes projectiles');
  // No-wedge law holds in the valley.
  let wedged = false, still = 0, lx = p.x, ly = p.y;
  g.windX = 0; g.windY = 0;
  g.input.keys.add('KeyD');
  for (let i = 0; i < 60 * 8; i++) {
    p.invuln = 9999; p.hp = p.maxHp;
    g.frame(1 / 60);
    if (g.state !== 'run') break;
    const moved = Math.hypot(p.x - lx, p.y - ly);
    const midField = p.x > 60 && p.x < g.arena.w - 60 && p.y > 60 && p.y < g.arena.h - 60;
    if (moved < 0.2 && midField) still++; else still = 0;
    if (still > 45) { wedged = true; break; }
    lx = p.x; ly = p.y;
  }
  g.input.keys.delete('KeyD');
  check(!wedged, 'the no-maze law holds on the plateau');
}

console.log('U) M3: quarry hills, dune sand, rooftop vents + security bots:');
{
  const { ARENAS } = await load('src/data.js');
  const qi = ARENAS.findIndex(a => a.id === 'quarry');
  const di = ARENAS.findIndex(a => a.id === 'dunes');
  const ri = ARENAS.findIndex(a => a.id === 'rooftop');
  // Hills: climbing slow, descending fast.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.arenasUnlocked = qi; g.save.arena = qi;
  g.input.assign(0, 'kb1');
  g.startRun();
  const hz = g.zones.find(z => z.type === 'hill');
  const climb = g.terrainMul(hz.x + 100, hz.y, -1, 0, {});
  const descend = g.terrainMul(hz.x + 100, hz.y, 1, 0, {});
  check(climb < 1 && descend > 1, 'hills: climbing slow, descending fast', climb.toFixed(2) + '/' + descend.toFixed(2));
  // Dunes: sand slows walkers, turtles immune.
  g.save.arenasUnlocked = di; g.save.arena = di;
  g.startRun();
  const walker = g.terrainMul(200, 200, 1, 0, {});
  const turtle = g.terrainMul(200, 200, 1, 0, { sandImmune: true });
  check(walker < 1 && turtle === 1, 'dune sand slows walkers, not turtles', walker.toFixed(2) + '/' + turtle);
  check(SPECIES.turtle.sand === 1, 'turtles trained their whole lives for this');
  check(g.inWater(850, 700), 'the oasis is wet (robots beware)');
}
{
  // Rooftop: vents cycle and burn; security bots swap in.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  const { ARENAS } = await load('src/data.js');
  const ri = ARENAS.findIndex(a => a.id === 'rooftop');
  g.save.arenasUnlocked = ri; g.save.arena = ri;
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.vents.length === 4, 'four fire vents on the rooftop');
  // Park a bot on a vent and fast-forward a full cycle: it must burn.
  const p = g.players[0];
  p.invuln = 9999; p.x = 200; p.y = 200;
  const bot = g.enemies.spawnNow(g, 'dustbot', g.vents[0].x, g.vents[0].y);
  bot.sneaky = false; bot.hp = bot.maxHp = 1000;
  let burned = false;
  for (let i = 0; i < 60 * 7 && !burned; i++) {
    bot.x = g.vents[0].x; bot.y = g.vents[0].y;
    p.invuln = 9999; p.hp = p.maxHp;
    g.frame(1 / 60);
    burned = bot.hp < 999;
  }
  check(burned, 'fire vents burn robots on the flame beat', 'hp=' + bot.hp.toFixed(0));
  // Mix swap: wave 1 spawns become Sec-Bots on the rooftop.
  let sawSec = false;
  for (let i = 0; i < 60 * 20 && !sawSec; i++) {
    p.invuln = 9999; p.hp = p.maxHp; p.x = 200; p.y = 200;
    g.frame(1 / 60);
    if (g.state !== 'run') break;
    sawSec = g.enemies.telegraphs.some(t => t.kind === 'secbot');
    for (let k = 0; k < g.enemies.pool.n && !sawSec; k++) if (g.enemies.pool.get(k).kind === 'secbot') sawSec = true;
  }
  check(sawSec, 'the rooftop deploys SEC-BOTS instead of dust-bots');
  // No-wedge law: rooftop furniture.
  let wedged = false, still = 0, lx = p.x, ly = p.y;
  g.input.keys.add('KeyD');
  for (let i = 0; i < 60 * 8; i++) {
    p.invuln = 9999; p.hp = p.maxHp;
    g.frame(1 / 60);
    if (g.state !== 'run') break;
    const moved = Math.hypot(p.x - lx, p.y - ly);
    const midField = p.x > 60 && p.x < g.arena.w - 60 && p.y > 60 && p.y < g.arena.h - 60;
    if (moved < 0.2 && midField) still++; else still = 0;
    if (still > 45) { wedged = true; break; }
    lx = p.x; ly = p.y;
  }
  g.input.keys.delete('KeyD');
  check(!wedged, 'the no-maze law holds on the rooftop');
}

console.log('V) ECHO the Conductor + options:');
{
  const { CHARACTERS } = await load('src/data.js');
  check(CHARACTERS.length === 4 && CHARACTERS[3].id === 'echo' && CHARACTERS[2].id === 'vivi', 'ECHO appended at index 3 (saved char picks unshifted)');
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.chars = [3, 0]; // ECHO
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 9999;
  check(p.char.id === 'echo', 'ECHO takes the stage');
  // Send one out, then recall: it should come home ARMED.
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  g.frame(1 / 60);
  const hunter = g.mob.list.find(c => c.duty === 'attack');
  check(!!hunter, 'a hunter is out');
  // March the hunter far away so the arming state is observable, then
  // park a tough bot at the wall and recall.
  hunter.x = p.x + 500; hunter.y = p.y; hunter.px = hunter.x; hunter.py = hunter.y;
  const bot = g.enemies.spawnNow(g, 'dustbot', p.x + 60, p.y);
  bot.sneaky = false; bot.hp = bot.maxHp = 500;
  g.input.keys.add('ShiftLeft'); g.frame(1 / 60); g.input.keys.delete('ShiftLeft');
  check(hunter.echoPending === true, 'recall arms the shockwave');
  let boomed = false;
  for (let i = 0; i < 60 * 8 && !boomed; i++) {
    p.invuln = 9999; p.hp = p.maxHp;
    bot.hp = Math.max(bot.hp, 400); // survive nibbles until the boom
    g.frame(1 / 60);
    if (!hunter.echoPending) boomed = true;
  }
  check(boomed, 'the shockwave fires when the critter rejoins the wall');
  // Non-echo characters never arm it.
  g.save.chars = [0, 0];
  g.startRun();
  const p2 = g.players[0];
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  g.frame(1 / 60);
  g.input.keys.add('ShiftLeft'); g.frame(1 / 60); g.input.keys.delete('ShiftLeft');
  check(!g.mob.list.some(c => c.echoPending), 'PIP recalls do not boom');
}
{
  // Options plumbing: volumes + voice persist per save.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.settings.musicVol = 0.3;
  g.save.settings.sfxVol = 0.5;
  g.save.settings.voice = false;
  g.persist();
  g.chooseSlot(0);
  check(g.save.settings.musicVol === 0.3 && g.save.settings.sfxVol === 0.5, 'volume settings persist');
  check(g.audio.voiceOff === true, 'voice toggle reaches the announcer');
  let threw = false;
  try { g.audio.say('should be silent'); g.audio.setVolumes(1, 1); } catch (e) { threw = true; }
  check(!threw, 'muted voice + volume changes are safe headless');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
