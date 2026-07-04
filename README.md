# 🐸 MOB RULE: EXTENDED EDITION

**The complete Mob Rule — roguelite economy AND long-game progression.**

Everything from the Upgraded Edition, plus:

- **🏋️ TRAINING CAMP** — spend your **banked** acorns on permanent power:
  - **Species levels**: every animal trains to **level 10** (+8% HP &
    damage per level — +80% at max). The camp doubles as a sticker-book
    of your roster; every critter says hello in its own voice.
  - **❤️ TOUGH PIPER** — +15 starting HP per level (5 levels)
  - **👟 SPEEDY BOOTS** — +5% walk speed per level (5 levels)
  - **🐾 BIGGER PARADE** — +1 starting critter per level (5 levels)
  - **🔄 SECOND CHANCE** — when your HP hits zero *or* your whole mob
    falls, you rise again with full health and a fresh mob of 10 (plus a
    shockwave that scraps every robot around you). Expensive: 300, then
    500, then 1000 acorns. Hold up to three.
- **🐰 Bunnies from day one** — bunnies start in every roster, so a
  bunny-lover can put them in the loadout on the very first run.
- **🎬 Animated intro** — the peaceful farm, the swooping Tidy Empire,
  the critters running to their heroes… then MOB RULE slams in.
- **🔓 Five difficulties** — beat wave 12 to unlock the next: 🌼 GARDEN
  PARTY → 🧹 SPRING CLEANING → 💦 POWER WASH → 🧽 DEEP CLEAN → 🌪️ MAXIMUM
  TIDY. Harder runs pay **more acorns**, feeding the training camp.

And from the Upgraded Edition:

- **🎁 End-of-run draft** — win or lose, pick 1 of 3 new species to join
  your roster forever. YOU choose how your collection grows.
- **📦 Pick your loadout** — before each run, choose up to 3 favorite
  species. Your starting mob comes from them, and cages/packs lean their
  way all run (~3× the odds). Frog army? Moose parade? Your call.
- **🛒 Crossroads market** — acorns you collect are now a spendable
  **wallet**: between waves, buy extra critters (cheap frogs → pricey
  moose) or repeatable MOB TRAINING (+8% power). Whatever you don't spend
  **banks to your save file** at the end of the run.

*(This edition uses its own save files — your original MOB RULE saves stay
untouched.)*

You are a tiny piper. You don't fight. You *walk*, and every critter you free
follows the exact path you walked — a living, hopping, ribbiting parade that
attacks anything tidy-looking all by itself. Start with two frogs, two ducks,
and a goat. End with a hundred-strong stampede with a FROG KING at the front.

The enemy: robot vacuums, mower drones, and clipboard-wielding mechs who
believe animals are clutter. Prove them extremely wrong.

## ▶️ Play it right now

**No install needed:** 👉 **<https://redmeatboy.github.io/Mob_Rule_Extended/>** 👈

1–2 players (local co-op) · keyboard or Xbox controllers · Chrome/Edge best.

## 🎭 Pick your bandleader

Three musicians, same two buttons, totally different feel:

- **🎵 PIP THE PIPER** — steady and true. One out, one home.
- **🥁 BAM THE DRUMMER** — DRUMROLL! Sends **three** hunters at once and they
  fight faster… but he walks slow and his shield gets sloppy.
- **🎻 VIVI THE FIDDLER** — pink dress, big bows, bigger brain: her music
  **slows robots** that touch the shield and recalls come home lightning-fast.
  Her hunters hit a little softer.

Plus **3 save files** — everyone in the family gets their own progress.
(Deleting asks twice, out loud, so nobody loses a save by accident.)

## 🎮 How to play (there are only two buttons)

| Action | Keyboard P1 | Keyboard P2 | Xbox |
|---|---|---|---|
| Walk | `WASD` | Arrows | Left stick |
| **SEND** one critter to attack (hold = stream) | `Space` | `Enter` | **A** |
| **RECALL** one to your shield (hold = all) | `Shift` | `RShift` | **B** |
| Pause | `Esc` | `Esc` | **Start** |
| Mute | `M` | `M` | **View** |

That's it — but the heart of the game is the **attack-vs-shield economy**:
your critters orbit you as a living shield. Every critter you SEND out is a
hunter that fights for you — and one less body between you and the robots.
Balance it in real time: turtle up when swarmed, unleash when it's safe.

**⚠️ YOU are the health bar (100 HP).** You regenerate slowly, apples heal
+25, and shield critters nibble anything that breaches the wall. Walk over
**cages** to free recruits, and never stop moving.

**Your mob has health too** — watch the MOB bar at the top. Critters *heal
while on shield duty*, and wounded hunters retreat home on their own to mend.
If the whole mob falls, it's a **LAST STAND**: 12 seconds to crack a cage and
rebuild, or the Tidy Empire wins. Drop below 5 critters and **golden rescue
cages** of wild volunteers start appearing — follow the gold arrow and
rebuild the parade.

## 🐾 The rules of the mob

- **Three of a kind MERGE.** Three frogs become a Bullfrog. Three Bullfrogs
  become the **FROG KING**. Every species has a throne.
- **Crossroads:** after each wave, pick a card — recruit packs, mob-wide
  buffs, piper upgrades, or wild ones (*"Bunnies occasionally make MORE
  bunnies"*).
- **12 species**, each with a job: frogs bite, ducks spit, goats headbutt,
  turtles taunt, skunks… you know. Owls snipe. The moose is a moose.
- **12 waves, 3 bosses:** MOWTRON 9000 (charges), THE SUCC-5000 (pulls your
  whole mob toward its nozzle — waddle away!), and **BUNNYTRON** — a giant
  pink robot bunny that stomps, summons, and rains **carrot bombs** on your
  mob (watch for the orange landing rings!).
- **Bag-Bots steal critters.** Pop the bot, free the friend.
- **Acorns feed the mob:** every 50 acorns you grab in a run, your whole mob
  physically **grows 15% bigger** (and reaches farther). Chunky parade!
- **Acorns** drop from scrapped bots — they unlock **7 more species**
  permanently (bunny → skunk → owl → wizard mouse → penguin → butterfly →
  moose) and track your legend: *biggest mob ever* is saved forever.
- **Co-op:** critters follow whichever piper is nearest; each of you whistles
  your own half of the swarm. Downed partner? Stand close to revive.
- **Little Piper mode** (per player): extra hearts, bigger pickup magnet,
  louder whistle. Toggle on the title screen.

## 🛠️ Running locally & tech

```bash
git clone https://github.com/RedMeatBoy/Mob_Rule.git
cd Mob_Rule && npx serve     # or python -m http.server
node tests/engine.mjs        # 89 headless assertions
node tests/simulate.mjs 24   # bot plays full runs; reports difficulty band
node tests/perf.mjs          # 150-critter mob tick time
```

Vanilla JS + Canvas, zero dependencies, zero asset files — every critter is
drawn in code and every sound (including each species' voice) is synthesized.
A friendly announcer (your browser's built-in speech) calls out waves, bosses,
and powerups — perfect for players who can't read yet.
The whole game is balance-simulated headlessly before any human plays it.

---

*No critters are harmed. Defeated bots are recycled. The lawn will never be
tidy again.* 🦆🐐🐝
