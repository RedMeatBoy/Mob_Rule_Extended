# MOB RULE — Content ×3 Roadmap (path to a paid release)

Goal: grow the Extended Edition from a delightful 3–8 hours to a
$2.99–4.99-worthy 20+ hours, then release on Steam with a free web demo.
Agreed strategy: stay free on web/itch.io while building; charge only when
the content bar is honestly met.

## Content pillars (the "×3")

### 1. Characters: 3 → 6+
Each new character must twist the send/recall economy, not just re-stat it.
Candidates (design-approved concepts, build one per milestone):
- **ECHO the Conductor** — recalled critters emit a damage shockwave when
  they rejoin the wall (recall becomes a weapon).
- **MOSS the Sleepy Tubist** — huge slow notes: send/recall affect a whole
  RING of the orbit at once, long cooldowns, massive shield HP bonus.
- **PIPPA the Kazoo Kid** (Little Piper made canon) — tiny, fast, mob cap
  +25, but hunters wander back on their own (for young players: mistakes
  self-correct).

### 2. Species: 12 → 25+
New roles before new skins: burrower (pops up at target), sapper (slows in
a line), banker (generates acorns), mimic (copies strongest neighbor),
shieldbearer (blocks projectiles in an arc). Every species keeps the rule:
3 tier names, a voice, a job description a 5-year-old can repeat.

### 3. Arenas: 1 → 3
- **Backyard** (current) — the tutorial biome.
- **The Park** — ponds (critters swim, bots detour), bandstand power spot.
- **Mall Rooftop** — vents that launch the mob, neon night palette, new
  enemy set (security tidybots).
Arena = new WAVES table + palette + 2 hazards + 1 enemy variant. Danger:
keep hazards readable; no platforming, no precision.

## Supporting work
- **Achievements/quests expansion** (30+; feeds Steam achievements later)
- **Options**: volume sliders, colorblind-safe palettes, screen-shake off
- **Desktop wrap**: Tauri build + Steam SDK, cloud saves via Steam
- **Store assets**: capsule art, 6 screenshots, 30s trailer (record real
  mob chaos, no fake-ups), AI-disclosure text for the Steam form
- **Localization-lite**: the announcer already speaks; add ES/FR strings
  for UI labels (Web Speech handles the voices for free)

## Release gates (in order)
1. itch.io page live with the current web build (free) — collect feedback
2. Character #4 + 5 species + Park arena → "Big Update 1" (still free)
3. Character #5-6 + 8 more species + Rooftop arena + 30 quests → content
   bar met
4. Tauri/Steam build, Next Fest demo, wishlist 3–6 months
5. Launch $3.99 (web demo stays free as the funnel)

## Balance law (unchanged)
Every content addition ships only when: all engine assertions pass, every
character sims IN BAND at GARDEN PARTY on a fresh save, and a maxed save
still can't cruise MAXIMUM TIDY. The bot plays every build before any kid
does.
