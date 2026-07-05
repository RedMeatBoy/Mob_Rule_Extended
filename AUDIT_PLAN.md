# THE FUN & BALANCE AUDIT — every element earns its place

The question, per element: **would the game be worse without this, exactly
as it is?** If not, it gets changed or cut. Polish (music, voice, art
refinement) is FROZEN until this audit passes — polish on an unproven
element is wasted work.

**The bench:** 🧪 TESTING LAB (title menu). Pick arena/character/
difficulty/wave-scaling, then spawn anything: `[ ]` select critter,
`1/2/3` spawn at tier, `, .` select enemy, `E`/`R` spawn normal/elite,
`V` toggles real waves at the chosen scaling, `+/−` adjusts scaling live,
`X` clears, `I` god mode, `H` heal, `G` acorns. Lab runs never bank or
unlock — experiment freely.

## Session 1 — Bandleaders (4 characters)
For each: 5 minutes in the lab vs. real waves (V), same arena, same wave.
- **Identity test:** describe their playstyle in one sentence a kid would
  say ("BAM throws everybody at once!"). Can't? Not distinct enough.
- **Rhythm test:** does their send/recall pattern FEEL different in the
  hands within 30 seconds (not just numerically different)?
- **Signature moment:** each character needs one — Bam's triple wall-break,
  Vivi yanking the mob through danger, Echo's recall-bomb run. Does it
  happen naturally in play, or only when you force it?
- Grade each A/B/C: A = untouchable, B = tune numbers, C = redesign ability.

## Session 2 — Critters (12 species × 3 tiers)
Lab: spawn 3–5 of ONE species (V on, scaling ~wave 5, then ~wave 9).
- **Job test:** watch 60 seconds — can you SEE its job happening (goat
  charges, owl snipes, turtle holds)? Invisible job = not earning its slot.
- **Tier test:** spawn tier 1 next to tier 3. Does the KING feel like an
  event beyond bigger numbers?
- **Fun test (the kid criterion):** is there something to WATCH and love —
  a motion, a sound, a habit? (Eva's bunny passes on cuteness alone; every
  species needs its own version of that.)
- Rank all 12 by "would a kid pick this?" — the bottom three get redesigns.

## Session 3 — Combos (the group-power question)
Lab, mono-loadouts and pairs, V on at wave 7–9:
- Mono-mobs: all-frog, all-turtle, all-bee, all-owl. Each should have an
  obvious strength AND an obvious hole (all-turtle = unkillable but slow
  kills; all-owl = artillery with a soft wall). No hole = nerf; no
  strength = buff.
- Designed pairs to verify: turtle+owl (wall & artillery), goat+bee
  (chaos rush), butterfly+anything (sustain), skunk+moose (area denial).
  Each pair should beat the sum of its parts somewhere visible.
- Find one accidental combo that delights. If none exists, the design
  space is too flat — add cross-species synergy hooks.

## Session 4 — Enemies (9 bots) & bosses (3)
Lab: spawn each enemy alone (E), then ×6, then elite (R), vs. a standard
mixed mob.
- **Threat identity:** each bot must demand a DIFFERENT response (bagbot =
  chase it down, broom = don't clump, sneaky = guard the piper). If two
  bots demand the same response, merge or differentiate them.
- **Readability:** can you tell what it's about to do from silhouette +
  motion alone (no HUD)?
- Bosses at wave-appropriate scaling, each character: every boss should
  have a learnable pattern, a panic moment, and a counter-play story you
  can tell afterward. BUNNYTRON must be the best 90 seconds of the game.

## Session 5 — Arenas (7 maps)
Same character, same loadout, V on, one full wave-cycle per arena:
- **The blindfold test:** could you name the arena from the minimap shape
  of your movement alone? Each map should force different pathing.
- **Terrain leverage:** did you USE the arena feature (pond-luring, mud
  gaps, valley funnel, vent timing) or just fight on top of it? Unused
  features get amplified or cut.
- **Loadout pull:** does the arena change what you'd bring? (Riverside
  says ducks; if an arena says nothing, it's a skin, not a map.)

## Data support (runs alongside, not instead)
- `node tests/simulate.mjs 16 <char> <diff> [maxed] [arena]` — the band
  (median 6–11, 0 bot wins fresh) is the floor, not the goal.
- After every change: engine suite + render smoke + the affected sims.
- Findings log: append to this file per session — element, grade, change
  decided, change shipped, retest date.

## Exit criteria (then and only then: polish + music/voice)
1. Every character, species, enemy, boss, and arena graded A or B.
2. Every C either redesigned to B+ or cut without regret.
3. All sims in band after all changes.
4. One full family session on the post-audit build where nobody asks
   "what does this one do?" about anything.

## ELEMENT REFERENCE — what you're grading against
_(Built from the live deployed build; the ☐ checkboxes are the audit worklist.)_

### ☐ Bandleaders (4)

| | PIP 🎵 | BAM 🥁 | VIVI 🎻 | ECHO 🎼 |
|---|---|---|---|---|
| Send | 1/tap, stream 0.14s | **3/tap, 1.5s cooldown**, no stream | 1/tap, slow stream 0.20s | 1/tap, stream 0.16s |
| Recall stream | 0.11s | 0.11s | **0.06s** | 0.11s |
| Hunter damage | ×1.0 | ×1.0 | **×0.85** | **×0.90** |
| Hunter attack speed | ×1.0 | **×1.2** | ×1.0 | ×1.0 |
| Shield nibble speed | ×1.0 | **×0.8** | ×1.0 | ×1.0 |
| Walk speed | ×1.0 | **×0.88** | ×1.0 | ×1.0 |
| Recall return speed | ×1.0 | ×1.0 | **×2.5** | ×1.35 |
| Special | — | — | **Lullaby wall**: shield bites slow bots 1.2s | **Recall BOOM**: rejoiner detonates (1.6× its dmg +4, r95) |
| Fantasy | the teacher | burst commander | safe defender | recall tactician |

### ☐ Critters (12) — tier-1 stats; every merge tier is ×2.3 damage & HP

| Species | Visible job | Dmg | Atk | HP | Spd | Range | Price | Terrain | Tier 3 |
|---|---|---|---|---|---|---|---|---|---|
| Frog | melee bite | 3 | 0.9s | 13 | 150 | — | 8🌰 | swim .85, **mud-immune** | FROG KING |
| Duck | ranged spit | 2 | 1.1s | 10 | 140 | 150 | 8🌰 | **swims free** | DUCK OF WAR |
| Goat | 3.2×-speed ram + knockback | 5 | 2.0s | 18 | 160 | 180 trig | 10🌰 | — | THE UNFENCED |
| Bee | fastest melee | 1 | 0.35s | 5 | 210 | — | 6🌰 | flies; wind-drifts | THE COMMITTEE |
| Turtle | tank — **bots target tanks first** | 2 | 1.2s | **38** | 90 | — | 10🌰 | **swims + sand-immune** | FORTRESS |
| Bunny | melee; breeds w/ wild card | 2 | 0.8s | 10 | 180 | — | 7🌰 | — | THE MULTIPLIER |
| Skunk | stink cloud | 1/tick | 3s cd | 13 | 120 | r62 | 12🌰 | **mud-immune** | THE INCIDENT |
| Owl | sniper | **6** | 1.8s | 9 | 150 | **260** | 14🌰 | flies | THE PROFESSOR |
| Wizard Mouse | homing bolts | 4 | 1.4s | 8 | 140 | 200 | 14🌰 | — | MOUSTERIOUS |
| Penguin | pierce shots | 4 | 2.2s | 16 | 130 | — | 14🌰 | **swims free** | EMPEROR |
| Butterfly | heals 3 HP × 3 allies | — | 2.0s | 8 | 160 | r90 | 16🌰 | flies | THE APOTHECARY |
| Moose | slam AoE | **8** | 1.6s | **60** | 110 | r55 | 24🌰 | — | THE LANDMASS |

Shield rules they all share: bite range 78px (+60 ranged), heal 4%/s on wall duty, auto-retreat below 50% HP; hunters chase within 800px.

### ☐ Intentional combos (designed on purpose — each must prove it)
1. **Turtle + Owl** — wall & artillery (taunts hold the ring, snipers out-range everything)
2. **Goat + Bee** — chaos rush (knockback scatters, swarm cleans up)
3. **Butterfly + any tier-3** — sustain protects the big investment
4. **Skunk + Moose** — slam clusters them, stink melts the pile
5. **Arena affinities** — waterfowl→Riverside/Dunes oasis; frog/skunk→Farm; fliers ignore terrain
6. **Character × species** — BAM+goats (triple charge), VIVI+turtles (double-safe wall), ECHO+bees (6🌰 recall-bombs)

### ☐ Enemies (9) — each must demand a *different response*

| Bot | The demand | HP | Dmg | Spd | Notes |
|---|---|---|---|---|---|
| Dust-Bot | spread out — they flank | 10 | 1 | 70 | 30% are **sneaky** (hunt the piper, ignore mob) |
| Mower Drone | dodge the telegraphed line | 22 | 3 | 55 | 0.8s aim → 300-speed dash |
| Tidy Drone | close the gap | 12 | 2 | 80 | flies; keeps 170px; shots hurt the piper ×4+4 |
| Broom Mech | don't clump | 30 | 2 | 50 | r70 sweep every 3s |
| Bag-Bot | CHASE IT | 16 | 0 | 115 | kidnaps critters, runs for the edge |
| Cone-Bot | ignore the litter | 14 | 1 | 65 | cones self-expire in 14s |
| Traffic Cone | (nuisance) | 10 | 0 | 0 | mob ignores |
| Sec-Bot 🌃 | tougher chase | 16 | 2 | 82 | rooftop dust-bot swap |
| Cam-Drone 🌃 | longer-range shooter | 14 | 2 | 85 | rooftop drone swap, range 240 |

### ☐ Bosses (3)

| Boss | HP | Moveset | Visual |
|---|---|---|---|
| MOWTRON 9000 (w4) | 450 | telegraphed charges + belches 2 dust-bots/8s | ×2 |
| THE SUCC-5000 (w8) | 650 | vacuum pull r340 on critters AND pipers; phase 2 @50%: +30% speed | ×2 |
| BUNNYTRON (w12) | 950 | stomp (r190) / shot / summon-3 cycle **+ carrot bombs** (2/volley, r92, 1.25s warning); MEGA HOP MODE @50%: 3 bombs, faster | **×3** |

All bosses: resist water sizzle (2%/s vs 8%), resist lightning (8% vs 40%), stomps deal only 0.6× to critters.

### ☐ Arenas (7)

| Arena | Layout | Hazards | Strategy it should force |
|---|---|---|---|
| 🌿 BACKYARD | open, nothing | none | control group |
| 🏞️ RIVERSIDE | stream + 2 bridges, 2 ponds, 5 rocks, 2 fences | bots sizzle 8%/s in water | water-luring; waterfowl loadouts |
| 🚜 MUDDY FARM | the barn, hay, fences, 4 mud pits | RAIN → bots ×0.86, mud spreads ×1.45 | frog/skunk turf; fight from mud |
| 🪨 QUARRY | 7 boulders, 2 hills (climb ×0.82/descend ×1.15) | WIND | high ground; downhill charges |
| 🏜️ DUNES | 5 rocks, oasis, global sand ×0.92 (turtle immune) | WIND | turtle mobs; own the oasis |
| ⛈️ PLATEAU | 340px valley channel, boulders | WIND + LIGHTNING (r78, 1.2s warn, 40% to bots) | valley funneling; storm-dancing |
| 🌃 ROOFTOP | AC-unit walls, night | 4 FIRE VENTS (5.7s rhythm, r72, 14%/pulse to bots) + security bot remix | vent-timing kites |

Wave scaling underneath everything: enemy HP ×(1+0.21/wave), dmg ×(1+0.065/wave), × difficulty (GARDEN PARTY ×1 → MAXIMUM TIDY ×2.8 HP / ×2 dmg).

## FINDINGS LOG
_(append entries here as sessions happen)_
