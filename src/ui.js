// ui.js — world render, HUD (the BIG mob counter), crossroads cards,
// title/end/pause screens. Every screen works on keyboard and controller.

import { clamp, lerp } from './pool.js';
import { SPECIES, SPECIES_IDS, WAVES, UNLOCK_ORDER, MOB_CAP, TIPS, DEFEAT_LINES, VICTORY_LINES, CHARACTERS, DIFFICULTIES, PIPER_UPGRADES, TRAIN_COSTS, CHALLENGES, SPICES, ARENAS, ENEMIES } from './data.js';
import { statFor, drawCrown } from './critters.js';
import { PIPER_COLORS, Piper } from './piper.js';
import { VIEW_W, VIEW_H } from './game.js';

const FONT = '"Trebuchet MS", "Comic Sans MS", sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class UI {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.menuIdx = 0;
    this.pauseIdx = 0;
    this.bannerData = null;
    this.cards = [];
    this.cardIdx = 0;
    this.pickSlot = 0;
    this.picksLeft = 1;
    this.endLine = '';
    this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.mobPop = 0;
    this.lastMob = 0;
    this.titleParade = [];
    for (let i = 0; i < 8; i++) {
      this.titleParade.push({ sp: SPECIES_IDS[i % 5], x: Math.random() * VIEW_W, sp2: 30 + Math.random() * 40 });
    }
  }

  banner(text, color) { this.bannerData = { text, color: color || '#fff', t: 2.4, max: 2.4 }; }

  // Piper damage must be unmissable — the piper IS the loss condition.
  piperHit(p, amount) {
    this.dmgFlash = 0.7;
    this.dmgMsg = p.hp <= 0 ? `P${p.slot + 1} IS DOWN!`
      : p.hp / p.maxHp < 0.25 ? `P${p.slot + 1}: -${amount} HP — DANGER!`
      : `P${p.slot + 1}: -${amount} HP (${Math.ceil(p.hp)} left)`;
    this.heartPop = 0.5;
    if (!this.recallHintShown && this.g.mob.count() > 0) {
      this.recallHintShown = true;
      this.recallHintT = 5;
    }
  }
  openCrossroads() {
    this.uiLock = 0.55; // pop-up grace: no accidental picks from held buttons
    this.pickSlot = 0;
    this.picksLeft = this.g.players.length;
    this.cards = this.g.drawChoices(3 + (this.g.save.pups.clover || 0));
    this.cardIdx = 1;
  }
  openEnd(won) {
    this.uiLock = 0.6;
    const pool = won ? VICTORY_LINES : DEFEAT_LINES;
    this.endLine = pool[Math.floor(Math.random() * pool.length)];
  }

  // ============ UPDATE ============
  update(dt) {
    this.t += dt;
    this.uiLock = Math.max(0, (this.uiLock || 0) - dt);
    this.mobPop = Math.max(0, this.mobPop - dt);
    this.dmgFlash = Math.max(0, (this.dmgFlash || 0) - dt);
    this.heartPop = Math.max(0, (this.heartPop || 0) - dt);
    this.recallHintT = Math.max(0, (this.recallHintT || 0) - dt);
    if (this.bannerData) { this.bannerData.t -= dt; if (this.bannerData.t <= 0) this.bannerData = null; }
    const g = this.g, inp = g.input;

    // Mob counter pop.
    const mc = g.mob ? g.mob.count() : 0;
    if (mc > this.lastMob) this.mobPop = 0.35;
    this.lastMob = mc;

    switch (g.state) {
      case 'intro': {
        this.introT = (this.introT || 0) + dt;
        let press = inp.keys.size > 0;
        for (const dev of inp.devices.values()) {
          if (dev.connected && (dev.pressed('confirm') || dev.pressed('whistle') || dev.pressed('recall') || dev.pressed('pause'))) press = true;
        }
        if (press && this.introT > 0.6) {
          g.audio.ensure();
          g.audio.sfx('uiPick');
          g.state = 'saves';
          g.audio.say('Mob Rule! Pick a save file!', true);
        }
        break;
      }
      case 'saves': {
        // Pick one of 3 save files. Delete needs TWO spoken confirmations.
        if (this.saveIdx == null) { this.saveIdx = 0; this.saveBtn = 0; this.saveMode = 'pick'; }
        // Device binding, same as title.
        if (!inp.deviceFor(0)) {
          for (const dev of inp.devices.values()) {
            if (dev.connected && (dev.pressed('confirm') || dev.pressed('whistle'))) { inp.assign(0, dev.id); break; }
          }
          if (!inp.deviceFor(0) && inp.keys.size > 0) inp.assign(0, 'kb1');
        }
        if (this.saveMode === 'pick') {
          if (inp.anyMenu('left')) { this.saveIdx = (this.saveIdx + 2) % 3; this.saveBtn = 0; g.audio.sfx('uiMove'); this.saySlot(g); }
          if (inp.anyMenu('right')) { this.saveIdx = (this.saveIdx + 1) % 3; this.saveBtn = 0; g.audio.sfx('uiMove'); this.saySlot(g); }
          if (inp.anyMenu('up') || inp.anyMenu('down')) {
            if (g.loadSlot(this.saveIdx)) { this.saveBtn = 1 - this.saveBtn; g.audio.sfx('uiMove'); }
          }
          if (inp.anyPressed('confirm')) {
            g.audio.ensure();
            g.audio.sfx('uiPick');
            if (this.saveBtn === 1 && g.loadSlot(this.saveIdx)) {
              this.saveMode = 'confirm1'; this.confirmYes = false;
              g.audio.say('Delete this save?', true);
            } else {
              g.chooseSlot(this.saveIdx);
              g.audio.say('Save file ' + (this.saveIdx + 1) + '. Lets play!', true);
            }
          }
        } else {
          // confirm1 / confirm2 dialogs: NO is always the default.
          if (inp.anyMenu('left') || inp.anyMenu('right')) { this.confirmYes = !this.confirmYes; g.audio.sfx('uiMove'); }
          if (inp.anyPressed('back')) { this.saveMode = 'pick'; g.audio.sfx('uiMove'); }
          else if (inp.anyPressed('confirm')) {
            g.audio.sfx('uiPick');
            if (!this.confirmYes) { this.saveMode = 'pick'; }
            else if (this.saveMode === 'confirm1') {
              this.saveMode = 'confirm2'; this.confirmYes = false;
              g.audio.say('It will be gone forever! Really delete?', true);
            } else {
              g.deleteSlot(this.saveIdx);
              this.saveMode = 'pick'; this.saveBtn = 0;
              g.audio.say('The save is gone. All clean!', true);
            }
          }
        }
        break;
      }
      case 'title': {
        for (const p of this.titleParade) {
          p.x += p.sp2 * dt;
          if (p.x > VIEW_W + 40) p.x = -40;
        }
        // Device binding: first input claims P1.
        if (!inp.deviceFor(0)) {
          for (const dev of inp.devices.values()) {
            if (dev.connected && (dev.pressed('confirm') || dev.pressed('whistle'))) { inp.assign(0, dev.id); break; }
          }
          if (!inp.deviceFor(0)) {
            // Keyboard always available.
            if (inp.keys.size > 0) inp.assign(0, 'kb1');
          }
        }
        const join = inp.joinPress();
        if (join) {
          inp.assign(1, join);
          g.audio.sfx('recruit');
          this.banner('🎮 PLAYER 2 JOINED!', '#5aa9ff');
          g.audio.say('Player two joined the parade!', true);
        }
        // P2 can leave: press their BACK button on the title.
        const d1x = inp.deviceFor(1);
        if (d1x && d1x.pressed('back')) {
          inp.unassign(1);
          g.audio.sfx('uiMove');
          this.banner('PLAYER 2 LEFT — solo parade', '#ffd166');
          g.audio.say('Back to one player!', true);
        }
        // Art style A/B: B swaps the frogs for the Blender kawaii build.
        const bHeld = inp.keys.has('KeyB');
        if (bHeld && !this.artKeyHeld) {
          g.save.classicArt = !g.save.classicArt;
          g.persist();
          g.audio.sfx('uiPick');
          this.banner(g.save.classicArt ? '🎨 CLASSIC art mode' : '🎨 kawaii art', '#ff8fb3');
          g.audio.say(g.save.classicArt ? 'Classic art mode! So retro!' : 'Kawaii mode!', true);
        }
        this.artKeyHeld = bHeld;
        const n = 12;
        if (inp.anyMenu('up')) { this.menuIdx = (this.menuIdx + n - 1) % n; g.audio.sfx('uiMove'); }
        if (inp.anyMenu('down')) { this.menuIdx = (this.menuIdx + 1) % n; g.audio.sfx('uiMove'); }
        const dir = inp.anyMenu('right') ? 1 : inp.anyMenu('left') ? -1 : 0;
        if (dir) {
          if (this.menuIdx === 1 || this.menuIdx === 2) {
            const pl = this.menuIdx - 1;
            g.save.chars[pl] = ((g.save.chars[pl] || 0) + dir + CHARACTERS.length) % CHARACTERS.length;
            g.persist(); g.audio.sfx('uiMove');
            g.audio.say(CHARACTERS[g.save.chars[pl]].name + '!', true);
          }
          if (this.menuIdx === 3) {
            const max = g.save.diffUnlocked || 0;
            g.save.diff = Math.min(max, Math.max(0, (g.save.diff || 0) + dir));
            g.persist(); g.audio.sfx('uiMove');
            g.audio.say(DIFFICULTIES[g.save.diff].name + '!', true);
          }
          if (this.menuIdx === 4 && g.save.endlessUnlocked) {
            g.save.mode = 1 - (g.save.mode || 0);
            g.persist(); g.audio.sfx('uiMove');
            g.audio.say(g.save.mode ? 'Keep marching! The endless parade!' : 'Story mode!', true);
          }
          if (this.menuIdx === 5) { g.save.little[0] = !g.save.little[0]; g.persist(); g.audio.sfx('uiMove'); }
          if (this.menuIdx === 6) { g.save.little[1] = !g.save.little[1]; g.persist(); g.audio.sfx('uiMove'); }
        }
        if (inp.anyPressed('confirm')) {
          g.audio.ensure();
          if (this.menuIdx === 0) {
            if (inp.deviceFor(0)) {
              g.state = 'loadout';
              this.loSlot = 0; this.loIdx = 0;
              g.audio.say('Pick up to three favorite critters for your parade!', true);
            }
          }
          else if (this.menuIdx === 1 || this.menuIdx === 2) {
            const pl = this.menuIdx - 1;
            g.save.chars[pl] = ((g.save.chars[pl] || 0) + 1) % CHARACTERS.length;
            g.persist();
            g.audio.say(CHARACTERS[g.save.chars[pl]].name + '!', true);
          }
          else if (this.menuIdx === 3) { /* difficulty changes with left/right */ }
          else if (this.menuIdx === 4) {
            if (g.save.endlessUnlocked) { g.save.mode = 1 - (g.save.mode || 0); g.persist(); }
          }
          else if (this.menuIdx === 5) { g.save.little[0] = !g.save.little[0]; g.persist(); }
          else if (this.menuIdx === 6) { g.save.little[1] = !g.save.little[1]; g.persist(); }
          else if (this.menuIdx === 7) {
            g.state = 'train'; this.trainIdx = 0;
            g.audio.say('Training camp! Spend banked acorns to make your critters stronger forever!', true);
          }
          else if (this.menuIdx === 8) {
            g.state = 'quests'; this.questIdx = 0;
            g.audio.say('Quests! Finish them for acorn bounties!', true);
          }
          else if (this.menuIdx === 9) {
            g.state = 'labconfig';
            if (!g.lab) g.lab = { arena: 0, char: 0, diff: 0, wave: 1, sp: 0, foe: 0 };
            this.labRow = 0;
          }
          else if (this.menuIdx === 10) g.setMuted(!g.audio.muted);
          else { g.state = 'saves'; this.saveMode = 'pick'; this.saveBtn = 0; }
          g.audio.sfx('uiPick');
        }
        break;
      }
      case 'crossroads': {
        if (this.uiLock > 0) break; // let the screen land before it listens
        if (this.shopMode) {
          const n = this.shopOffers.length + 1; // + DONE
          if (inp.anyMenu('left')) { this.shopIdx = (this.shopIdx + n - 1) % n; g.audio.sfx('uiMove'); }
          if (inp.anyMenu('right')) { this.shopIdx = (this.shopIdx + 1) % n; g.audio.sfx('uiMove'); }
          if (inp.anyPressed('confirm')) {
            if (this.shopIdx >= this.shopOffers.length) {
              this.shopMode = false;
              g.startWave(g.waveNum + 1);
            } else {
              const o = this.shopOffers[this.shopIdx];
              const bought = g.buyOffer(o, 0);
              if (!bought) { g.audio.sfx('uiMove'); this.shopIdx = (this.shopIdx + 1) % n; } // can't afford/sold: hop along
            }
          }
          break;
        }
        const slot = this.pickSlot;
        const nc = Math.max(1, this.cards.length);
        if (inp.menu(slot, 'left') || inp.anyMenu('left')) { this.cardIdx = (this.cardIdx + nc - 1) % nc; g.audio.sfx('uiMove'); }
        if (inp.menu(slot, 'right') || inp.anyMenu('right')) { this.cardIdx = (this.cardIdx + 1) % nc; g.audio.sfx('uiMove'); }
        if (inp.anyPressed('confirm')) {
          const c = this.cards[this.cardIdx];
          if (c) {
            g.applyChoice(c, slot);
            this.cards.splice(this.cardIdx, 1);
            this.cardIdx = Math.min(this.cardIdx, this.cards.length - 1);
          }
          this.picksLeft--;
          this.pickSlot++;
          if (this.picksLeft <= 0 || !this.cards.length) {
            this.shopMode = true;
            this.shopIdx = 0;
            this.uiLock = 0.4;
            this.shopOffers = g.makeShop();
            g.audio.say('The crossroads market is open! Spend acorns, or save them!');
          }
        }
        break;
      }
      case 'loadout': {
        const roster = g.unlockedList();
        const cells = 1 + roster.length + SPICES.length + 1; // arena + species + spices + GO
        if (this.loIdx == null) this.loIdx = 0;
        if (inp.anyMenu('left')) { this.loIdx = (this.loIdx + cells - 1) % cells; g.audio.sfx('uiMove'); }
        if (inp.anyMenu('right')) { this.loIdx = (this.loIdx + 1) % cells; g.audio.sfx('uiMove'); }
        if (inp.anyPressed('confirm')) {
          g.audio.sfx('uiPick');
          if (this.loIdx === 0) {
            // Arena cell: confirm cycles through unlocked arenas.
            const max = Math.min(g.save.arenasUnlocked || 0, ARENAS.length - 1);
            g.save.arena = ((g.save.arena || 0) + 1) % (max + 1);
            g.persist();
            const a2 = ARENAS[g.save.arena];
            g.audio.say(a2.name + '! ' + a2.blurb, true);
          } else if (this.loIdx >= 1 + roster.length && this.loIdx < 1 + roster.length + SPICES.length) {
            // Spice toggle.
            const si = this.loIdx - 1 - roster.length;
            g.save.spices[si] = !g.save.spices[si];
            g.persist();
            g.audio.say(g.save.spices[si]
              ? SPICES[si].name + ' spice on! More acorns, more trouble!'
              : SPICES[si].name + ' spice off!');
          } else if (this.loIdx >= 1 + roster.length + SPICES.length) {
            // GO: next player picks, or march.
            if (this.loSlot === 0 && g.input.deviceFor(1)) {
              this.loSlot = 1; this.loIdx = 0;
              g.audio.say('Player two! Pick up to three favorite critters!', true);
            } else {
              g.persist();
              g.startRun();
            }
          } else {
            const sp = roster[this.loIdx - 1];
            const lo = g.save.loadouts[this.loSlot];
            const at = lo.indexOf(sp);
            if (at >= 0) lo.splice(at, 1);
            else { if (lo.length >= 3) lo.shift(); lo.push(sp); g.audio.say(SPECIES[sp].name + '!'); }
            g.persist();
          }
        }
        break;
      }
      case 'run':
        if (g.paused) {
          const n = 7;
          const st = g.save.settings;
          if (inp.anyMenu('up')) { this.pauseIdx = (this.pauseIdx + n - 1) % n; g.audio.sfx('uiMove'); }
          if (inp.anyMenu('down')) { this.pauseIdx = (this.pauseIdx + 1) % n; g.audio.sfx('uiMove'); }
          const dir = inp.anyMenu('right') ? 1 : inp.anyMenu('left') ? -1 : 0;
          if (dir && this.pauseIdx === 1) {
            st.musicVol = Math.round(Math.max(0, Math.min(1, (st.musicVol != null ? st.musicVol : 1) + dir * 0.1)) * 10) / 10;
            g.audio.setVolumes(st.musicVol, st.sfxVol != null ? st.sfxVol : 1);
            g.persist(); g.audio.sfx('uiMove');
          }
          if (dir && this.pauseIdx === 2) {
            st.sfxVol = Math.round(Math.max(0, Math.min(1, (st.sfxVol != null ? st.sfxVol : 1) + dir * 0.1)) * 10) / 10;
            g.audio.setVolumes(st.musicVol != null ? st.musicVol : 1, st.sfxVol);
            g.persist(); g.audio.sfx('uiPick');
          }
          if (inp.anyPressed('confirm')) {
            if (this.pauseIdx === 0) g.paused = false;
            else if (this.pauseIdx === 3) {
              st.voice = st.voice === false;
              g.audio.voiceOff = st.voice === false;
              g.persist();
              if (st.voice) g.audio.say('The announcer is back!', true);
            }
            else if (this.pauseIdx === 4) g.setMuted(!g.audio.muted);
            else if (this.pauseIdx === 5) g.setShake(!g.fx.shakeEnabled);
            else if (this.pauseIdx === 6) { g.quitToTitle(); }
            g.audio.sfx('uiPick');
          }
        }
        break;
      case 'gameover': case 'victory':
        if (this.uiLock > 0) break;
        if (inp.anyPressed('confirm')) {
          g.audio.sfx('uiPick');
          if (g.draftOffers && g.draftOffers.length) {
            g.state = 'draft';
            this.uiLock = 0.5;
            this.draftIdx = 1;
            g.audio.say('Pick a new friend for your roster!', true);
          } else g.quitToTitle();
        }
        break;
      case 'labconfig': {
        const lab = g.lab;
        const rows = 5; // arena, character, difficulty, wave, START
        if (inp.anyMenu('up')) { this.labRow = (this.labRow + rows - 1) % rows; g.audio.sfx('uiMove'); }
        if (inp.anyMenu('down')) { this.labRow = (this.labRow + 1) % rows; g.audio.sfx('uiMove'); }
        const dir = inp.anyMenu('right') ? 1 : inp.anyMenu('left') ? -1 : 0;
        if (dir) {
          if (this.labRow === 0) lab.arena = (lab.arena + dir + ARENAS.length) % ARENAS.length;
          if (this.labRow === 1) lab.char = (lab.char + dir + CHARACTERS.length) % CHARACTERS.length;
          if (this.labRow === 2) lab.diff = (lab.diff + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
          if (this.labRow === 3) lab.wave = Math.max(1, Math.min(20, lab.wave + dir));
          g.audio.sfx('uiMove');
        }
        if (inp.anyPressed('back')) { g.state = 'title'; g.audio.sfx('uiMove'); }
        else if (inp.anyPressed('confirm')) {
          if (this.labRow === 4) { g.audio.sfx('uiPick'); g.startSandbox(); }
        }
        break;
      }
      case 'quests': {
        if (inp.anyPressed('back') || inp.anyPressed('confirm')) { g.state = 'title'; g.audio.sfx('uiPick'); }
        break;
      }
      case 'train': {
        // Two tabs: HERO (piper upgrades) and CRITTERS (species levels).
        this.trainTab = this.trainTab || 0;
        const items = this.trainTab === 0 ? PIPER_UPGRADES : SPECIES_IDS;
        const cells = items.length + 1; // + back
        if (inp.anyMenu('up') || inp.anyMenu('down')) {
          this.trainTab = 1 - this.trainTab; this.trainIdx = 0;
          g.audio.sfx('uiMove');
          g.audio.say(this.trainTab === 0 ? 'Hero upgrades!' : 'Critter training!');
        }
        if (inp.anyMenu('left')) { this.trainIdx = (this.trainIdx + cells - 1) % cells; g.audio.sfx('uiMove'); if (this.trainTab === 1 && this.trainIdx < items.length && g.unlocked(items[this.trainIdx])) g.audio.sfx(SPECIES[items[this.trainIdx]].sound); }
        if (inp.anyMenu('right')) { this.trainIdx = (this.trainIdx + 1) % cells; g.audio.sfx('uiMove'); if (this.trainTab === 1 && this.trainIdx < items.length && g.unlocked(items[this.trainIdx])) g.audio.sfx(SPECIES[items[this.trainIdx]].sound); }
        if (inp.anyPressed('back')) { g.state = 'title'; g.audio.sfx('uiMove'); }
        else if (inp.anyPressed('confirm')) {
          if (this.trainIdx >= items.length) { g.state = 'title'; g.audio.sfx('uiPick'); }
          else if (this.trainTab === 0) { if (!g.buyPup(items[this.trainIdx].id)) g.audio.sfx('uiMove'); }
          else if (!g.trainSpecies(items[this.trainIdx])) g.audio.sfx('uiMove');
        }
        break;
      }
      case 'draft': {
        if (this.uiLock > 0) break;
        const n = g.draftOffers.length;
        if (inp.anyMenu('left')) { this.draftIdx = (this.draftIdx + n - 1) % n; g.audio.sfx('uiMove'); g.audio.say(SPECIES[g.draftOffers[this.draftIdx]].name); }
        if (inp.anyMenu('right')) { this.draftIdx = (this.draftIdx + 1) % n; g.audio.sfx('uiMove'); g.audio.say(SPECIES[g.draftOffers[this.draftIdx]].name); }
        if (inp.anyPressed('confirm')) {
          g.applyDraft(g.draftOffers[this.draftIdx]);
          g.draftOffers = [];
          g.quitToTitle();
        }
        break;
      }
    }
  }

  // ============ RENDER ============
  // Speak the focused save slot for the pre-readers.
  saySlot(g) {
    const s = g.loadSlot(this.saveIdx);
    g.audio.say(s
      ? 'Save file ' + (this.saveIdx + 1) + '. Best wave ' + (s.bestWave || 0) + '. ' + (s.acorns || 0) + ' acorns.'
      : 'Save file ' + (this.saveIdx + 1) + '. Empty. A fresh start!');
  }

  render(ctx) {
    const g = this.g;
    switch (g.state) {
      case 'intro': this.renderIntro(ctx); break;
      case 'saves': this.renderSaves(ctx); break;
      case 'title': this.renderTitle(ctx); break;
      case 'loadout': this.renderLoadout(ctx); break;
      case 'draft': this.renderDraft(ctx); break;
      case 'train': this.renderTrain(ctx); break;
      case 'quests': this.renderQuests(ctx); break;
      case 'labconfig': this.renderLabConfig(ctx); break;
      case 'run': this.renderWorld(ctx); this.renderWeather(ctx); this.renderHUD(ctx); if (g.paused) this.renderPause(ctx); break;
      case 'crossroads': this.renderWorld(ctx); this.renderCrossroads(ctx); break;
      case 'gameover': this.renderWorld(ctx); this.renderEnd(ctx, false); break;
      case 'victory': this.renderWorld(ctx); this.renderEnd(ctx, true); break;
    }
  }

  meadow(ctx, w, h, ox, oy) {
    ctx.fillStyle = '#79b562';
    ctx.fillRect(0, 0, w, h);
  }

  renderWorld(ctx) {
    const g = this.g, cam = g.camera;
    const cx = lerp(cam.px, cam.x, g.alpha);
    const cy = lerp(cam.py, cam.y, g.alpha);
    const cz = lerp(cam.pz, cam.zoom, g.alpha);

    ctx.fillStyle = '#5a8a4a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(VIEW_W / 2 + g.fx.shakeX, VIEW_H / 2 + g.fx.shakeY);
    ctx.scale(cz, cz);
    ctx.translate(-cx, -cy);

    // Meadow (arena-tinted).
    const ar = g.arenaDef || ARENAS[0];
    ctx.fillStyle = ar.ground || '#79b562';
    ctx.fillRect(0, 0, g.arena.w, g.arena.h);
    if (ar.night) {
      // Rooftop: helipad rings + neon edge glow instead of mow stripes.
      ctx.strokeStyle = 'rgba(90,223,255,0.16)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(g.arena.w / 2, g.arena.h / 2, 220, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,95,180,0.13)'; ctx.lineWidth = 6;
      ctx.strokeRect(60, 60, g.arena.w - 120, g.arena.h - 120);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < g.arena.h; y += 160) ctx.fillRect(0, y, g.arena.w, 80);
    } else {
      // Mowed-stripe texture (the Tidy Empire's dream, our battlefield).
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = 0; y < g.arena.h; y += 120) ctx.fillRect(0, y, g.arena.w, 60);
    }
    // Water zones (under everything that walks).
    if (g.zones && g.zones.length) {
      for (const z of g.zones) {
        if (z.type === 'hill') {
          const grd2 = ctx.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
          grd2.addColorStop(0, 'rgba(255,255,255,0.22)');
          grd2.addColorStop(0.7, 'rgba(255,255,255,0.05)');
          grd2.addColorStop(1, 'rgba(20,25,15,0.22)');
          ctx.fillStyle = grd2;
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.fill();
          ctx.strokeStyle = 'rgba(30,35,25,0.35)'; ctx.lineWidth = 3;
          ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        if (z.type === 'mud') {
          const gr = (g.mudGrow || 1);
          ctx.fillStyle = ar.mudColor || '#6f5230';
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r * gr, 0, 6.29); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.beginPath(); ctx.ellipse(z.x - z.r * 0.25, z.y - z.r * 0.3, z.r * 0.4 * gr, z.r * 0.22 * gr, 0.4, 0, 6.29); ctx.fill();
          ctx.strokeStyle = 'rgba(40,28,14,0.5)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r * gr, 0, 6.29); ctx.stroke();
          continue;
        }
        if (z.type !== 'water') continue;
        ctx.fillStyle = ar.waterColor || '#5aa9dd';
        if (z.shape === 'circle') {
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.29); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r - 5, 0, 6.29); ctx.stroke();
          // Ripples.
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
          const rp = (this.t * 20) % 40;
          ctx.beginPath(); ctx.arc(z.x, z.y, Math.max(6, z.r - 40 - rp), 0, 6.29); ctx.stroke();
        } else {
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
          for (let yy = z.y + 18; yy < z.y + z.h - 8; yy += 34) {
            const sway = Math.sin(this.t * 2 + yy * 0.1) * 5;
            ctx.beginPath(); ctx.moveTo(z.x + 12 + sway, yy); ctx.lineTo(z.x + z.w - 12 + sway, yy); ctx.stroke();
          }
        }
      }
      // Bridges (visual only — the water simply has gaps there).
      for (const b of (ar.bridges || [])) {
        ctx.fillStyle = '#a5844f';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#7a5f38'; ctx.lineWidth = 2;
        for (let yy = b.y + 8; yy < b.y + b.h; yy += 14) {
          ctx.beginPath(); ctx.moveTo(b.x, yy); ctx.lineTo(b.x + b.w, yy); ctx.stroke();
        }
        ctx.fillStyle = '#7a5f38';
        ctx.fillRect(b.x - 4, b.y, 5, b.h); ctx.fillRect(b.x + b.w - 1, b.y, 5, b.h);
      }
    }
    // Fire vents: grate → orange glow → FLAME. Learn the rhythm.
    if (g.vents && g.vents.length) {
      for (const v of g.vents) {
        // Grate.
        ctx.fillStyle = '#23262f';
        ctx.beginPath(); ctx.arc(v.x, v.y, 26, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#4a4f5e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(v.x, v.y, 26, 0, 6.29); ctx.stroke();
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(v.x - 18, v.y + k * 10); ctx.lineTo(v.x + 18, v.y + k * 10); ctx.stroke();
        }
        if (v.stage === 1) {
          // Warning glow.
          ctx.globalAlpha = 0.35 + Math.sin(this.t * 14) * 0.2;
          ctx.fillStyle = '#ff7a2e';
          ctx.beginPath(); ctx.arc(v.x, v.y, 66, 0, 6.29); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (v.stage === 2) {
          // FLAME: layered tongues.
          const fl = Math.sin(this.t * 22);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ff8a2e';
          ctx.beginPath();
          ctx.moveTo(v.x - 30, v.y + 8);
          ctx.quadraticCurveTo(v.x - 20, v.y - 60 - fl * 8, v.x, v.y - 88 - fl * 12);
          ctx.quadraticCurveTo(v.x + 20, v.y - 60 + fl * 8, v.x + 30, v.y + 8);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.moveTo(v.x - 16, v.y + 6);
          ctx.quadraticCurveTo(v.x - 8, v.y - 40 + fl * 6, v.x, v.y - 58 - fl * 8);
          ctx.quadraticCurveTo(v.x + 8, v.y - 40 - fl * 6, v.x + 16, v.y + 6);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    // Obstacles: rocks and low walls (entities slide along these).
    if (g.obstacles && g.obstacles.length) {
      for (const ob of g.obstacles) {
        if (ob.kind === 'rock') {
          ctx.fillStyle = 'rgba(30,45,20,0.25)';
          ctx.beginPath(); ctx.ellipse(ob.x + 4, ob.y + ob.r * 0.55, ob.r, ob.r * 0.4, 0, 0, 6.29); ctx.fill();
          if (ob.hay) {
            ctx.fillStyle = '#d8b45a';
            ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, 6.29); ctx.fill();
            ctx.strokeStyle = '#a5814f'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, 6.29); ctx.stroke();
            ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r * 0.62, 0, 6.29); ctx.stroke();
            ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r * 0.3, 0, 6.29); ctx.stroke();
            continue;
          }
          ctx.fillStyle = '#9aa294';
          ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#b8beb0';
          ctx.beginPath(); ctx.arc(ob.x - ob.r * 0.3, ob.y - ob.r * 0.35, ob.r * 0.5, 0, 6.29); ctx.fill();
          ctx.strokeStyle = '#6a7264'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, 6.29); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(30,45,20,0.25)';
          ctx.fillRect(ob.x + 4, ob.y + 6, ob.w, ob.h);
          if (ob.barn) {
            // The red barn, now with collision.
            ctx.fillStyle = '#b53a2e';
            ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
            ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 4;
            ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
            ctx.fillStyle = '#8a2a22';
            ctx.beginPath();
            ctx.moveTo(ob.x - 16, ob.y);
            ctx.lineTo(ob.x + ob.w / 2, ob.y - 52);
            ctx.lineTo(ob.x + ob.w + 16, ob.y);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(ob.x + ob.w / 2 - 30, ob.y + ob.h - 62, 60, 62);
            ctx.strokeStyle = '#f0e6d0'; ctx.lineWidth = 3;
            ctx.strokeRect(ob.x + ob.w / 2 - 30, ob.y + ob.h - 62, 60, 62);
            continue;
          }
          ctx.fillStyle = '#c9b28a';
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
          ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3;
          ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
          const across = ob.w > ob.h;
          for (let k = 1; k < (across ? ob.w : ob.h) / 34; k++) {
            ctx.beginPath();
            if (across) { ctx.moveTo(ob.x + k * 34, ob.y); ctx.lineTo(ob.x + k * 34, ob.y + ob.h); }
            else { ctx.moveTo(ob.x, ob.y + k * 34); ctx.lineTo(ob.x + ob.w, ob.y + k * 34); }
            ctx.stroke();
          }
        }
      }
    }
    // Decor.
    for (const d of g.decor) {
      if (d.kind === 0) {
        ctx.fillStyle = d.c;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.257;
          ctx.beginPath(); ctx.ellipse(d.x + Math.cos(a) * 5 * d.s, d.y + Math.sin(a) * 5 * d.s, 3.4 * d.s, 2.2 * d.s, a, 0, 6.29); ctx.fill();
        }
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(d.x, d.y, 2.6 * d.s, 0, 6.29); ctx.fill();
      } else if (d.kind === 1) {
        ctx.strokeStyle = '#5f9a4e'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(d.x + i * 3, d.y + 3); ctx.quadraticCurveTo(d.x + i * 5, d.y - 4, d.x + i * 6, d.y - 8 * d.s); ctx.stroke();
        }
      } else if (d.kind === 2) {
        ctx.fillStyle = '#8a9484';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 6 * d.s, 4 * d.s, 0.4, 0, 6.29); ctx.fill();
      } else {
        ctx.fillStyle = '#6aa557';
        ctx.beginPath(); ctx.arc(d.x, d.y, 8 * d.s, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#79b562';
        ctx.beginPath(); ctx.arc(d.x - 2, d.y - 2, 5 * d.s, 0, 6.29); ctx.fill();
      }
    }
    // Hedge border.
    ctx.fillStyle = '#3f6e35';
    for (let x = 0; x < g.arena.w; x += 46) {
      ctx.beginPath(); ctx.arc(x + 23, 12, 24, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 23, g.arena.h - 12, 24, 0, 6.29); ctx.fill();
    }
    for (let y = 0; y < g.arena.h; y += 46) {
      ctx.beginPath(); ctx.arc(12, y + 23, 24, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(g.arena.w - 12, y + 23, 24, 0, 6.29); ctx.fill();
    }

    // Cages.
    for (const c of g.cages) {
      const wb = Math.sin(c.wob) * 2;
      if (c.rescue) {
        // Golden rescue cage: glowing beacon of hope.
        ctx.globalAlpha = 0.25 + Math.sin(this.t * 5) * 0.12;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, 6.29); ctx.fill();
        ctx.globalAlpha = 1;
      }
      const cageImg = !g.save.classicArt && g.artFrames.props
        ? g.artFrames.props[c.rescue ? 'rescuecage' : 'cage'] : null;
      if (cageImg && cageImg.complete && cageImg.naturalWidth) {
        ctx.drawImage(cageImg, c.x - 30, c.y - 34 + wb, 60, 60);
      } else {
        ctx.fillStyle = c.rescue ? '#d4a437' : '#8a6b45';
        rr(ctx, c.x - 16, c.y - 14 + wb, 32, 26, 4); ctx.fill();
        ctx.strokeStyle = c.rescue ? '#8a6b1e' : '#5a4632'; ctx.lineWidth = 2.5;
        rr(ctx, c.x - 16, c.y - 14 + wb, 32, 26, 4); ctx.stroke();
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(c.x + i * 8, c.y - 14 + wb); ctx.lineTo(c.x + i * 8, c.y + 12 + wb); ctx.stroke();
        }
        // Peeking eyes!
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(c.x - 4, c.y - 2 + wb, 3, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x + 4, c.y - 2 + wb, 3, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath(); ctx.arc(c.x - 4 + Math.sin(c.wob) * 1.4, c.y - 2 + wb, 1.4, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x + 4 + Math.sin(c.wob) * 1.4, c.y - 2 + wb, 1.4, 0, 6.29); ctx.fill();
      }
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', c.x, c.y - (cageImg && cageImg.complete && cageImg.naturalWidth ? 38 : 22) + wb);
    }

    // Skunk clouds.
    for (const c of g.clouds) {
      ctx.globalAlpha = Math.min(0.4, c.life * 0.3);
      ctx.fillStyle = '#9adf75';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.29); ctx.fill();
      ctx.globalAlpha = Math.min(0.3, c.life * 0.2);
      ctx.fillStyle = '#c8f0a8';
      ctx.beginPath(); ctx.arc(c.x + Math.sin(g.time * 3) * 8, c.y - 5, c.r * 0.6, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Acorns.
    const A = g.acornsList;
    for (let i = 0; i < A.n; i++) {
      const a = A.get(i);
      const x = lerp(a.px, a.x, g.alpha), y = lerp(a.py, a.y, g.alpha) + Math.sin(a.bob) * 2;
      const acornImg = !g.save.classicArt && g.artFrames.props ? g.artFrames.props.acorn : null;
      if (acornImg && acornImg.complete && acornImg.naturalWidth) {
        ctx.drawImage(acornImg, x - 10, y - 12, 20, 20);
      } else {
        ctx.fillStyle = '#c9843a';
        ctx.beginPath(); ctx.ellipse(x, y + 1, 4, 5, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#8a5a2a';
        ctx.beginPath(); ctx.arc(x, y - 3, 3.6, Math.PI, 0); ctx.fill();
      }
    }

    // Snacks (healing apples — bots confiscate them from picnics).
    for (const s of g.snacks) {
      const y2 = s.y + Math.sin(s.bob) * 2;
      const appleImg = !g.save.classicArt && g.artFrames.props ? g.artFrames.props.apple : null;
      if (appleImg && appleImg.complete && appleImg.naturalWidth) {
        ctx.drawImage(appleImg, s.x - 14, y2 - 16, 28, 28);
        continue;
      }
      ctx.fillStyle = '#e05c5c';
      ctx.beginPath(); ctx.arc(s.x, y2, 6.5, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ff9a9a';
      ctx.beginPath(); ctx.arc(s.x - 2, y2 - 2, 2.2, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#5a8a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, y2 - 6); ctx.quadraticCurveTo(s.x + 3, y2 - 10, s.x + 5, y2 - 9); ctx.stroke();
      ctx.fillStyle = '#7ec850';
      ctx.beginPath(); ctx.ellipse(s.x + 4, y2 - 9, 3, 1.8, 0.5, 0, 6.29); ctx.fill();
    }

    g.enemies.renderGround(ctx);
    g.enemies.render(ctx, g.alpha, g);
    g.mob.render(ctx, g.alpha, g);
    for (const p of g.players) p.render(ctx, g.alpha, g);

    // Projectiles.
    const P = g.proj;
    for (let i = 0; i < P.n; i++) {
      const pr = P.get(i);
      const x = lerp(pr.px, pr.x, g.alpha), y = lerp(pr.py, pr.y, g.alpha);
      if (pr.spin) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pr.ang);
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-6, -4, 12, 8);
        ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -4, 12, 8);
        ctx.restore();
      } else {
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(x, y, pr.friendly ? 4 : 5.5, 0, 6.29); ctx.fill();
        if (!pr.friendly) { ctx.strokeStyle = 'rgba(60,50,20,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }

    g.fx.render(ctx, g.alpha);
    ctx.restore();
  }

  renderWeather(ctx) {
    const g = this.g;
    const wx = g.weather;
    // Screen-space weather overlays.
    if (g.ui && g.ui.lightningFlash > 0) { /* handled on this */ }
    if (this.lightningFlash > 0) {
      this.lightningFlash -= 1 / 60;
      ctx.fillStyle = 'rgba(255,255,240,' + Math.min(0.8, this.lightningFlash * 6) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (!wx || !wx.type) return;
    if (wx.type === 'rain') {
      ctx.strokeStyle = 'rgba(160,210,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const x = ((i * 97 + this.t * 520) % (VIEW_W + 80)) - 40;
        const y = ((i * 61 + this.t * 900) % (VIEW_H + 60)) - 30;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); ctx.stroke();
      }
    } else if (wx.type === 'wind') {
      ctx.strokeStyle = 'rgba(230,245,220,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const x = ((i * 173 + this.t * 640 * (g.windX || 1)) % (VIEW_W + 160)) - 80;
        const y = (i * 97) % VIEW_H + Math.sin(this.t * 3 + i) * 20;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 8, x + 60, y); ctx.stroke();
      }
    } else if (wx.type === 'lightning') {
      ctx.fillStyle = 'rgba(40,40,70,0.18)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Weather chip under the wave label.
    const label = wx.type === 'rain' ? '🌧️ RAIN — robots slowed, mud spreads'
      : wx.type === 'wind' ? '💨 WIND — shots & fliers drift'
      : '⚡ STORM — dodge the yellow circles!';
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d8ecff';
    ctx.strokeStyle = 'rgba(20,30,40,0.7)'; ctx.lineWidth = 4;
    ctx.strokeText(label, VIEW_W / 2, 112);
    ctx.fillText(label, VIEW_W / 2, 112);
  }

  renderLabOverlay(ctx) {
    const g = this.g;
    const lab = g.lab;
    const FOES = Object.keys(ENEMIES);
    ctx.fillStyle = 'rgba(20,25,35,0.75)';
    rr(ctx, 8, VIEW_H - 76, 700, 66, 10); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = '#8fd0ff';
    ctx.fillText('🧪 LAB   critter: ' + SPECIES[SPECIES_IDS[lab.sp]].name + '   enemy: ' + ENEMIES[FOES[lab.foe]].name
      + '   wave: ' + g.waveNum + (g.sandboxWaves ? ' (spawning!)' : '') + (g.labInvuln ? '   INVULNERABLE' : ''), 20, VIEW_H - 52);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('[ ] critter · 1/2/3 tier · , . enemy · E/R spawn/elite · X clear · V waves · +/− wave · I invuln · H heal · G acorns', 20, VIEW_H - 30);
    ctx.textAlign = 'center';
  }

  renderHUD(ctx) {
    if (this.g.sandbox) this.renderLabOverlay(ctx);
    const g = this.g;
    // THE MOB COUNTER — the star of the HUD.
    const mc = g.mob.count();
    const pop = this.mobPop > 0 ? 1 + this.mobPop * 0.8 : 1;
    ctx.save();
    ctx.translate(VIEW_W / 2, 46);
    ctx.scale(pop, pop);
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.75)';
    ctx.lineWidth = 6;
    ctx.strokeText(`MOB ${mc}`, 0, 0);
    ctx.fillStyle = mc >= MOB_CAP ? '#ffd166' : '#fff';
    ctx.fillText(`MOB ${mc}`, 0, 0);
    ctx.restore();
    // Mob health bar — see the wall wearing down BEFORE it collapses.
    const mh = g.mob.mobHealth();
    const mbw = 150;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rr(ctx, VIEW_W / 2 - mbw / 2, 56, mbw, 9, 4); ctx.fill();
    if (mh.max > 0 && mh.frac > 0) {
      const hurting = mh.frac < 0.5;
      ctx.fillStyle = hurting ? (Math.sin(this.t * 8) > 0 ? '#ff5c5c' : '#c53030') : mh.frac < 0.75 ? '#e8c33a' : '#7ec850';
      rr(ctx, VIEW_W / 2 - mbw / 2, 56, Math.max(6, mbw * mh.frac), 9, 4); ctx.fill();
      if (hurting) {
        ctx.font = `bold 12px ${FONT}`;
        ctx.fillStyle = '#ff8a8a';
        ctx.fillText('MOB HURT — recall & let them heal!', VIEW_W / 2, 80);
      }
    }
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(g.save.mode === 1
      ? `wave ${g.waveNum} · ♾ ENDLESS · ${Math.ceil(g.waveT)}s`
      : `wave ${g.waveNum}/12 · ${Math.ceil(g.waveT)}s`, VIEW_W / 2, mh.frac < 0.5 ? 94 : 80);

    // Piper HP bars — big, labeled, they POP on damage.
    g.players.forEach((p, i) => {
      const pop = this.heartPop > 0 ? 1 + this.heartPop * 0.35 : 1;
      const bw = 190 * pop, bh = 18 * pop;
      const x = i === 0 ? 18 : VIEW_W - 18 - bw;
      const frac = Math.max(0, p.hp / p.maxHp);
      const low = frac < 0.25 && !p.downed;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = p.color;
      ctx.fillText(`P${i + 1} — YOUR PIPER${p.little ? ' ★' : ''}${p.downed ? '  (DOWN!)' : ''}`, x, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      rr(ctx, x, 22, bw, bh, 6); ctx.fill();
      ctx.fillStyle = low ? (Math.sin(this.t * 10) > 0 ? '#ff5c5c' : '#b53030') : frac < 0.55 ? '#e8c33a' : '#7ec850';
      if (frac > 0) { rr(ctx, x, 22, Math.max(8, bw * frac), bh, 6); ctx.fill(); }
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, x + bw / 2, 35);
      // Shield vs hunters readout for this piper.
      const co = g.mob.counts(p.slot);
      ctx.textAlign = 'left';
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = '#aef2ff';
      ctx.fillText(`🛡 ${co.shield}`, x, 60);
      ctx.fillStyle = '#ff9a6a';
      ctx.fillText(`⚔ ${co.attack}`, x + 64, 60);
    });

    // Damage flash: red vignette + center callout. Nobody misses this now.
    if (this.dmgFlash > 0) {
      const a = Math.min(0.5, this.dmgFlash);
      const grd = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
      grd.addColorStop(0, 'rgba(220,40,40,0)');
      grd.addColorStop(1, `rgba(220,40,40,${a})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = `bold 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(40,10,10,0.85)';
      ctx.lineWidth = 6;
      ctx.strokeText(this.dmgMsg, VIEW_W / 2, VIEW_H * 0.22);
      ctx.fillStyle = '#ff8a8a';
      ctx.fillText(this.dmgMsg, VIEW_W / 2, VIEW_H * 0.22);
    }
    // Persistent last-heart heartbeat vignette.
    const dying = g.players.find(p => !p.dead && !p.downed && p.hp / p.maxHp < 0.25);
    if (dying && this.dmgFlash <= 0) {
      const pulse = (Math.sin(this.t * 6) + 1) / 2;
      const grd = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
      grd.addColorStop(0, 'rgba(220,40,40,0)');
      grd.addColorStop(1, `rgba(220,40,40,${0.10 + pulse * 0.12})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Contextual coaching: first time the piper gets hit, teach TO ME!.
    if (this.recallHintT > 0) {
      ctx.font = `bold 19px ${FONT}`;
      ctx.textAlign = 'center';
      const blink = 0.65 + Math.sin(this.t * 5) * 0.3;
      ctx.fillStyle = `rgba(174,242,255,${blink})`;
      ctx.strokeStyle = 'rgba(20,40,50,0.8)';
      ctx.lineWidth = 5;
      const msg = `hold ${g.input.glyph(0, 'recall')} — call your hunters back to SHIELD you!`;
      ctx.strokeText(msg, VIEW_W / 2, VIEW_H * 0.3);
      ctx.fillText(msg, VIEW_W / 2, VIEW_H * 0.3);
    }

    // Acorns.
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('🌰 ' + g.wallet + ' to spend', 18, 76);

    // Species tally (bottom-left): icon dots + counts.
    const tally = {};
    for (const c of g.mob.list) {
      if (c.bagged) continue;
      const k = c.sp + c.tier;
      tally[k] = tally[k] || { sp: c.sp, tier: c.tier, n: 0 };
      tally[k].n++;
    }
    const rows = Object.values(tally).sort((a, b) => (b.tier - a.tier) || (b.n - a.n)).slice(0, 8);
    let tx = 18;
    for (const r of rows) {
      const def = SPECIES[r.sp];
      ctx.fillStyle = def.body;
      ctx.beginPath(); ctx.arc(tx + 7, VIEW_H - 24, 6 + r.tier * 1.6, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(30,45,20,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx + 7, VIEW_H - 24, 6 + r.tier * 1.6, 0, 6.29); ctx.stroke();
      if (r.tier >= 2) drawCrown(ctx, tx + 7, VIEW_H - 36 - r.tier, 8);
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`×${r.n}`, tx + 16 + r.tier, VIEW_H - 20);
      tx += 44 + r.tier * 3;
    }

    // Boss bar.
    if (g.boss) {
      const b = g.boss;
      const w = Math.min(520, VIEW_W - 220);
      const x = (VIEW_W - w) / 2, y = VIEW_H - 46;
      ctx.fillStyle = 'rgba(20,30,15,0.7)';
      rr(ctx, x - 8, y - 22, w + 16, 44, 8); ctx.fill();
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8c33a';
      ctx.fillText(b.def.name, VIEW_W / 2, y - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      rr(ctx, x, y, w, 12, 6); ctx.fill();
      const f = clamp(b.hp / b.maxHp, 0, 1);
      if (f > 0) { ctx.fillStyle = '#e05c5c'; rr(ctx, x, y, Math.max(10, w * f), 12, 6); ctx.fill(); }
    }

    // Staged wave-1 coaching: one idea at a time.
    if (g.waveNum === 1 && g.runStats.time < 17) {
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${0.65 + Math.sin(this.t * 4) * 0.3})`;
      ctx.strokeStyle = 'rgba(30,45,20,0.7)';
      ctx.lineWidth = 5;
      const msg = g.runStats.time < 6
        ? 'your critters circle you — they are your SHIELD!'
        : g.runStats.time < 11
        ? `tap ${g.input.glyph(0, 'whistle')} — send ONE critter out to attack!`
        : `tap ${g.input.glyph(0, 'recall')} to call one back. Balance shield vs attack!`;
      ctx.strokeText(msg, VIEW_W / 2, VIEW_H - 70);
      ctx.fillText(msg, VIEW_W / 2, VIEW_H - 70);
    }

    // Low-mob guidance: gold arrow to the nearest cage while rebuilding.
    if (!g.lastStand && g.state === 'run' && g.mob.count() < 5 && g.cages.length) {
      const p = g.players.find(q => !q.dead && !q.downed);
      if (p) {
        let best = g.cages[0], bd = Infinity;
        for (const cg of g.cages) {
          const d = (cg.x - p.x) ** 2 + (cg.y - p.y) ** 2;
          if (d < bd) { bd = d; best = cg; }
        }
        const a = Math.atan2(best.y - p.y, best.x - p.x);
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(VIEW_W / 2, VIEW_H / 2);
        ctx.rotate(a);
        ctx.translate(130 + Math.sin(this.t * 6) * 10, 0);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // MEGA-CELEBRATION: rainbow CONGRATULATIONS!!! letter slam.
    if (g.celebration && g.celebration.big) {
      const word = 'CONGRATULATIONS!!!';
      const RAIN = ['#ff5c9e', '#ff9a3c', '#ffd166', '#7ec850', '#5aa9ff', '#c792ea'];
      ctx.save();
      ctx.textAlign = 'center';
      const shown = Math.min(word.length, Math.floor(g.celebration.t / 0.09));
      let totalW = 0;
      ctx.font = 'bold 62px ' + FONT;
      const widths = [...word].map(ch => ctx.measureText(ch).width);
      for (let i = 0; i < word.length; i++) totalW += widths[i];
      let cx = VIEW_W / 2 - totalW / 2;
      for (let i = 0; i < shown; i++) {
        const wob = Math.sin(this.t * 6 + i * 0.8) * 6;
        ctx.fillStyle = RAIN[i % RAIN.length];
        ctx.strokeStyle = 'rgba(30,20,10,0.85)'; ctx.lineWidth = 8;
        ctx.strokeText(word[i], cx + widths[i] / 2, VIEW_H * 0.36 + wob);
        ctx.fillText(word[i], cx + widths[i] / 2, VIEW_H * 0.36 + wob);
        cx += widths[i];
      }
      ctx.restore();
    }

    // LAST STAND: mob gone — countdown + arrow to the nearest cage.
    if (g.lastStand) {
      const pulse = 1 + Math.sin(this.t * 8) * 0.08;
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H * 0.42);
      ctx.scale(pulse, pulse);
      ctx.font = `bold 54px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(40,10,10,0.9)'; ctx.lineWidth = 8;
      ctx.strokeText(Math.ceil(g.lastStand.t), 0, 0);
      ctx.fillStyle = '#ff5c5c';
      ctx.fillText(Math.ceil(g.lastStand.t), 0, 0);
      ctx.restore();
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(40,10,10,0.8)'; ctx.lineWidth = 5;
      ctx.strokeText('LAST STAND — free a cage to rebuild the mob!', VIEW_W / 2, VIEW_H * 0.42 + 44);
      ctx.fillText('LAST STAND — free a cage to rebuild the mob!', VIEW_W / 2, VIEW_H * 0.42 + 44);
      // Arrow to nearest cage.
      const p = g.players.find(q => !q.dead && !q.downed);
      if (p && g.cages.length) {
        let best = g.cages[0], bd = Infinity;
        for (const cg of g.cages) {
          const d = (cg.x - p.x) ** 2 + (cg.y - p.y) ** 2;
          if (d < bd) { bd = d; best = cg; }
        }
        const a = Math.atan2(best.y - p.y, best.x - p.x);
        ctx.save();
        ctx.translate(VIEW_W / 2, VIEW_H / 2);
        ctx.rotate(a);
        ctx.translate(150 + Math.sin(this.t * 6) * 12, 0);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(22, 0); ctx.lineTo(-10, -14); ctx.lineTo(-10, 14);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // Banner.
    if (this.bannerData) {
      const b = this.bannerData;
      const t = b.t / b.max;
      const pop2 = t > 0.85 ? 1 + (1 - (t - 0.85) / 0.15) * 0.15 : 1;
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H * 0.3);
      ctx.scale(pop2, pop2);
      ctx.globalAlpha = Math.min(1, t * 4);
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(30,45,20,0.8)';
      ctx.lineWidth = 6;
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  renderCrossroads(ctx) {
    const g = this.g;
    if (this.shopMode) { this.renderShop(ctx); return; }
    ctx.fillStyle = 'rgba(25,40,18,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 36px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.8)'; ctx.lineWidth = 5;
    ctx.strokeText('THE MOB GROWS', VIEW_W / 2, 110);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('THE MOB GROWS', VIEW_W / 2, 110);
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#d8ecc8';
    const who = g.players.length > 1 ? `PLAYER ${this.pickSlot + 1} picks!` : 'pick one!';
    ctx.fillText(who, VIEW_W / 2, 145);

    const cw = 300, ch = 340;
    const total = this.cards.length;
    this.cards.forEach((c, i) => {
      const x = VIEW_W / 2 + (i - (total - 1) / 2) * (cw + 30) - cw / 2;
      const y = 190;
      const hot = this.cardIdx === i;
      const lift = hot ? -14 : 0;
      ctx.fillStyle = hot ? '#fff8e8' : 'rgba(245,240,225,0.92)';
      rr(ctx, x, y + lift, cw, ch, 16); ctx.fill();
      ctx.strokeStyle = hot ? '#ffd166' : '#8a9a72';
      ctx.lineWidth = hot ? 5 : 3;
      rr(ctx, x, y + lift, cw, ch, 16); ctx.stroke();

      // Card art: species portrait or symbol.
      if (c.kind === 'pack' || (c.needsUnlock && SPECIES[c.needsUnlock])) {
        const sp = c.species || c.needsUnlock;
        if (sp && SPECIES[sp]) {
          const spr = g.mob.sprite(sp, c.kind === 'pack' ? 1 : 1);
          const scale = hot ? 2.6 : 2.3;
          ctx.save();
          ctx.translate(x + cw / 2, y + lift + 110);
          ctx.scale(scale, scale);
          if (hot) ctx.rotate(Math.sin(this.t * 5) * 0.08);
          ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
          ctx.restore();
        }
      } else {
        ctx.font = `${hot ? 74 : 64}px sans-serif`;
        ctx.textAlign = 'center';
        const glyphs = { star: '⭐', heart: '💪', wind: '💨', bolt: '⚡', burst: '💥', note: '🎵', swirl: '😵', crown: '👑' };
        ctx.fillText(glyphs[c.icon] || '✨', x + cw / 2, y + lift + 135);
      }

      ctx.font = `bold 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4a3a24';
      ctx.fillText(c.title, x + cw / 2, y + lift + 220);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = '#6a5a44';
      this.wrap(ctx, c.desc, x + cw / 2, y + lift + 252, cw - 40, 20);
      if (c.kind === 'pack' && SPECIES[c.species]) {
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillStyle = '#8a7a5a';
        const def = SPECIES[c.species];
        ctx.fillText(`${def.role.toUpperCase()} · dmg ${def.dmg} · hp ${def.hp}`, x + cw / 2, y + lift + ch - 24);
      }
      if (hot) {
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillStyle = '#c9531a';
        ctx.fillText(`${g.input.glyph(this.pickSlot, 'confirm')} — take it!`, x + cw / 2, y + lift + ch + 30);
      }
    });
  }

  renderPause(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(25,40,18,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 42px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(g.pauseReason ? '🎮 ' + g.pauseReason.toUpperCase() : 'PAUSED', VIEW_W / 2, 200);
    const st = g.save.settings;
    const bar = v => { const k = Math.round((v != null ? v : 1) * 10); return '▮'.repeat(k) + '▯'.repeat(10 - k); };
    const items = [
      'Keep marching',
      `Music: ◀ ${bar(st.musicVol)} ▶`,
      `Sounds: ◀ ${bar(st.sfxVol)} ▶`,
      `Announcer voice: ${st.voice === false ? 'OFF' : 'on'}`,
      `All sound: ${g.audio.muted ? 'OFF' : 'on'}`,
      `Screen shake: ${g.fx.shakeEnabled ? 'on' : 'off'}`,
      'Disband (quit)',
    ];
    items.forEach((s, i) => {
      ctx.font = `bold 21px ${FONT}`;
      ctx.fillStyle = this.pauseIdx === i ? '#ffd166' : '#d8ecc8';
      ctx.fillText((this.pauseIdx === i ? '🐸 ' : '') + s, VIEW_W / 2, 268 + i * 42);
    });
  }

  renderIntro(ctx) {
    const g = this.g;
    const t = this.introT || 0;
    // Sky + field.
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff'); grd.addColorStop(0.55, '#cdeeff');
    grd.addColorStop(0.55, '#79b562'); grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Sun.
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(VIEW_W - 160, 110, 46, 0, 6.29); ctx.fill();
    // The red barn.
    const bx = 210, by = VIEW_H * 0.55;
    ctx.fillStyle = '#b53a2e';
    ctx.fillRect(bx - 110, by - 120, 220, 120);
    ctx.fillStyle = '#8a2a22';
    ctx.beginPath(); ctx.moveTo(bx - 130, by - 120); ctx.lineTo(bx, by - 195); ctx.lineTo(bx + 130, by - 120); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(bx - 32, by - 74, 64, 74);
    ctx.strokeStyle = '#f0e6d0'; ctx.lineWidth = 4;
    ctx.strokeRect(bx - 32, by - 74, 64, 74);
    ctx.beginPath(); ctx.moveTo(bx - 32, by - 74); ctx.lineTo(bx + 32, by); ctx.moveTo(bx + 32, by - 74); ctx.lineTo(bx - 32, by); ctx.stroke();
    // Fence.
    ctx.fillStyle = '#c9b28a';
    for (let fx2 = 60; fx2 < VIEW_W; fx2 += 90) { ctx.fillRect(fx2, by + 44, 8, 40); }
    ctx.fillRect(0, by + 52, VIEW_W, 7);

    // Phases: 0-3 peaceful bouncing; 3-4.5 drones swoop; 4.5-6 flee; 6+ title.
    const flee = Math.min(1, Math.max(0, (t - 4.5) / 1.5));
    // One spot per CHARACTER — computed, so adding a hero can never
    // crash the intro again (ECHO's arrival broke the hardcoded trio).
    const trio = CHARACTERS.map((c, i) => [
      VIEW_W / 2 + (i - (CHARACTERS.length - 1) / 2) * 95,
      VIEW_H - 110 + (i % 2) * 10,
    ]);
    // Farm critters bounce, then run to the heroes.
    const spots = [[480, by + 20], [620, by + 60], [760, by - 10], [900, by + 40], [1060, by + 10], [360, by + 70], [990, by + 70], [540, by - 20]];
    const sps = ['frog', 'duck', 'goat', 'bunny', 'bee', 'turtle', 'bunny', 'duck'];
    spots.forEach(([sx, sy], i) => {
      const spr = g.mob.sprite(sps[i], 1);
      const panic = t > 3.4;
      const hop = Math.abs(Math.sin(t * (panic ? 14 : 5) + i * 1.7)) * (panic ? -12 : -7);
      const home = trio[i % trio.length];
      const x = sx + (home[0] + (i - 4) * 16 - sx) * flee;
      const y = sy + (home[1] - 24 - sy) * flee;
      ctx.save();
      ctx.translate(x, y + hop);
      ctx.scale(1.7, 1.7);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    });
    // The Tidy Empire swoops in from the sky.
    if (t > 3) {
      const drop = Math.min(1, (t - 3) / 1.2);
      for (let i = 0; i < 4; i++) {
        const dx = 260 + i * 240 + Math.sin(t * 3 + i) * 18;
        const dy = -60 + (150 + i * 28) * drop + Math.sin(t * 5 + i * 2) * 6;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = '#8a8a96';
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#e05c5c';
        ctx.beginPath(); ctx.arc(-6, -2, 3.5, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(6, -2, 3.5, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#b8bec8';
        const rot = t * 30 + i;
        ctx.beginPath(); ctx.moveTo(-16 * Math.cos(rot), -16 - 4 * Math.sin(rot)); ctx.lineTo(16 * Math.cos(rot), -16 + 4 * Math.sin(rot)); ctx.stroke();
        ctx.restore();
      }
      if (t < 4.4) {
        ctx.font = 'bold 26px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c53030';
        ctx.fillText('⚠ the Tidy Empire! ⚠', VIEW_W / 2, 150 + Math.sin(t * 10) * 4);
      }
    }
    // The heroes stand ready at the bottom.
    if (!this.introPipers) this.introPipers = CHARACTERS.map((c, i) => new Piper(i % 2, 0, 0, false, c));
    this.introPipers.forEach((p, i) => {
      p.x = p.px = trio[i][0]; p.y = p.py = trio[i][1];
      p.walk = t * 6;
      ctx.save();
      ctx.translate(0, 0);
      p.render(ctx, 1, { time: t });
      ctx.restore();
    });
    // Title slam.
    if (t > 6) {
      const k = Math.min(1, (t - 6) / 0.4);
      const scale = 2.2 - 1.2 * k;
      ctx.save();
      ctx.translate(VIEW_W / 2, 260);
      ctx.scale(scale, scale);
      ctx.globalAlpha = k;
      ctx.rotate(-0.02);
      ctx.font = 'bold 110px ' + FONT;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(30,45,20,0.9)'; ctx.lineWidth = 12;
      ctx.strokeText('MOB RULE', 0, 0);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('MOB RULE', 0, 0);
      ctx.restore();
      ctx.font = 'bold 24px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e86a96';
      ctx.fillText('✦ EXTENDED EDITION ✦', VIEW_W / 2, 316);
    }
    if (t > 6.6 && Math.sin(t * 4) > -0.3) {
      ctx.font = 'bold 26px ' + FONT;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(30,45,20,0.7)'; ctx.lineWidth = 5;
      ctx.strokeText('press any button!', VIEW_W / 2, VIEW_H - 40);
      ctx.fillStyle = '#fff';
      ctx.fillText('press any button!', VIEW_W / 2, VIEW_H - 40);
    }
  }

  renderSaves(ctx) {
    const g = this.g;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff');
    grd.addColorStop(0.6, '#c9ecff');
    grd.addColorStop(0.6, '#79b562');
    grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.font = `bold 56px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.85)'; ctx.lineWidth = 8;
    ctx.strokeText('PICK A SAVE FILE', VIEW_W / 2, 110);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PICK A SAVE FILE', VIEW_W / 2, 110);

    const cw = 320, chh = 340, gap = 40;
    const x0 = VIEW_W / 2 - (cw * 3 + gap * 2) / 2;
    for (let i = 0; i < 3; i++) {
      const s = g.loadSlot(i);
      const x = x0 + i * (cw + gap), y = 170;
      const sel = this.saveIdx === i;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)';
      rr(ctx, x, y, cw, chh, 18); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 6; rr(ctx, x, y, cw, chh, 18); ctx.stroke(); }
      ctx.fillStyle = '#3a5a2e';
      ctx.font = `bold 30px ${FONT}`;
      ctx.fillText(`SAVE ${i + 1}`, x + cw / 2, y + 52);
      if (s) {
        ctx.font = `bold 19px ${FONT}`;
        ctx.fillStyle = '#4a4a3a';
        ctx.fillText(`🌰 ${s.acorns} acorns`, x + cw / 2, y + 110);
        ctx.fillText(`best wave: ${s.bestWave || 0} / 12`, x + cw / 2, y + 142);
        ctx.fillText(`biggest mob: ${s.biggestMob || 0}`, x + cw / 2, y + 174);
        ctx.fillText(`wins: ${s.wins || 0}`, x + cw / 2, y + 206);
        // PLAY / DELETE buttons.
        const by = y + 245;
        for (let b = 0; b < 2; b++) {
          const on = sel && this.saveBtn === b;
          ctx.fillStyle = b === 0 ? (on ? '#7ec850' : '#a8cc90') : (on ? '#e05c5c' : '#d8a8a0');
          rr(ctx, x + 40, by + b * 44, cw - 80, 36, 9); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `bold 19px ${FONT}`;
          ctx.fillText(b === 0 ? '▶ PLAY' : '🗑 DELETE', x + cw / 2, by + b * 44 + 25);
        }
      } else {
        ctx.font = `bold 22px ${FONT}`;
        ctx.fillStyle = '#7a9a6a';
        ctx.fillText('empty', x + cw / 2, y + 140);
        ctx.font = `17px ${FONT}`;
        ctx.fillText('a fresh start!', x + cw / 2, y + 172);
        const on = sel;
        ctx.fillStyle = on ? '#7ec850' : '#a8cc90';
        rr(ctx, x + 40, y + 245, cw - 80, 36, 9); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 19px ${FONT}`;
        ctx.fillText('▶ NEW GAME', x + cw / 2, y + 270);
      }
    }
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('◀ ▶ pick a file · ▲ ▼ play or delete · confirm with your button', VIEW_W / 2, 560);

    // Double-confirm delete dialogs.
    if (this.saveMode !== 'pick') {
      ctx.fillStyle = 'rgba(20,15,10,0.75)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const second = this.saveMode === 'confirm2';
      ctx.fillStyle = '#fff8ec';
      rr(ctx, VIEW_W / 2 - 320, 240, 640, 240, 20); ctx.fill();
      ctx.strokeStyle = second ? '#e05c5c' : '#e8a33a'; ctx.lineWidth = 6;
      rr(ctx, VIEW_W / 2 - 320, 240, 640, 240, 20); ctx.stroke();
      ctx.fillStyle = second ? '#c53030' : '#8a5a1a';
      ctx.font = `bold 30px ${FONT}`;
      ctx.fillText(second ? '⚠ It will be gone FOREVER!' : `Delete save ${this.saveIdx + 1}?`, VIEW_W / 2, 300);
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = '#5a4a3a';
      ctx.fillText(second ? 'Really delete?' : 'All its acorns and critters will disappear.', VIEW_W / 2, 344);
      for (let b = 0; b < 2; b++) {
        const yes = b === 1;
        const on = this.confirmYes === yes;
        ctx.fillStyle = yes ? (on ? '#e05c5c' : '#d8b0a8') : (on ? '#7ec850' : '#b0cc9c');
        rr(ctx, VIEW_W / 2 - 250 + b * 260, 385, 240, 60, 12); ctx.fill();
        if (on) { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; rr(ctx, VIEW_W / 2 - 250 + b * 260, 385, 240, 60, 12); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        ctx.font = `bold 24px ${FONT}`;
        ctx.fillText(yes ? 'YES, delete' : 'NO! Keep it', VIEW_W / 2 - 130 + b * 260, 424);
      }
    }
  }

  renderShop(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(25,40,18,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px ' + FONT;
    ctx.strokeStyle = 'rgba(30,45,20,0.8)'; ctx.lineWidth = 6;
    ctx.strokeText('🛒 CROSSROADS MARKET', VIEW_W / 2, 100);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('🛒 CROSSROADS MARKET', VIEW_W / 2, 100);
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillStyle = '#fff';
    ctx.fillText('🌰 ' + g.wallet + ' acorns to spend', VIEW_W / 2, 145);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#c8e0b8';
    ctx.fillText('unspent acorns go to your BANK for the family fortune', VIEW_W / 2, 172);

    const n = this.shopOffers.length + 1;
    const cw = 190, chh = 250, gap = 22;
    const x0 = VIEW_W / 2 - (cw * n + gap * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (cw + gap), y = 210;
      const sel = this.shopIdx === i;
      const done = i >= this.shopOffers.length;
      const o = done ? null : this.shopOffers[i];
      const afford = o && !o.sold && g.wallet >= o.price;
      ctx.globalAlpha = o && o.sold ? 0.4 : 1;
      ctx.fillStyle = done ? (sel ? '#7ec850' : '#a8cc90') : sel ? '#fff8ec' : 'rgba(255,255,255,0.72)';
      rr(ctx, x, y, cw, chh, 14); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; rr(ctx, x, y, cw, chh, 14); ctx.stroke(); }
      if (done) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px ' + FONT;
        ctx.fillText('DONE!', x + cw / 2, y + 120);
        ctx.font = 'bold 15px ' + FONT;
        ctx.fillText('next wave ▶', x + cw / 2, y + 150);
      } else if (o.fortune) {
        ctx.font = '46px sans-serif';
        ctx.fillText('🔮', x + cw / 2, y + 84);
        ctx.font = 'bold 17px ' + FONT;
        ctx.fillStyle = '#5a3a7a';
        ctx.fillText('FORTUNE', x + cw / 2, y + 124);
        ctx.font = '13px ' + FONT;
        ctx.fillText('a mystery...', x + cw / 2, y + 148);
        ctx.fillText('(could be ANYTHING)', x + cw / 2, y + 166);
        ctx.font = 'bold 20px ' + FONT;
        ctx.fillStyle = o.sold ? '#8a8a7a' : afford ? '#e8a000' : '#c05a5a';
        ctx.fillText(o.sold ? 'SOLD!' : '🌰 ' + o.price, x + cw / 2, y + 214);
      } else if (o.train) {
        ctx.font = '46px sans-serif';
        ctx.fillText('💪', x + cw / 2, y + 84);
        ctx.font = 'bold 17px ' + FONT;
        ctx.fillStyle = '#3a5a2e';
        ctx.fillText('MOB TRAINING', x + cw / 2, y + 124);
        ctx.font = '13px ' + FONT;
        ctx.fillText('+8% damage & HP', x + cw / 2, y + 148);
        ctx.fillText('(this run)', x + cw / 2, y + 166);
        ctx.font = 'bold 20px ' + FONT;
        ctx.fillStyle = afford ? '#e8a000' : '#b0a090';
        ctx.fillText('🌰 ' + o.price, x + cw / 2, y + 214);
      } else {
        const spr = g.mob.sprite(o.sp, 1);
        ctx.drawImage(spr, x + cw / 2 - 34, y + 26, 68, 68);
        ctx.font = 'bold 17px ' + FONT;
        ctx.fillStyle = '#3a5a2e';
        ctx.fillText(SPECIES[o.sp].name, x + cw / 2, y + 130);
        ctx.font = '13px ' + FONT;
        ctx.fillText('job: ' + SPECIES[o.sp].role, x + cw / 2, y + 154);
        ctx.font = 'bold 20px ' + FONT;
        ctx.fillStyle = o.sold ? '#8a8a7a' : afford ? '#e8a000' : '#c05a5a';
        ctx.fillText(o.sold ? 'SOLD!' : '🌰 ' + o.price, x + cw / 2, y + 214);
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('◀ ▶ browse · confirm to buy · DONE starts the next wave', VIEW_W / 2, 530);
  }

  renderLoadout(ctx) {
    const g = this.g;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff'); grd.addColorStop(0.6, '#c9ecff');
    grd.addColorStop(0.6, '#79b562'); grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const roster = g.unlockedList();
    const lo = g.save.loadouts[this.loSlot] || [];
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px ' + FONT;
    ctx.strokeStyle = 'rgba(30,45,20,0.85)'; ctx.lineWidth = 7;
    const ttl = 'P' + (this.loSlot + 1) + ': PICK YOUR PARADE';
    ctx.strokeText(ttl, VIEW_W / 2, 100);
    ctx.fillStyle = this.loSlot === 0 ? '#ffb3b3' : '#b3d1ff';
    ctx.fillText(ttl, VIEW_W / 2, 100);
    // Arena banner (cell 0): confirm cycles through unlocked arenas.
    const arn = ARENAS[Math.min(g.save.arena || 0, ARENAS.length - 1)];
    const arSel = this.loIdx === 0;
    ctx.fillStyle = arSel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)';
    rr(ctx, VIEW_W / 2 - 330, 116, 660, 46, 12); ctx.fill();
    if (arSel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4; rr(ctx, VIEW_W / 2 - 330, 116, 660, 46, 12); ctx.stroke(); }
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#3a5a2e';
    ctx.fillText(arn.emoji + ' ' + arn.name + '  (' + ((g.save.arenasUnlocked || 0) + 1) + '/' + ARENAS.length + ' unlocked' + (arSel ? ' — press to change' : '') + ')', VIEW_W / 2, 146);
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = '#5a6a4a';
    ctx.fillText(arn.blurb + '  ·  pick up to 3 favorite critters below', VIEW_W / 2, 180);
    const per = 6, cs = 138, gap = 20;
    roster.forEach((sp, i) => {
      const row = Math.floor(i / per), col = i % per;
      const rowLen = Math.min(per, roster.length - row * per);
      const x = VIEW_W / 2 - (rowLen * (cs + gap) - gap) / 2 + col * (cs + gap);
      const y = 196 + row * (cs + gap);
      const sel = this.loIdx === i + 1;
      const picked = lo.indexOf(sp);
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      rr(ctx, x, y, cs, cs, 14); ctx.fill();
      if (picked >= 0) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 6; rr(ctx, x, y, cs, cs, 14); ctx.stroke(); }
      if (sel) { ctx.strokeStyle = this.loSlot === 0 ? '#e05c5c' : '#5aa9ff'; ctx.lineWidth = 4; rr(ctx, x - 4, y - 4, cs + 8, cs + 8, 16); ctx.stroke(); }
      const spr = g.mob.sprite(sp, 1);
      ctx.drawImage(spr, x + cs / 2 - 34, y + 14, 68, 68);
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillStyle = '#3a5a2e';
      ctx.fillText(SPECIES[sp].name, x + cs / 2, y + cs - 26);
      if (picked >= 0) {
        ctx.font = 'bold 20px ' + FONT;
        ctx.fillStyle = '#e8a000';
        ctx.fillText('★ ' + (picked + 1), x + cs / 2, y + cs - 6);
      }
    });
    // Spice jar row.
    const rows = Math.ceil(roster.length / per);
    const sy = 196 + rows * (cs + gap) + 4;
    const spw = 240;
    SPICES.forEach((sp2, i) => {
      const x = VIEW_W / 2 - (SPICES.length * (spw + 16) - 16) / 2 + i * (spw + 16);
      const on = g.save.spices[i];
      const sel = this.loIdx === 1 + roster.length + i;
      ctx.fillStyle = on ? 'rgba(224,92,92,0.85)' : 'rgba(255,255,255,0.6)';
      rr(ctx, x, sy, spw, 44, 10); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4; rr(ctx, x, sy, spw, 44, 10); ctx.stroke(); }
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillStyle = on ? '#fff' : '#5a5a4a';
      ctx.fillText(sp2.emoji + ' ' + sp2.name + (on ? ' ON' : ''), x + spw / 2, sy + 19);
      ctx.font = '11px ' + FONT;
      ctx.fillText(sp2.desc + ' · +25% acorns', x + spw / 2, sy + 36);
    });
    // GO button.
    const gy = sy + 56;
    const goSel = this.loIdx >= 1 + roster.length + SPICES.length;
    ctx.fillStyle = goSel ? '#7ec850' : '#a8cc90';
    rr(ctx, VIEW_W / 2 - 160, gy, 320, 56, 14); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('🐸 MARCH!', VIEW_W / 2, gy + 38);
  }

  renderLabConfig(ctx) {
    const g = this.g;
    const lab = g.lab;
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillStyle = '#8fd0ff';
    ctx.fillText('🧪 TESTING LAB', VIEW_W / 2, 110);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('the fun & balance audit bench — lab runs never bank or unlock anything', VIEW_W / 2, 148);
    const rows = [
      'Arena: ◀ ' + ARENAS[lab.arena].emoji + ' ' + ARENAS[lab.arena].name + ' ▶',
      'Character: ◀ ' + CHARACTERS[lab.char].emoji + ' ' + CHARACTERS[lab.char].name + ' ▶',
      'Difficulty: ◀ ' + DIFFICULTIES[lab.diff].name + ' ▶',
      'Wave scaling: ◀ ' + lab.wave + ' ▶',
      '▶ ENTER THE LAB',
    ];
    rows.forEach((s, i) => {
      ctx.font = 'bold ' + (i === 4 ? 30 : 24) + 'px ' + FONT;
      ctx.fillStyle = this.labRow === i ? '#8fd0ff' : 'rgba(255,255,255,0.75)';
      ctx.fillText((this.labRow === i ? '🧪 ' : '') + s, VIEW_W / 2, 230 + i * 62);
    });
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = '#ffd166';
    ctx.fillText('IN THE LAB:  [ ]  pick critter · 1/2/3 spawn tier · , . pick enemy · E spawn · R elite', VIEW_W / 2, 600);
    ctx.fillText('X clear foes · V real waves on/off · +/− wave scaling · I invulnerable · H heal all · G +100 acorns · Esc quit', VIEW_W / 2, 626);
  }

  renderQuests(ctx) {
    const g = this.g;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff'); grd.addColorStop(0.6, '#c9ecff');
    grd.addColorStop(0.6, '#79b562'); grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px ' + FONT;
    ctx.strokeStyle = 'rgba(30,45,20,0.85)'; ctx.lineWidth = 7;
    ctx.strokeText('⭐ QUESTS', VIEW_W / 2, 90);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('⭐ QUESTS', VIEW_W / 2, 90);
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillStyle = '#3a5a2e';
    ctx.fillText('finish a quest, earn the bounty — paid automatically at run end', VIEW_W / 2, 126);
    CHALLENGES.forEach((q, i) => {
      const y = 160 + i * 58;
      const done = !!g.save.quests[q.id];
      ctx.fillStyle = done ? 'rgba(126,200,80,0.35)' : 'rgba(255,255,255,0.7)';
      rr(ctx, VIEW_W / 2 - 380, y, 760, 48, 12); ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = 'bold 19px ' + FONT;
      ctx.fillStyle = done ? '#2e5a1e' : '#3a5a2e';
      ctx.fillText((done ? '✅ ' : '⬜ ') + q.name, VIEW_W / 2 - 360, y + 30);
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = '#5a6a4a';
      ctx.fillText(q.desc, VIEW_W / 2 - 140, y + 30);
      ctx.textAlign = 'right';
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillStyle = done ? '#5a8a4a' : '#e8a000';
      ctx.fillText(done ? 'PAID' : '+' + q.bounty + '🌰', VIEW_W / 2 + 360, y + 30);
      ctx.textAlign = 'center';
    });
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('press your button to go back', VIEW_W / 2, VIEW_H - 30);
  }

  renderTrain(ctx) {
    const g = this.g;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff'); grd.addColorStop(0.6, '#c9ecff');
    grd.addColorStop(0.6, '#79b562'); grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px ' + FONT;
    ctx.strokeStyle = 'rgba(30,45,20,0.85)'; ctx.lineWidth = 7;
    ctx.strokeText('🏋️ TRAINING CAMP', VIEW_W / 2, 88);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('🏋️ TRAINING CAMP', VIEW_W / 2, 88);
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = '#fff';
    ctx.fillText('🌰 bank: ' + g.save.acorns + ' — each level = +8% HP & damage, FOREVER', VIEW_W / 2, 126);
    // Tabs.
    for (let tb = 0; tb < 2; tb++) {
      const tx = VIEW_W / 2 + (tb === 0 ? -230 : 30);
      const on = this.trainTab === tb;
      ctx.fillStyle = on ? '#ffd166' : 'rgba(255,255,255,0.5)';
      rr(ctx, tx, 142, 200, 40, 12); ctx.fill();
      ctx.fillStyle = on ? '#5a3a1a' : '#4a5a3e';
      ctx.font = 'bold 19px ' + FONT;
      ctx.fillText(tb === 0 ? '🎩 HERO' : '🐾 CRITTERS', tx + 100, 169);
    }
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('▲ ▼ switch tabs · ◀ ▶ browse · confirm to buy', VIEW_W / 2, 202);

    if (this.trainTab === 0) {
      // HERO tab: all piper upgrades in a grid.
      const per2 = 5, pw = 226, ph = 100, pgap = 14;
      PIPER_UPGRADES.forEach((up, i) => {
        const row = Math.floor(i / per2), col = i % per2;
        const rowLen = Math.min(per2, PIPER_UPGRADES.length - row * per2);
        const x = VIEW_W / 2 - (rowLen * (pw + pgap) - pgap) / 2 + col * (pw + pgap);
        const y = 222 + row * (ph + pgap);
        const sel = this.trainIdx === i;
        const lv = g.pupLevel(up.id);
        const cost = g.pupCost(up.id);
        ctx.fillStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
        rr(ctx, x, y, pw, ph, 12); ctx.fill();
        if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; rr(ctx, x, y, pw, ph, 12); ctx.stroke(); }
        ctx.font = 'bold 15px ' + FONT;
        ctx.fillStyle = '#3a5a2e';
        ctx.fillText(up.emoji + ' ' + up.name, x + pw / 2, y + 24);
        ctx.font = '11px ' + FONT;
        ctx.fillStyle = '#5a6a4a';
        ctx.fillText(up.desc, x + pw / 2, y + 43);
        ctx.font = 'bold 13px ' + FONT;
        ctx.fillStyle = '#e8a000';
        ctx.fillText('●'.repeat(lv) + '○'.repeat(up.max - lv), x + pw / 2, y + 62);
        ctx.font = 'bold 13px ' + FONT;
        if (cost == null) { ctx.fillStyle = '#7ec850'; ctx.fillText('MAXED!', x + pw / 2, y + 84); }
        else { ctx.fillStyle = g.save.acorns >= cost ? '#8a5a1a' : '#c05a5a'; ctx.fillText('buy: ' + cost + '🌰', x + pw / 2, y + 84); }
      });
      const rows2 = Math.ceil(PIPER_UPGRADES.length / per2);
      const gy2 = 222 + rows2 * (ph + pgap) + 6;
      const backSel2 = this.trainIdx >= PIPER_UPGRADES.length;
      ctx.fillStyle = backSel2 ? '#7ec850' : '#a8cc90';
      rr(ctx, VIEW_W / 2 - 140, gy2, 280, 46, 12); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText('⬅ BACK', VIEW_W / 2, gy2 + 31);
      return;
    }

    const per = 6, cs = 138, gap = 14;
    SPECIES_IDS.forEach((sp, i) => {
      const row = Math.floor(i / per), col = i % per;
      const x = VIEW_W / 2 - (per * (cs + gap) - gap) / 2 + col * (cs + gap);
      const y = 252 + row * (cs + gap + 10);
      const sel = this.trainIdx === i; // tab-local index (the nPup era is over)
      const owned = g.unlocked(sp);
      const lv = g.levelOf(sp);
      const cost = g.trainCost(sp);
      ctx.globalAlpha = owned ? 1 : 0.35;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      rr(ctx, x, y, cs, cs + 12, 12); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; rr(ctx, x, y, cs, cs + 12, 12); ctx.stroke(); }
      if (owned) {
        const spr = g.mob.sprite(sp, 1);
        ctx.drawImage(spr, x + cs / 2 - 26, y + 8, 52, 52);
        ctx.font = 'bold 13px ' + FONT;
        ctx.fillStyle = '#3a5a2e';
        ctx.fillText(SPECIES[sp].name, x + cs / 2, y + 76);
        // 10-level bar.
        ctx.fillStyle = 'rgba(60,80,45,0.25)';
        rr(ctx, x + 16, y + 88, cs - 32, 9, 4); ctx.fill();
        if (lv > 0) { ctx.fillStyle = '#e8a000'; rr(ctx, x + 16, y + 88, (cs - 32) * lv / TRAIN_COSTS.length, 9, 4); ctx.fill(); }
        ctx.font = 'bold 12px ' + FONT;
        ctx.fillStyle = '#8a5a1a';
        ctx.fillText('Lv ' + lv + '/' + TRAIN_COSTS.length, x + cs / 2, y + 112);
        ctx.font = 'bold 13px ' + FONT;
        if (cost == null) { ctx.fillStyle = '#7ec850'; ctx.fillText('MAXED!', x + cs / 2, y + 132); }
        else { ctx.fillStyle = g.save.acorns >= cost ? '#8a5a1a' : '#c05a5a'; ctx.fillText('train: ' + cost + '🌰', x + cs / 2, y + 132); }
      } else {
        ctx.font = 'bold 36px ' + FONT;
        ctx.fillStyle = '#5a6a4a';
        ctx.fillText('?', x + cs / 2, y + 60);
        ctx.font = '11px ' + FONT;
        ctx.fillText('not in roster yet', x + cs / 2, y + 96);
      }
      ctx.globalAlpha = 1;
    });
    const rows = Math.ceil(SPECIES_IDS.length / per);
    const gy = 252 + rows * (cs + gap + 10) + 2;
    const backSel = this.trainIdx >= SPECIES_IDS.length;
    ctx.fillStyle = backSel ? '#7ec850' : '#a8cc90';
    rr(ctx, VIEW_W / 2 - 140, gy, 280, 48, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('⬅ BACK', VIEW_W / 2, gy + 32);
  }

  renderDraft(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(35,50,25,0.92)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px ' + FONT;
    ctx.strokeStyle = 'rgba(20,30,12,0.85)'; ctx.lineWidth = 7;
    ctx.strokeText('🎁 A NEW FRIEND JOINS!', VIEW_W / 2, 120);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('🎁 A NEW FRIEND JOINS!', VIEW_W / 2, 120);
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#c8e0b8';
    ctx.fillText('pick ONE to add to your roster forever', VIEW_W / 2, 158);
    const cw = 280, chh = 330, gap = 46;
    const x0 = VIEW_W / 2 - (cw * g.draftOffers.length + gap * (g.draftOffers.length - 1)) / 2;
    g.draftOffers.forEach((sp, i) => {
      const x = x0 + i * (cw + gap), y = 200;
      const sel = this.draftIdx === i;
      ctx.fillStyle = sel ? '#fff8ec' : 'rgba(255,255,255,0.75)';
      rr(ctx, x, y, cw, chh, 16); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 6; rr(ctx, x, y, cw, chh, 16); ctx.stroke(); }
      const spr = g.mob.sprite(sp, 1);
      const wob = sel ? Math.sin(this.t * 6) * 4 : 0;
      ctx.drawImage(spr, x + cw / 2 - 50, y + 34 + wob, 100, 100);
      ctx.font = 'bold 26px ' + FONT;
      ctx.fillStyle = '#3a5a2e';
      ctx.fillText(SPECIES[sp].name, x + cw / 2, y + 180);
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillStyle = '#8a6b45';
      ctx.fillText('grows into: ' + SPECIES[sp].tierNames[2], x + cw / 2, y + 212);
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = '#5a6a4a';
      ctx.fillText('job: ' + SPECIES[sp].role, x + cw / 2, y + 240);
    });
    ctx.font = 'bold 17px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('◀ ▶ choose · confirm with your button', VIEW_W / 2, 590);
  }

  renderTitle(ctx) {
    const g = this.g;
    // Meadow sky.
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff');
    grd.addColorStop(0.55, '#c9ecff');
    grd.addColorStop(0.55, '#79b562');
    grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parade of critters along the bottom.
    this.titleParade.forEach((p, i) => {
      const spr = g.mob.sprite(p.sp, 1 + (i % 3 === 0 ? 1 : 0));
      const hop = Math.abs(Math.sin(this.t * 6 + i)) * -6;
      ctx.save();
      ctx.translate(p.x, VIEW_H - 80 + hop);
      ctx.scale(2, 2);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    });

    ctx.save();
    ctx.translate(VIEW_W / 2, 170);
    ctx.rotate(-0.02);
    ctx.font = `bold 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.85)';
    ctx.lineWidth = 10;
    ctx.strokeText('MOB RULE', 0, 0);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('MOB RULE', 0, 0);
    ctx.restore();
    ctx.font = `italic bold 22px ${FONT}`;
    ctx.fillStyle = '#3a5a2e';
    ctx.textAlign = 'center';
    ctx.fillText('lead the critters. flood the lawn. unplug the Tidy Empire.', VIEW_W / 2, 215);
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = '#e86a96';
    ctx.fillText('✦ EXTENDED EDITION ✦', VIEW_W / 2, 242);

    const c0 = CHARACTERS[g.save.chars[0] || 0], c1 = CHARACTERS[g.save.chars[1] || 0];
    const df = DIFFICULTIES[g.save.diff || 0];
    const items = [
      'MARCH!  (start run)',
      `P1 plays: ◀ ${c0.emoji} ${c0.name} ▶`,
      `P2 plays: ◀ ${c1.emoji} ${c1.name} ▶`,
      `Difficulty: ◀ ${df.emoji} ${df.name} ▶ (${(g.save.diffUnlocked || 0) + 1}/5 unlocked)`,
      g.save.endlessUnlocked
        ? `Mode: ◀ ${g.save.mode ? '♾ KEEP MARCHING (best: wave ' + (g.save.bestEndless || 12) + ')' : '🏁 STORY (12 waves)'} ▶`
        : 'Mode: 🏁 STORY — beat wave 12 to unlock ♾ KEEP MARCHING',
      `P1 Little Piper mode: ${g.save.little[0] ? 'ON ★' : 'off'}`,
      `P2 Little Piper mode: ${g.save.little[1] ? 'ON ★' : 'off'}`,
      `🏋️ TRAINING CAMP  (bank: ${g.save.acorns}🌰)`,
      `⭐ QUESTS`,
      '🧪 TESTING LAB',
      `Sound: ${g.audio.muted ? 'OFF' : 'ON'}`,
      `SAVE FILES  (playing save ${(g.slotIdx || 0) + 1})`,
    ];
    items.forEach((s, i) => {
      ctx.font = `bold ${i === 0 ? 28 : 18}px ${FONT}`;
      ctx.fillStyle = this.menuIdx === i ? '#fff' : 'rgba(255,255,255,0.72)';
      const y = 258 + i * 32 + (i > 0 ? 6 : 0);
      if (this.menuIdx === i) {
        ctx.strokeStyle = 'rgba(30,45,20,0.6)'; ctx.lineWidth = 5;
        ctx.strokeText((i === 0 ? '🐸 ' : '') + s, VIEW_W / 2, y);
      }
      ctx.fillText((this.menuIdx === i && i !== 0 ? '▶ ' : i === 0 && this.menuIdx === 0 ? '🐸 ' : '') + s, VIEW_W / 2, y);
    });
    // One-line blurb for the highlighted character / difficulty.
    if (this.menuIdx === 1 || this.menuIdx === 2 || this.menuIdx === 3) {
      const blurb = this.menuIdx === 3 ? df.blurb : (this.menuIdx === 1 ? c0 : c1).desc;
      ctx.font = `italic 15px ${FONT}`;
      ctx.fillStyle = '#fff8d0';
      ctx.fillText(blurb, VIEW_W / 2, 258 + 11 * 32 + 12);
    }

    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const d0 = g.input.deviceFor(0), d1 = g.input.deviceFor(1);
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = d1 ? '#8fd0ff' : '#d8ecc8';
    ctx.fillText(d1 ? '👥 PLAYERS: 2 (co-op)' : '👤 PLAYERS: 1 (solo)', VIEW_W / 2, 596 - 84);
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(d0 ? `P1: ${d0.label}` : 'P1: press a button to claim a device', VIEW_W / 2, 596 - 62);
    ctx.fillText(d1
      ? `P2: ${d1.label} — press its BACK button (${d1.glyphs ? d1.glyphs.back || 'B' : 'B'}) to leave`
      : 'P2 join: press Enter (arrow keys) or A (second controller). Careful: Enter joins P2!', VIEW_W / 2, 596 - 42);

    // Unlock strip.
    let ux = VIEW_W / 2 - (SPECIES_IDS.length * 34) / 2;
    for (const sp of SPECIES_IDS) {
      const un = g.unlocked(sp);
      ctx.globalAlpha = un ? 1 : 0.3;
      const spr = g.mob.sprite(sp, 1);
      ctx.drawImage(spr, ux, 580, 30, 30);
      if (!un) {
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('?', ux + 15, 624);
      }
      ctx.globalAlpha = 1;
      ux += 34;
    }
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`lifetime acorns: ${g.save.acorns} · best wave: ${g.save.bestWave} · biggest mob ever: ${g.save.biggestMob}`, VIEW_W / 2, 650);
    ctx.fillText('tip: ' + this.tip, VIEW_W / 2, 672);
    ctx.fillStyle = g.save.classicArt ? 'rgba(255,255,255,0.55)' : '#ff8fb3';
    ctx.fillText('press B — art: ' + (g.save.classicArt ? 'CLASSIC (retro)' : 'kawaii 🐸✨'), VIEW_W / 2, 692);
  }

  renderEnd(ctx, won) {
    const g = this.g;
    ctx.fillStyle = won ? 'rgba(40,60,25,0.82)' : 'rgba(35,30,25,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(20,30,12,0.85)'; ctx.lineWidth = 7;
    const wiped = g.endCause === 'mobwipe';
    const title = won ? '🌿 NATURE WINS 🌿' : wiped ? 'THE MOB WAS SWEPT AWAY!' : 'THE PIPER GOT BONKED!';
    ctx.strokeText(title, VIEW_W / 2, 150);
    ctx.fillStyle = won ? '#ffd166' : '#ff8a8a';
    ctx.fillText(title, VIEW_W / 2, 150);
    if (!won) {
      // Say exactly WHY the run ended and what to do about it.
      ctx.font = `bold 19px ${FONT}`;
      ctx.fillStyle = '#fff';
      this.wrap(ctx, wiped
        ? 'Every last critter was lost — a piper without a mob is just a kid with a flute.'
        : 'Your HP hit zero — the mob only marches for a standing piper.', VIEW_W / 2, 190, 700, 24);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = '#c8e0b8';
      this.wrap(ctx, wiped
        ? 'Next run: watch the MOB bar under the counter. Hurt hunters retreat on their own — let them heal in the shield before sending them back out. And crack every cage!'
        : `Next run: keep more critters on SHIELD duty (${g.input.glyph(0, 'recall')} recalls hunters), grab snack drops to heal, and stand still a moment to regenerate.`, VIEW_W / 2, 220, 720, 21);
    }
    ctx.font = `italic 17px ${FONT}`;
    ctx.fillStyle = '#e8e0d0';
    this.wrap(ctx, this.endLine, VIEW_W / 2, won ? 200 : 268, 640, 22);

    ctx.font = `bold 19px ${FONT}`;
    ctx.fillStyle = '#fff';
    const s = g.runStats;
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    ctx.fillText(`wave ${g.waveNum}/12 · ${s.bots} bots scrapped · biggest mob: ${g.mob.biggest} · 🌰 ${s.acorns} · ${mins}:${String(secs).padStart(2, '0')}`, VIEW_W / 2, won ? 252 : 322);

    if (g.questsDone && g.questsDone.length) {
      ctx.font = 'bold 19px ' + FONT;
      ctx.fillStyle = '#ffd166';
      ctx.fillText('⭐ QUEST' + (g.questsDone.length > 1 ? 'S' : '') + ' COMPLETE: '
        + g.questsDone.map(q => q.name + ' (+' + q.bounty + '🌰)').join('  ·  '), VIEW_W / 2, VIEW_H - 210);
    }
    if (g.nextGoal) {
      const gy = VIEW_H - 170;
      ctx.fillStyle = g.nextGoal.ready ? 'rgba(126,200,80,0.25)' : 'rgba(255,209,102,0.18)';
      rr(ctx, VIEW_W / 2 - 340, gy - 26, 680, 44, 12); ctx.fill();
      ctx.strokeStyle = g.nextGoal.ready ? '#7ec850' : '#ffd166'; ctx.lineWidth = 3;
      rr(ctx, VIEW_W / 2 - 340, gy - 26, 680, 44, 12); ctx.stroke();
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillStyle = g.nextGoal.ready ? '#b8f0a0' : '#ffe9a0';
      ctx.fillText((g.nextGoal.ready ? '✨ ' : '🎯 ') + g.nextGoal.text, VIEW_W / 2, gy + 3);
    }
    if (g.arenaJustUnlocked) {
      ctx.font = 'bold 21px ' + FONT;
      ctx.fillStyle = '#5adfff';
      ctx.fillText('🗺️ NEW ARENA UNLOCKED: ' + g.arenaJustUnlocked + '!', VIEW_W / 2, won ? 234 : 300);
    }
    if (g.diffJustUnlocked) {
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillStyle = '#c05aff';
      ctx.fillText('🔓 NEW DIFFICULTY UNLOCKED: ' + g.diffJustUnlocked + '!', VIEW_W / 2, won ? 262 : 328);
    }
    if (g.draftBonus) {
      ctx.font = 'bold 20px ' + FONT;
      ctx.fillStyle = '#ffd166';
      ctx.fillText('🌰 Full roster! Bonus: +' + g.draftBonus + ' acorns banked!', VIEW_W / 2, won ? 294 : 360);
    } else if (g.draftOffers && g.draftOffers.length) {
      ctx.font = 'bold 20px ' + FONT;
      ctx.fillStyle = '#ffd166';
      ctx.fillText('🎁 A NEW FRIEND awaits — press your button to meet them!', VIEW_W / 2, won ? 294 : 360);
    }
    if (false && g.newUnlocks && g.newUnlocks.length) {
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = '#7ec850';
      ctx.fillText(`🎉 NEW SPECIES UNLOCKED: ${g.newUnlocks.map(sp => SPECIES[sp].name).join(', ')}!`, VIEW_W / 2, won ? 294 : 360);
    }

    // The mob takes a bow (or wanders off).
    const rows = {};
    for (const c of g.mob.list) { rows[c.sp + c.tier] = rows[c.sp + c.tier] || { sp: c.sp, tier: c.tier, n: 0 }; rows[c.sp + c.tier].n++; }
    const list = Object.values(rows).sort((a, b) => b.tier - a.tier).slice(0, 10);
    let x = VIEW_W / 2 - list.length * 42;
    for (const r of list) {
      const spr = g.mob.sprite(r.sp, r.tier);
      const hop = won ? Math.abs(Math.sin(this.t * 6 + x)) * -8 : 0;
      ctx.save();
      ctx.translate(x + 40, 420 + hop);
      ctx.scale(1.8, 1.8);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`×${r.n}`, x + 40, 465);
      x += 84;
    }

    if (Math.sin(this.t * 4) > -0.3) {
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText('press confirm — the meadow always needs a piper', VIEW_W / 2, VIEW_H - 80);
    }
  }

  wrap(ctx, str, cx, y, maxW, lh) {
    const words = String(str).split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, cx, yy);
  }
}
