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

## FINDINGS LOG
_(append entries here as sessions happen)_
