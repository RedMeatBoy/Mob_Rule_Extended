// game.js — state machine + run loop. Waves, projectiles, cages, acorns,
// crossroads picks, camera, meta unlocks.

import { Pool, clamp, lerp, dist2, randRange, weightedPick, mulberry32, slideObstacles } from './pool.js';
import { SPECIES, SPECIES_IDS, WAVES, CHOICES, UNLOCK_ORDER, MOB_CAP, CHARACTERS, DIFFICULTIES, TRAIN_COSTS, PIPER_UPGRADES, CHALLENGES, SPICES, ARENAS, WEATHER } from './data.js';
import { MobSystem } from './critters.js';
import { EnemySystem } from './enemies.js';
import { Piper } from './piper.js';
import { InputManager } from './input.js';
import { AudioSystem } from './audio.js';
import { FX } from './fx.js';
import { UI } from './ui.js';

const STEP = 1 / 60;
const LEGACY_KEY = 'mob_rule_v1';
const SLOT_KEY = i => 'mob_rule_ext_slot_' + i; // EXTENDED EDITION: own saves
export const SLOT_COUNT = 3;
export const VIEW_W = 1280, VIEW_H = 720;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.arena = { w: 1700, h: 1300 };
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.fx = new FX();
    this.mob = new MobSystem();
    this.enemies = new EnemySystem(this.arena.w, this.arena.h);
    this.ui = new UI(this);

    this.state = 'intro'; // intro|saves|title|run|crossroads|gameover|victory|(pause overlay)
    this.paused = false;
    this.pauseReason = '';
    this.players = [];
    this.waveNum = 0;
    this.waveT = 0;
    this.spawnAcc = 0;
    this.boss = null;
    this.time = 0;
    this.acc = 0;
    this.alpha = 1;
    this.runStats = { bots: 0, acorns: 0, time: 0 };
    this.lastStand = null;
    this.endCause = null;
    this.rescueT = 10;
    this.camera = { x: 850, y: 650, zoom: 1, px: 850, py: 650, pz: 1 };

    this.proj = new Pool(() => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, friendly: true, homing: false, target: null, life: 0, color: '#fff', spin: false, ang: 0 }));
    this.acornsList = new Pool(() => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, val: 1, bob: 0 }));
    this.cages = [];
    this.clouds = [];
    this.snacks = [];
    this.rng = Math.random;

    this.slotIdx = null;
    this.migrateLegacy();
    this.save = this.defaultSave(); // placeholder until a save file is chosen
    this.fx.shakeEnabled = this.save.settings.shake;
    this.audio.setMuted(this.save.settings.muted);
    this.decor = [];
    this.buildDecor();
    // ART STYLE TEST: pre-rendered Blender frames (browser only; headless
    // tests skip this and the render falls back to procedural sprites).
    this.artFrames = {};
    const ART_SPECIES = ['frog', 'bunny', 'duck']; // grows as the roster converts
    if (typeof Image !== 'undefined') {
      for (const sp of ART_SPECIES) {
        this.artFrames[sp] = { front: [], back: [], side: [] };
        for (const view of ['front', 'back', 'side']) {
          for (let f = 1; f <= 12; f++) {
            const img = new Image();
            img.src = 'assets/' + sp + '/' + sp + '_' + view + '_' + String(f).padStart(2, '0') + '.png';
            this.artFrames[sp][view].push(img);
          }
        }
      }
    }
  }

  defaultSave() {
    return {
      acorns: 0, bestWave: 0, wins: 0, biggestMob: 0,
      settings: { muted: false, shake: true }, little: [false, false], chars: [0, 0],
      roster: ['frog', 'duck', 'goat', 'bee', 'turtle', 'bunny'],
      loadouts: [[], []],
      levels: {},        // permanent species training: sp -> 0..9
      pups: { hp: 0, speed: 0, mob: 0 },  // permanent piper upgrades
      secondChances: 0,  // consumable revives (max 3 held)
      endlessUnlocked: false,
      mode: 0,           // 0 story (12 waves) | 1 KEEP MARCHING (endless)
      bestEndless: 0,
      quests: {},        // one-time bounty flags
      spices: [false, false, false],
      arena: 0,
      arenasUnlocked: 0, // win in the newest arena to unlock the next
      artTest: false,    // Blender kawaii-frog A/B (press B on the title)
      diff: 0,           // selected difficulty
      diffUnlocked: 0,   // highest unlocked difficulty
    };
  }
  loadSlot(i) {
    try {
      const raw = localStorage.getItem(SLOT_KEY(i));
      if (!raw) return null;
      const s = JSON.parse(raw);
      const d = this.defaultSave();
      return {
        ...d, ...s,
        settings: { ...d.settings, ...(s.settings || {}) },
        little: s.little || [false, false],
        chars: s.chars || [0, 0],
        // Union with the base roster: starter species (incl. bunny) are
        // ALWAYS pickable, even on saves created before they were added.
        roster: [...new Set([...d.roster, ...(s.roster || [])])],
        loadouts: s.loadouts || [[], []],
        levels: s.levels || {},
        pups: { ...d.pups, ...(s.pups || {}) },
        secondChances: s.secondChances || 0,
        endlessUnlocked: !!s.endlessUnlocked,
        mode: s.endlessUnlocked ? (s.mode || 0) : 0,
        bestEndless: s.bestEndless || 0,
        quests: s.quests || {},
        spices: s.spices || [false, false, false],
        artTest: !!s.artTest,
        arena: Math.min(s.arena || 0, s.arenasUnlocked || 0),
        arenasUnlocked: Math.min(s.arenasUnlocked || 0, ARENAS.length - 1),
        diff: Math.min(s.diff || 0, s.diffUnlocked || 0),
        diffUnlocked: s.diffUnlocked || 0,
      };
    } catch (e) { return null; }
  }
  // Upgraded Edition starts fresh — its economy differs from the original.
  migrateLegacy() {}
  chooseSlot(i) {
    this.slotIdx = i;
    this.save = this.loadSlot(i) || this.defaultSave();
    this.persist();
    this.fx.shakeEnabled = this.save.settings.shake;
    this.audio.setMuted(this.save.settings.muted);
    this.state = 'title';
  }
  deleteSlot(i) { try { localStorage.removeItem(SLOT_KEY(i)); } catch (e) {} }
  persist() {
    if (this.slotIdx == null) return;
    try { localStorage.setItem(SLOT_KEY(this.slotIdx), JSON.stringify(this.save)); } catch (e) {}
  }
  setMuted(m) { this.audio.setMuted(m); this.save.settings.muted = m; this.persist(); }
  setShake(v) { this.fx.shakeEnabled = v; this.save.settings.shake = v; this.persist(); }
  unlocked(sp) { return (this.save.roster || []).includes(sp); }
  levelOf(sp) { return (this.save.levels || {})[sp] || 0; }
  trainCost(sp) {
    const lv = this.levelOf(sp);
    return lv >= TRAIN_COSTS.length ? null : TRAIN_COSTS[lv];
  }
  pupLevel(id) { return id === 'second' ? this.save.secondChances : (this.save.pups[id] || 0); }
  pupCost(id) {
    const def = PIPER_UPGRADES.find(u => u.id === id);
    const lv = this.pupLevel(id);
    return lv >= def.max ? null : def.costs[lv];
  }
  buyPup(id) {
    const cost = this.pupCost(id);
    if (cost == null || this.save.acorns < cost) return false;
    this.save.acorns -= cost;
    if (id === 'second') this.save.secondChances++;
    else this.save.pups[id] = (this.save.pups[id] || 0) + 1;
    this.persist();
    this.audio.sfx('recruit');
    const def = PIPER_UPGRADES.find(u => u.id === id);
    this.audio.say(def.name + '! ' + def.desc + '!', true);
    return true;
  }

  trainSpecies(sp) {
    const cost = this.trainCost(sp);
    if (cost == null || this.save.acorns < cost || !this.unlocked(sp)) return false;
    this.save.acorns -= cost;
    this.save.levels[sp] = this.levelOf(sp) + 1;
    this.persist();
    this.audio.sfx('recruit');
    this.audio.say(SPECIES[sp].name + ' trained to level ' + (this.save.levels[sp] + 1) + '!', true);
    return true;
  }
  unlockedList() { return SPECIES_IDS.filter(sp => this.unlocked(sp)); }
  shake(n) { this.fx.shake(n); }

  // ---------- run flow ----------
  startRun() {
    if (this.slotIdx == null) { this.slotIdx = 0; this.save = this.loadSlot(0) || this.defaultSave(); }
    this.mob = new MobSystem();
    this.enemies.clear();
    this.proj.clear(); this.acornsList.clear();
    this.cages.length = 0; this.clouds.length = 0; this.snacks.length = 0;
    this.fx.clear();
    this.runStats = { bots: 0, acorns: 0, time: 0 };
    this.boss = null;
    this.lastStand = null;
    this.endCause = null;
    this.rescueT = 10;
    this.acornHintDone = false;
    this.arenaDef = ARENAS[Math.min(this.save.arena || 0, ARENAS.length - 1)];
    this.obstacles = this.arenaDef.obstacles || [];
    this.zones = this.arenaDef.zones || [];
    this.weather = { type: null, t: 0, warnT: 0, next: 14 + Math.random() * 8 };
    this.mudGrow = 1;
    this.windX = 0; this.windY = 0;
    this.bolts = [];
    this.celebration = null;
    this.hitPause = 0;
    this.wallet = 0;        // spend at the crossroads market...
    this.trainBought = 0;   // ...or bank it for permanent glory
    this.mob.levels = this.save.levels || {};
    this.players = [];
    const p1 = new Piper(0, this.arena.w / 2 - 30, this.arena.h / 2, this.save.little[0], CHARACTERS[this.save.chars[0] || 0]);
    this.players.push(p1);
    if (this.input.deviceFor(1)) {
      this.players.push(new Piper(1, this.arena.w / 2 + 30, this.arena.h / 2, this.save.little[1], CHARACTERS[this.save.chars[1] || 0]));
    }
    this.audio.lead = CHARACTERS[this.save.chars[0] || 0].lead;
    // Permanent piper upgrades from the Training Camp.
    for (const p of this.players) {
      p.maxHp += 15 * (this.save.pups.hp || 0);
      p.hp = p.maxHp;
      p.speed *= 1 + 0.05 * (this.save.pups.speed || 0);
      p.magnet *= 1 + 0.2 * (this.save.pups.magnet || 0);
    }
    this.mob.shieldRegen = 0.04 + 0.01 * (this.save.pups.medic || 0);
    this.mob.hunterBonus = 0.04 * (this.save.pups.whistle || 0);
    this.mob.nibbleBonus = 0.05 * (this.save.pups.drill || 0);
    // Starting mob comes from each player's LOADOUT (fallback: the sampler).
    const lo0 = ((this.save.loadouts || [[]])[0] || []).filter(sp => this.unlocked(sp));
    const src0 = lo0.length ? lo0 : ['frog', 'frog', 'duck', 'duck', 'goat'];
    const extra = this.save.pups.mob || 0;
    const t2 = this.save.pups.headstart || 0;
    for (let i = 0; i < 5 + extra; i++) {
      this.mob.add(this, src0[i % src0.length], i < t2 ? 2 : 1, p1.x + randRange(-30, 30), p1.y + randRange(20, 50), 0, true);
    }
    if (this.save.pups.royal) {
      this.mob.add(this, src0[0], 3, p1.x, p1.y + 60, 0, true);
      this.audio.say('The ' + SPECIES[src0[0]].tierNames[2] + ' leads your parade!');
    }
    if (this.players[1]) {
      const lo1 = ((this.save.loadouts || [[], []])[1] || []).filter(sp => this.unlocked(sp));
      const src1 = lo1.length ? lo1 : ['frog', 'duck', 'goat'];
      for (let i = 0; i < 3; i++) {
        this.mob.add(this, src1[i % src1.length], 1, this.players[1].x + randRange(-30, 30), this.players[1].y + randRange(20, 50), 1, true);
      }
    }
    this.camera.x = p1.x; this.camera.y = p1.y;
    this.audio.ensure();
    this.audio.startMusic();
    this.startWave(1);
  }

  // Wave source: authored table for 1-12, generated forever after.
  waveDef(n) {
    if (n <= 12) return WAVES[n - 1];
    const k = n - 13;
    if (k % 4 === 3) {
      // A remixed boss returns every 4th endless wave.
      return {
        duration: 55, rate: [0.5, 0.9],
        mix: [['dustbot', 3], ['tidydrone', 2], ['mower', 2]],
        boss: ['mowtron', 'succ', 'supervisor'][Math.floor(k / 4) % 3],
        cages: 2, elite: true,
      };
    }
    return {
      duration: 42, rate: [1.4 + k * 0.04, 2.2 + k * 0.06],
      mix: [['dustbot', 4], ['tidydrone', 3], ['mower', 2], ['broom', 2], ['bagbot', 2], ['conebot', 1]],
      cages: 3, elite: true,
    };
  }

  startWave(n) {
    this.waveNum = n;
    const def = this.waveDef(n);
    this.waveT = def.duration;
    this.spawnAcc = 0;
    this.bossSpawned = false;
    this.state = 'run';
    this.paused = false;
    this.audio.sfx('wavestart');
    this.audio.intensity = Math.min(1, n / 12);
    this.ui.banner(def.boss ? `WAVE ${n} — ${this.bossName(def.boss)}` : `WAVE ${n}`, def.boss ? '#e05c5c' : '#fff');
    this.audio.say(def.boss ? `Wave ${n}! Here comes ${this.bossName(def.boss)}! You can do it!` : `Wave ${n}! Here they come!`, true);
    // Scatter recruitment cages.
    for (let i = 0; i < def.cages; i++) {
      this.cages.push({
        x: randRange(150, this.arena.w - 150),
        y: randRange(150, this.arena.h - 150),
        wob: randRange(0, 6),
        opened: false,
      });
    }
  }
  bossName(id) { return { mowtron: 'MOWTRON 9000', succ: 'THE SUCC-5000', supervisor: 'BUNNYTRON' }[id]; }

  waveDone() {
    if (this.waveT > 0) return false;
    if (this.celebration) return false; // let the fireworks finish first
    const def = this.waveDef(this.waveNum);
    if (def.boss && this.boss) return false;
    return this.enemies.threats() === 0 && this.enemies.telegraphs.length === 0;
  }

  endWave() {
    // Any leftover cones tidy themselves away.
    for (let i = 0; i < this.enemies.pool.n; i++) {
      const e = this.enemies.pool.get(i);
      if (e.kind === 'cone') { e.dead = true; this.fx.leaves(e.x, e.y, 3); }
    }
    this.audio.sfx('waveclear');
    this.fx.confetti(this.camera.x, this.camera.y - 60, 20);
    // Sweep leftover pickups to the piper.
    if (this.waveNum >= 12 && this.save.mode !== 1) { this.endRun(true); return; }
    if (this.save.mode === 1 && this.waveNum >= (this.save.bestEndless || 0)) {
      this.save.bestEndless = this.waveNum;
      this.persist();
    }
    // Revive any downed piper between waves; heal the whole mob.
    for (const p of this.players) if (p.downed) p.revive(this);
    for (const c of this.mob.list) c.hp = this.mob.maxHp(c.sp, c.tier);
    this.state = 'crossroads';
    this.ui.openCrossroads();
  }

  onBossDown(e) {
    this.fx.confetti(e.x, e.y, 40);
    this.shake(0.7);
    this.audio.sfx('victory');
    // PARTY TIME. The final boss in story mode gets the mega-celebration.
    const finale = e.kind === 'supervisor' && this.waveNum >= 12 && this.save.mode !== 1;
    this.celebration = { t: 0, dur: finale ? 4.6 : 1.8, big: finale, fwT: 0, hoorayed: false };
    this.hitPause = 0.35;
    if (finale) {
      this.audio.say('CONGRATULATIONS! You beat BUNNYTRON! You saved the whole meadow! HOORAY!', true);
    } else {
      this.ui.banner('BOSS SCRAPPED!', '#ffd166');
      this.audio.say('Hooray! The boss is scrapped! Amazing!', true);
    }
    // The mob cheers in its own voices.
    const cheer = [...new Set(this.mob.list.filter(c => c && !c._gone).map(c => SPECIES[c.sp].sound))].slice(0, 5);
    cheer.forEach((snd, i) => setTimeout(() => this.audio.sfx(snd), 150 + i * 130));
    // Bonus egg: 3 random higher-tier recruits.
    for (let i = 0; i < 3; i++) {
      const sp = this.randomSpecies();
      this.mob.add(this, sp, this.waveNum >= 8 ? 2 : 1, e.x + randRange(-30, 30), e.y + randRange(-30, 30), 0);
    }
  }

  onPiperDown(p) {
    this.audio.sfx('defeat');
    this.ui.banner(`P${p.slot + 1} IS DOWN!`, '#e05c5c');
    if (this.players.every(q => q.dead || q.downed)) {
      this.endRun(false);
    }
  }

  endRun(won, cause) {
    if (!won && this.state === 'run' && this.save.secondChances > 0) {
      this.useSecondChance();
      return;
    }
    this.endCause = cause || null;
    this.audio.say(won
      ? 'Nature wins! Hooray! You saved all the critters!'
      : cause === 'mobwipe'
        ? 'Oh no, the mob is gone! Great try! Play again!'
        : 'Ouch! The piper got bonked! Great try! Play again!', true);
    this.save.bestWave = Math.max(this.save.bestWave, this.waveNum);
    this.save.biggestMob = Math.max(this.save.biggestMob, this.mob.biggest);
    this.save.acorns += this.wallet; // unspent wallet banks to the save file
    if (won) this.save.wins++;
    this.arenaJustUnlocked = null;
    if (won && this.save.arena === this.save.arenasUnlocked && this.save.arenasUnlocked < ARENAS.length - 1) {
      this.save.arenasUnlocked++;
      this.arenaJustUnlocked = ARENAS[this.save.arenasUnlocked].name;
      this.audio.say('You unlocked a new place to march: ' + this.arenaJustUnlocked + '!', false);
    }
    if (won && !this.save.endlessUnlocked) {
      this.save.endlessUnlocked = true;
      this.audio.say('You unlocked KEEP MARCHING! The endless parade!', true);
    }
    if (this.save.mode === 1 && this.waveNum > (this.save.bestEndless || 0)) this.save.bestEndless = this.waveNum;
    this.diffJustUnlocked = null;
    if (won && this.save.diff === this.save.diffUnlocked && this.save.diffUnlocked < DIFFICULTIES.length - 1) {
      this.save.diffUnlocked++;
      this.diffJustUnlocked = DIFFICULTIES[this.save.diffUnlocked].name;
      this.audio.say('Incredible! You unlocked ' + this.diffJustUnlocked + '! It gets HARDER!', true);
    }
    // End-of-run draft: pick 1 of 3 new species for the roster. If the
    // roster is complete, a bonus acorn bundle is granted instead.
    const missing = SPECIES_IDS.filter(sp => !this.save.roster.includes(sp));
    this.draftOffers = [];
    const pool = [...missing];
    while (this.draftOffers.length < 3 && pool.length) {
      this.draftOffers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    this.draftBonus = 0;
    if (!this.draftOffers.length) {
      this.draftBonus = 20 + this.waveNum * 4;
      this.save.acorns += this.draftBonus;
    }
    // Quests: pay out any newly finished bounties.
    this.questsDone = [];
    const ch0 = CHARACTERS[this.save.chars[0] || 0].id;
    const lo0 = (this.save.loadouts || [[]])[0] || [];
    const qchecks = {
      win_pip: won && ch0 === 'pip',
      win_bam: won && ch0 === 'bam',
      win_vivi: won && ch0 === 'vivi',
      bunny_w8: this.waveNum >= 8 && lo0.length > 0 && lo0.every(sp => sp === 'bunny'),
      bank100: this.wallet >= 100,
      mob120: this.mob.biggest >= 120,
      win_d2: won && (this.save.diff || 0) >= 1,
      endless16: this.save.mode === 1 && this.waveNum >= 16,
    };
    for (const q of CHALLENGES) {
      if (!this.save.quests[q.id] && qchecks[q.id]) {
        this.save.quests[q.id] = true;
        this.save.acorns += q.bounty;
        this.questsDone.push(q);
      }
    }
    if (this.questsDone.length) {
      this.audio.say('Quest complete! ' + this.questsDone.map(q => q.name).join(', and ') + '! Bonus acorns!', false);
    }
    this.nextGoal = this.computeNextGoal();
    this.persist();
    this.audio.stopMusic();
    this.audio.sfx(won ? 'victory' : 'defeat');
    this.state = won ? 'victory' : 'gameover';
    this.ui.openEnd(won);
  }

  applyDraft(sp) {
    if (!this.save.roster.includes(sp)) this.save.roster.push(sp);
    this.persist();
    this.audio.sfx('recruit');
    this.audio.say(SPECIES[sp].name + ' joins your roster! See you next run!', true);
  }

  // Terrain: is this point inside a zone of this type? (zones are few)
  inZone(x, y, type) {
    for (const z of this.zones) {
      if (z.type !== type) continue;
      const grow = type === 'mud' ? (this.mudGrow || 1) : 1;
      if (z.shape === 'circle') { if (dist2(x, y, z.x, z.y) < (z.r * grow) * (z.r * grow)) return true; }
      else if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return true;
    }
    return false;
  }
  inWater(x, y) { return this.inZone(x, y, 'water'); }
  inMud(x, y) { return this.inZone(x, y, 'mud'); }

  // The Hades rule: every run ends pointing at the NEXT thing you want.
  computeNextGoal() {
    const bank = this.save.acorns;
    const wants = [];
    for (const up of PIPER_UPGRADES) {
      const cost = this.pupCost(up.id);
      if (cost != null) wants.push({ name: up.emoji + ' ' + up.name + ' Lv ' + (this.pupLevel(up.id) + 1), cost });
    }
    for (const sp of this.save.roster) {
      const cost = this.trainCost(sp);
      if (cost != null) wants.push({ name: SPECIES[sp].name + ' Lv ' + (this.levelOf(sp) + 1), cost });
    }
    if (!wants.length) return null;
    wants.sort((a, b) => a.cost - b.cost);
    const affordable = wants.filter(w => w.cost <= bank).pop();
    if (affordable) return { text: 'You can afford ' + affordable.name + ' (' + affordable.cost + '🌰) — visit the TRAINING CAMP!', ready: true };
    const next = wants[0];
    return { text: 'Only ' + (next.cost - bank) + ' more acorns until ' + next.name + '!', ready: false };
  }

  // ---------- crossroads market ----------
  makeShop() {
    const offers = [];
    for (let i = 0; i < 3; i++) {
      const sp = this.randomSpecies();
      const haggle = 1 - 0.08 * (this.save.pups.haggle || 0);
      offers.push({ sp, price: Math.max(2, Math.round(SPECIES[sp].price * (1 + 0.06 * (this.waveNum - 1)) * haggle)) });
    }
    offers.push({ train: true, price: 15 + this.trainBought * 10 });
    offers.push({ fortune: true, price: 30 });
    return offers;
  }
  buyOffer(o, slot) {
    if (o.sold || this.wallet < o.price) return false;
    this.wallet -= o.price;
    const p = this.players[slot] || this.players[0];
    if (o.fortune) {
      o.sold = true;
      const roll = Math.random();
      const spot = { x: p.x + randRange(-30, 30), y: p.y + randRange(20, 50) };
      if (roll < 0.35) {
        const sp = this.randomSpecies();
        this.mob.add(this, sp, 2, spot.x, spot.y, p.slot);
        this.fx.notice(p.x, p.y - 30, '🔮 A mighty ' + SPECIES[sp].tierNames[1] + '!', '#c792ea', 15);
        this.audio.say('The fortune teller sees... a mighty ' + SPECIES[sp].tierNames[1] + '!');
      } else if (roll < 0.55) {
        const sp = Math.random() < 0.5 ? 'owl' : 'moose';
        const give = this.unlocked(sp) ? sp : 'goat';
        this.mob.add(this, give, 2, spot.x, spot.y, p.slot);
        this.fx.notice(p.x, p.y - 30, '🔮 A powerful ally!', '#c792ea', 15);
        this.audio.say('The fortune teller sees... a powerful ally!');
      } else if (roll < 0.75) {
        for (let i = 0; i < 3; i++) this.mob.add(this, 'bee', 1, spot.x + i * 10, spot.y, p.slot);
        this.fx.notice(p.x, p.y - 30, '🔮 ...three bees. The universe is funny.', '#c792ea', 15);
        this.audio.say('The fortune teller sees... three bees? Well. Bees are friends too!');
      } else if (roll < 0.9) {
        for (const c of this.mob.list) if (c && !c._gone) c.hp = this.mob.maxHp(c.sp, c.tier);
        this.wallet += 15;
        this.fx.notice(p.x, p.y - 30, '🔮 Full heal + 15 acorns back!', '#7ec850', 15);
        this.audio.say('The fortune teller heals the whole mob! And look, spare change!');
      } else {
        const sp = ['frog', 'duck', 'bunny'][Math.floor(Math.random() * 3)];
        this.mob.add(this, sp, 3, spot.x, spot.y, p.slot);
        this.fx.notice(p.x, p.y - 30, '🔮 A KING JOINS THE PARADE!', '#ffd166', 16);
        this.audio.say('INCREDIBLE! The fortune teller summons the ' + SPECIES[sp].tierNames[2] + '!');
      }
      this.audio.sfx('uiPick');
      this.persist();
      return true;
    }
    if (o.train) {
      this.trainBought++;
      this.mob.buffs.dmg += 0.08;
      this.mob.buffs.hp += 0.08;
      o.price = 15 + this.trainBought * 10;
      this.fx.notice(p.x, p.y - 30, 'MOB TRAINING! +8% power!', '#ffd166', 15);
      this.audio.say('Training montage! The mob gets stronger!');
    } else {
      o.sold = true;
      this.mob.add(this, o.sp, 1, p.x + randRange(-24, 24), p.y + randRange(16, 40), p.slot);
      this.fx.notice(p.x, p.y - 30, SPECIES[o.sp].name + ' hired!', '#7ec850', 15);
      this.audio.say('A ' + SPECIES[o.sp].name + ' joins the parade!');
    }
    this.audio.sfx('uiPick');
    this.persist();
    return true;
  }

  // The comeback: consume a Second Chance instead of losing.
  useSecondChance() {
    this.save.secondChances--;
    this.persist();
    this.lastStand = null;
    const p0 = this.players[0];
    for (const p of this.players) {
      p.downed = false; p.dead = false;
      p.hp = p.maxHp;
      p.invuln = 3;
      p.reviveP = 0;
    }
    // A fresh mob of 10 springs up around the piper.
    const lo = ((this.save.loadouts || [[]])[0] || []).filter(sp => this.unlocked(sp));
    const src = lo.length ? lo : ['frog', 'duck', 'goat', 'bunny'];
    for (let i = 0; i < 10; i++) {
      this.mob.add(this, src[i % src.length], 1, p0.x + randRange(-40, 40), p0.y + randRange(-40, 40), 0, i > 0);
    }
    // Shockwave clears the dogpile (bosses just get shoved).
    const P = this.enemies.pool;
    for (let i = 0; i < P.n; i++) {
      const e = P.get(i);
      const d2 = dist2(e.x, e.y, p0.x, p0.y);
      if (d2 < 300 * 300) {
        if (!e.boss) this.enemies.die(this, e);
        else {
          const dd = Math.sqrt(d2) || 1;
          e.kx += (e.x - p0.x) / dd * 500; e.ky += (e.y - p0.y) / dd * 500;
        }
      }
    }
    this.shake(0.8);
    this.fx.confetti(p0.x, p0.y - 20, 40);
    this.fx.ring(p0.x, p0.y, 300, '#ffd166', 0.7);
    this.audio.sfx('victory');
    this.ui.banner('🔄 SECOND CHANCE!', '#ffd166');
    this.audio.say('Second chance! The parade rises again! ' + this.save.secondChances + ' left!', true);
  }

  quitToTitle() {
    this.state = 'title';
    this.paused = false;
    this.audio.stopMusic();
    this.fx.clear();
  }

  randomSpecies() {
    // Loadout species show up ~3x as often: your run leans your way.
    const pool = this.unlockedList();
    const lo = new Set([].concat(...(this.save.loadouts || []).map(l => l || [])));
    let total = 0;
    const w = pool.map(sp => { const v = lo.has(sp) ? 3 : 1; total += v; return v; });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  // ---------- crossroads ----------
  drawChoices(n) {
    const avail = CHOICES.filter(c => {
      if (c.needsUnlock && !this.unlocked(c.needsUnlock)) return false;
      if (c.kind === 'wild' && this.mob.wild[c.effect]) return false;
      if (c.id === 'piper_charm' && this.players.every(p => p.charm)) return false;
      return true;
    });
    const out = [];
    const pool = avail.slice();
    for (let i = 0; i < n && pool.length; i++) {
      const c = weightedPick(pool, ch =>
        ch.kind === 'pack' ? 10 : ch.kind === 'mobBuff' ? 7 : ch.kind === 'piperBuff' ? 5 : 4);
      out.push(c);
      pool.splice(pool.indexOf(c), 1);
    }
    return out;
  }

  applyChoice(c, slot) {
    const p = this.players[slot] || this.players[0];
    this.fx.notice(p.x, p.y - 34, c.title + '!', '#ffd166', 16);
    this.audio.say(c.title + '!');
    if (c.kind === 'pack') {
      for (let i = 0; i < c.count; i++) {
        this.mob.add(this, c.species, 1, p.x + randRange(-40, 40), p.y + randRange(20, 60), p.slot);
      }
    } else if (c.kind === 'mobBuff') {
      this.mob.buffs[c.stat] += c.amount;
    } else if (c.kind === 'piperBuff') {
      if (c.stat === 'maxhp') { p.maxHp += c.amount; p.hp = p.maxHp; }
      else if (c.stat === 'speed') p.speed *= (1 + c.amount);
      else if (c.stat === 'regen') p.regen += c.amount;
      else if (c.stat === 'charm') p.charm = true;
    } else if (c.kind === 'wild') {
      this.mob.wild[c.effect] = true;
      if (c.effect === 'crown') this.mob.recrown(this);
      this.fx.num(p.x, p.y - 30, c.title + '!', '#c792ea', 14);
    }
    this.audio.sfx('uiPick');
  }

  // ---------- spawn helpers ----------
  spawnProj(x, y, target, dmg, homing, color) {
    const pr = this.proj.alloc();
    pr.x = pr.px = x; pr.y = pr.py = y;
    const a = Math.atan2(target.y - y, target.x - x);
    const sp = homing ? 210 : 300;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.dmg = dmg; pr.friendly = true; pr.homing = homing;
    pr.target = homing ? target : null;
    pr.life = 1.6; pr.color = color || '#fff'; pr.spin = false; pr.ang = 0;
  }
  spawnEnemyProj(x, y, vx, vy, dmg, spin) {
    const pr = this.proj.alloc();
    pr.x = pr.px = x; pr.y = pr.py = y;
    pr.vx = vx; pr.vy = vy;
    pr.dmg = dmg; pr.friendly = false; pr.homing = false; pr.target = null;
    pr.life = 2.6; pr.color = spin ? '#f0f0f0' : '#e8c33a'; pr.spin = !!spin; pr.ang = 0;
  }
  skunkCloud(x, y, r, dmg, tier) {
    this.clouds.push({ x, y, r, dmg, life: 2.2 + tier * 0.4, tickT: 0 });
  }
  dropSnack(x, y) {
    if (this.save.spices[2]) return; // FAMINE: no apples
    if (this.snacks.length > 12) return;
    this.snacks.push({ x, y, bob: Math.random() * 6 });
  }

  updateSnacks(dt) {
    for (let i = this.snacks.length - 1; i >= 0; i--) {
      const s = this.snacks[i];
      s.bob += dt * 4;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        const d2 = dist2(s.x, s.y, p.x, p.y);
        // Only sticks to a piper who needs it — full pipers leave it for later.
        if (p.hp < p.maxHp && d2 < p.magnet * p.magnet) {
          const d = Math.sqrt(d2) || 1;
          s.x += (p.x - s.x) / d * 500 * dt;
          s.y += (p.y - s.y) / d * 500 * dt;
        }
        if (d2 < 22 * 22 && p.heal(this, 25 + 10 * (this.save.pups.snack || 0))) {
          this.snacks.splice(i, 1);
          this.audio.say('Yummy apple!');
          break;
        }
      }
    }
  }

  dropAcorn(x, y, val) {
    const a = this.acornsList.alloc();
    a.x = a.px = x; a.y = a.py = y;
    const ang = randRange(0, 6.28);
    a.vx = Math.cos(ang) * 70; a.vy = Math.sin(ang) * 70;
    a.val = val; a.bob = randRange(0, 6);
  }
  acorns(n, x, y) {
    const spice = 1 + 0.25 * this.save.spices.filter(Boolean).length;
    n = Math.max(1, Math.round(n * DIFFICULTIES[this.save.diff || 0].acorn * spice));
    this.runStats.acorns += n;
    this.wallet += n;
    if (x != null) this.fx.num(x, y, `+${n} 🌰`, '#c9a05a', 11);
    // Acorn-fed growth: every 50 acorns this run, the whole mob gets 15%
    // physically bigger (capped at ×2 so the orbit still fits on screen).
    const tier = Math.min(5, Math.floor(this.runStats.acorns / 50));
    if (tier > this.mob.growth) {
      this.mob.growth = tier;
      this.mob.sizeMul = Math.pow(1.15, tier);
      this.ui.banner('THE MOB GROWS BIGGER!', '#ffd166');
      this.audio.sfx('recruit');
      this.audio.say('Wow! All those acorns made your critters grow bigger!');
      const p = this.players[0];
      if (p) this.fx.confetti(p.x, p.y - 30, 18);
    }
  }

  // ---------- frame ----------
  frame(dt) {
    this.input.update(dt);
    if (this.input.anyPressed('mute')) this.setMuted(!this.audio.muted);
    if (this.state === 'run') {
      if (this.input.assignedPressed('pause')) { this.paused = !this.paused; this.pauseReason = ''; this.ui.pauseIdx = 0; }
      if (!this.paused && this.input.disconnectedSlot() >= 0) { this.paused = true; this.pauseReason = 'controller disconnected'; }
    }
    this.ui.update(dt);
    if (this.state === 'run' && !this.paused) {
      this.acc += Math.min(dt, 0.1);
      let n = 0;
      while (this.acc >= STEP && n < 4) { this.tick(STEP); this.acc -= STEP; n++; }
      this.alpha = this.acc / STEP;
    } else this.alpha = 1;
    if (this.ctx) this.render();
  }

  tick(dt) {
    this.time += dt;
    this.runStats.time += dt;
    const def = this.waveDef(this.waveNum);

    // Spawning.
    if (this.waveT > 0) {
      this.waveT = Math.max(0, this.waveT - dt);
      const prog = 1 - this.waveT / def.duration;
      const rate = lerp(def.rate[0], def.rate[1], prog) * (1 + 0.25 * (this.players.length - 1)) * (DIFFICULTIES[this.save.diff || 0].rate) * (this.save.spices[0] ? 1.3 : 1);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1 && this.enemies.count() < 130) {
        this.spawnAcc -= 1;
        const kind = weightedPick(def.mix, m => m[1])[0];
        const pos = this.spawnPos();
        this.enemies.telegraphSpawn(kind, pos.x, pos.y, def.elite && Math.random() < 0.35);
      }
      if (def.boss && !this.bossSpawned && prog > 0.12) {
        this.bossSpawned = true;
        const pos = this.spawnPos();
        this.enemies.spawnNow(this, def.boss, pos.x, pos.y);
      }
    }

    // Players + the attack/shield economy: tap sends/recalls ONE, hold streams.
    for (const p of this.players) {
      const inp = this.input.move(p.slot);
      p.update(dt, this, { x: inp.x, y: inp.y });
      if (p.dead || p.downed) continue;
      const ch = p.char;
      if (this.input.pressed(p.slot, 'whistle')) {
        if (p.sendCd <= 0) {
          let sent = 0;
          for (let k = 0; k < (ch.sendCount || 1); k++) if (this.mob.sendOne(this, p)) sent++;
          if (sent) { p.whistleAnim = 0.35; this.fx.notes(p.x, p.y - 24, 1 + sent); }
          if (ch.sendCd) p.sendCd = ch.sendCd;
        }
        p.sendAcc = -0.25; // grace before the hold-stream kicks in
      } else if (ch.sendStream && this.input.down(p.slot, 'whistle')) {
        p.sendAcc += dt;
        while (p.sendAcc >= ch.sendStream) {
          p.sendAcc -= ch.sendStream;
          if (this.mob.sendOne(this, p)) p.whistleAnim = 0.35;
        }
      } else p.sendAcc = 0;
      if (this.input.pressed(p.slot, 'recall')) {
        this.mob.recallOne(this, p);
        p.recallAcc = -0.25;
      } else if (this.input.down(p.slot, 'recall')) {
        p.recallAcc += dt;
        while (p.recallAcc >= (ch.recallStream || 0.11)) {
          p.recallAcc -= (ch.recallStream || 0.11);
          this.mob.recallOne(this, p);
        }
      } else p.recallAcc = 0;
    }
    // Revive downed partner by proximity.
    for (const p of this.players) {
      if (!p.downed) continue;
      let near = false;
      for (const q of this.players) {
        if (q !== p && !q.dead && !q.downed && dist2(p.x, p.y, q.x, q.y) < 70 * 70) near = true;
      }
      if (near) { p.reviveP += dt / 3; if (p.reviveP >= 1) p.revive(this); }
      else p.reviveP = Math.max(0, p.reviveP - dt * 0.5);
    }

    // WEATHER: arena-flavored events with a spoken telegraph.
    const wkinds = this.arenaDef && this.arenaDef.weather;
    if (wkinds && wkinds.length && this.state === 'run') {
      const wx = this.weather;
      if (!wx.type) {
        wx.next -= dt;
        if (wx.next <= 0) {
          wx.type = wkinds[Math.floor(Math.random() * wkinds.length)];
          const cfg = WEATHER[wx.type];
          wx.t = randRange(cfg.dur[0], cfg.dur[1]);
          wx.warnT = 2.2;
          if (wx.type === 'rain') { this.ui.banner('🌧️ RAIN!', '#8fd0ff'); this.audio.say('Rain is coming! Robots hate rain!'); }
          if (wx.type === 'wind') {
            const a = Math.random() * Math.PI * 2;
            this.windX = Math.cos(a); this.windY = Math.sin(a);
            this.ui.banner('💨 WIND!', '#c8e0b8'); this.audio.say('Whoosh! Hold onto your hats!');
          }
          if (wx.type === 'lightning') { this.ui.banner('⚡ THUNDERSTORM!', '#ffd166'); this.audio.say('Thunderstorm! Watch out for the sky circles!'); }
        }
      } else {
        wx.warnT = Math.max(0, wx.warnT - dt);
        wx.t -= dt;
        if (wx.type === 'rain') this.mudGrow = Math.min(WEATHER.rain.mudGrow, this.mudGrow + dt * 0.1);
        if (wx.type === 'lightning' && wx.warnT <= 0) {
          wx.strikeT = (wx.strikeT || 0) - dt;
          if (wx.strikeT <= 0) {
            wx.strikeT = WEATHER.lightning.strikeEvery;
            // Aim near the action: piper or a random enemy.
            const P = this.enemies.pool;
            const tgt = P.n && Math.random() < 0.6 ? P.get(Math.floor(Math.random() * P.n)) : this.players[0];
            this.bolts.push({
              x: clamp(tgt.x + randRange(-140, 140), 60, this.arena.w - 60),
              y: clamp(tgt.y + randRange(-140, 140), 60, this.arena.h - 60),
              t: WEATHER.lightning.warn, dur: WEATHER.lightning.warn, flash: 0,
            });
            this.audio.sfx('telegraph');
          }
        }
        if (wx.t <= 0) {
          wx.type = null;
          wx.next = 16 + Math.random() * 12;
          this.windX = 0; this.windY = 0;
          // Mud dries back slowly after rain.
        }
      }
      if ((!wx.type || wx.type !== 'rain') && this.mudGrow > 1) this.mudGrow = Math.max(1, this.mudGrow - dt * 0.03);
    }
    // Lightning bolts land on everyone under the circle — including robots.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t -= dt;
      if (b.t > 0) continue;
      this.bolts.splice(i, 1);
      const RAD = WEATHER.lightning.radius;
      this.audio.sfx('stomp');
      this.shake(0.4);
      this.fx.ring(b.x, b.y, RAD, '#fff8b0', 0.4);
      this.fx.sparks(b.x, b.y, 16);
      this.ui.lightningFlash = 0.12;
      const P2 = this.enemies.pool;
      for (let k = 0; k < P2.n; k++) {
        const e = P2.get(k);
        if (!e.dead && dist2(b.x, b.y, e.x, e.y) < RAD * RAD) {
          this.enemies.hurt(this, e, e.maxHp * (e.boss ? 0.08 : 0.4), null, {});
        }
      }
      this.mob.grid.query(b.x, b.y, RAD, c => {
        if (!c.bagged && dist2(b.x, b.y, c.x, c.y) < RAD * RAD) this.mob.hurt(this, c, 8, null);
      });
      for (const p of this.players) {
        if (!p.dead && !p.downed && dist2(b.x, b.y, p.x, p.y) < RAD * RAD) p.hurt(this, 15, null);
      }
    }

    // Celebration fireworks (world keeps rendering underneath).
    if (this.celebration) {
      const c = this.celebration;
      c.t += dt;
      c.fwT -= dt;
      if (c.fwT <= 0) {
        c.fwT = c.big ? 0.22 : 0.4;
        const n = c.big ? 2 : 1;
        for (let i = 0; i < n; i++) {
          this.fx.firework(
            this.camera.x + randRange(-380, 380),
            this.camera.y + randRange(-260, 120));
        }
        this.fx.streamers(this.arena.w, c.big ? 6 : 2);
        this.audio.sfx('pop');
      }
      if (c.t >= c.dur) this.celebration = null;
    }
    if (this.hitPause > 0) { this.hitPause -= dt; return; }

    this.mob.update(dt, this);
    this.enemies.update(dt, this);

    // MOB WIPE: without critters the run cannot be won — no soft-locks here.
    if (this.mob.count() === 0 && this.state === 'run') {
      if (!this.lastStand) {
        if (this.cages.length > 0) {
          this.lastStand = { t: 12 };
          this.ui.banner('MOB LOST — FREE A CAGE, FAST!', '#e05c5c');
          this.audio.sfx('defeat');
          this.audio.say('Oh no! Save the mob! Run to a cage, fast!', true);
        } else {
          this.endRun(false, 'mobwipe');
          return;
        }
      } else {
        this.lastStand.t -= dt;
        if (this.lastStand.t <= 0) { this.endRun(false, 'mobwipe'); return; }
        if (this.cages.length === 0) { this.endRun(false, 'mobwipe'); return; }
      }
    } else if (this.lastStand && this.mob.count() > 0) {
      this.lastStand = null;
      this.ui.banner('THE PARADE LIVES!', '#7ec850');
      this.audio.sfx('waveclear');
      this.fx.confetti(this.players[0].x, this.players[0].y - 30, 20);
    }

    // RESCUE DRIP: a shrinking mob must be recoverable, not a slow death
    // spiral. Below 5 critters a golden cage of wild volunteers appears
    // (first within ~10s, then every 30s) until you're back on your feet.
    if (this.state === 'run' && this.mob.count() < 5) {
      this.rescueT -= dt;
      if (this.rescueT <= 0) {
        this.rescueT = 30;
        const p = this.players.find(q => !q.dead && !q.downed) || this.players[0];
        const a = Math.random() * Math.PI * 2;
        const d = randRange(240, 380);
        this.cages.push({
          x: clamp(p.x + Math.cos(a) * d, 150, this.arena.w - 150),
          y: clamp(p.y + Math.sin(a) * d, 150, this.arena.h - 150),
          wob: 0,
          opened: false,
          rescue: true,
        });
        this.ui.banner('WILD CRITTERS SPOTTED!', '#ffd166');
        this.audio.sfx('cage');
        this.audio.say('Wild critters spotted! Follow the golden arrow!');
      }
    } else {
      this.rescueT = Math.min(this.rescueT, 10);
    }
    this.updateProjectiles(dt);
    this.updateClouds(dt);
    this.updateAcorns(dt);
    this.updateSnacks(dt);
    this.updateCages(dt);
    this.fx.update(dt);
    this.updateCamera(dt);

    if (this.waveDone()) this.endWave();
  }

  spawnPos() {
    // Ring around the camera view edge, inside the arena.
    for (let tries = 0; tries < 10; tries++) {
      const a = randRange(0, 6.28);
      const r = randRange(420, 560);
      const x = clamp(this.camera.x + Math.cos(a) * r, 60, this.arena.w - 60);
      const y = clamp(this.camera.y + Math.sin(a) * r, 60, this.arena.h - 60);
      let ok = true;
      for (const p of this.players) if (dist2(x, y, p.x, p.y) < 300 * 300) ok = false;
      if (ok && this.inWater(x, y)) ok = false;
      if (ok) { const s2 = slideObstacles(x, y, 20, this.obstacles); return { x: s2.x, y: s2.y }; }
    }
    return { x: randRange(80, this.arena.w - 80), y: 80 };
  }

  updateProjectiles(dt) {
    if (this.windX || this.windY) {
      const P = this.proj;
      const push = WEATHER.wind.push * dt;
      for (let i = 0; i < P.n; i++) { const pr = P.get(i); pr.vx += this.windX * push; pr.vy += this.windY * push; }
    }
    const P = this.proj;
    for (let i = P.n - 1; i >= 0; i--) {
      const pr = P.get(i);
      pr.px = pr.x; pr.py = pr.y;
      pr.life -= dt;
      pr.ang += dt * 10;
      if (pr.life <= 0) { P.release(i); continue; }
      if (pr.homing && pr.target && !pr.target.dead) {
        const a = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = lerp(pr.vx, Math.cos(a) * sp, 8 * dt);
        pr.vy = lerp(pr.vy, Math.sin(a) * sp, 8 * dt);
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.friendly) {
        const e = this.enemies.nearest(pr.x, pr.y, 26);
        if (e && dist2(pr.x, pr.y, e.x, e.y) < (e.size + 5) * (e.size + 5)) {
          this.enemies.hurt(this, e, pr.dmg, null, {});
          this.fx.sparks(pr.x, pr.y, 3);
          P.release(i);
        }
      } else {
        let hit = false;
        this.mob.grid.query(pr.x, pr.y, 16, c => {
          if (hit || c.bagged) return;
          if (dist2(pr.x, pr.y, c.x, c.y) < 14 * 14) { this.mob.hurt(this, c, pr.dmg, null); hit = true; }
        });
        if (!hit) {
          for (const p of this.players) {
            if (p.dead || p.downed) continue;
            if (dist2(pr.x, pr.y, p.x, p.y) < 15 * 15) { p.hurt(this, pr.dmg * 4 + 4, pr); hit = true; }
          }
        }
        if (hit) P.release(i);
      }
    }
  }

  updateClouds(dt) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      if (c.life <= 0) { this.clouds.splice(i, 1); continue; }
      c.tickT -= dt;
      if (c.tickT <= 0) {
        c.tickT = 0.5;
        this.enemies.each(c.x, c.y, c.r, e => {
          this.enemies.hurt(this, e, c.dmg, null, {});
          e.slowT = Math.max(e.slowT, 0.7);
        });
      }
    }
  }

  updateAcorns(dt) {
    const A = this.acornsList;
    for (let i = A.n - 1; i >= 0; i--) {
      const a = A.get(i);
      a.px = a.x; a.py = a.y;
      a.bob += dt * 4;
      a.vx *= 1 - 4 * dt; a.vy *= 1 - 4 * dt;
      let best = null, bd = Infinity;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        const d2 = dist2(a.x, a.y, p.x, p.y);
        if (d2 < p.magnet * p.magnet && d2 < bd) { bd = d2; best = p; }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        a.vx += (best.x - a.x) / d * 900 * dt;
        a.vy += (best.y - a.y) / d * 900 * dt;
      }
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (best && bd < 20 * 20) {
        this.acorns(a.val);
        this.audio.sfx('acorn');
        this.fx.sparks(a.x, a.y, 2);
        this.fx.num(a.x, a.y - 4, `+${a.val} acorn`, '#e8c33a', 11);
        if (!this.acornHintDone) {
          this.acornHintDone = true;
          this.fx.notice(a.x, a.y - 28, 'Acorns unlock NEW critters!', '#ffd166', 16);
          this.audio.say('You got an acorn! Collect acorns to unlock new critters!');
        }
        A.release(i);
      }
    }
  }

  updateCages(dt) {
    for (let i = this.cages.length - 1; i >= 0; i--) {
      const c = this.cages[i];
      c.wob += dt * 3;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        if (dist2(c.x, c.y, p.x, p.y) < 34 * 34) {
          this.cages.splice(i, 1);
          this.audio.sfx('cage');
          this.fx.leaves(c.x, c.y, 6);
          const sp = this.randomSpecies();
          const n = (c.rescue ? 4 : 3) + Math.floor(Math.random() * 2) + (this.save.pups.crowbar || 0);
          for (let k = 0; k < n; k++) {
            this.mob.add(this, sp, 1, c.x + randRange(-14, 14), c.y + randRange(-14, 14), p.slot);
          }
          this.fx.notice(c.x, c.y - 20, `${n} ${SPECIES[sp].name}s freed!`, '#7ec850', 15);
          this.audio.say(c.rescue ? `Hooray! ${n} wild ${SPECIES[sp].name}s join the parade!` : `${n} ${SPECIES[sp].name}s join the parade!`);
          break;
        }
      }
    }
  }

  updateCamera(dt) {
    const cam = this.camera;
    cam.px = cam.x; cam.py = cam.y; cam.pz = cam.zoom;
    const alive = this.players.filter(p => !p.dead);
    if (!alive.length) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of alive) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    let tz = 1;
    if (alive.length > 1) {
      tz = clamp(Math.min(VIEW_W / (maxX - minX + 500), VIEW_H / (maxY - minY + 420)), 0.62, 1);
    }
    cam.zoom = lerp(cam.zoom, tz, Math.min(1, 3 * dt));
    cam.x = lerp(cam.x, tx, Math.min(1, 5 * dt));
    cam.y = lerp(cam.y, ty, Math.min(1, 5 * dt));
    const hw = VIEW_W / (2 * cam.zoom), hh = VIEW_H / (2 * cam.zoom);
    cam.x = clamp(cam.x, Math.min(hw, this.arena.w / 2), Math.max(this.arena.w - hw, this.arena.w / 2));
    cam.y = clamp(cam.y, Math.min(hh, this.arena.h / 2), Math.max(this.arena.h - hh, this.arena.h / 2));
  }

  buildDecor() {
    this.decor = [];
    for (let i = 0; i < 60; i++) {
      this.decor.push({
        x: (i * 313.7) % this.arena.w,
        y: (i * 197.3 + 60) % this.arena.h,
        kind: i % 4,
        c: ['#ff8fb3', '#ffd166', '#c792ea', '#fff'][i % 4],
        s: 0.8 + (i % 3) * 0.3,
      });
    }
  }

  render() {
    this.ui.render(this.ctx);
  }
}
