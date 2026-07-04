# MOB RULE art style guide — "kawaii with an edge"

The target: Sanrio-adjacent charm (style is not copyrightable; their
characters are — never copy one) that also appeals to young boys.
Reference renders: `frog/frog_front_01.png`, `bunny/bunny_front_01.png`,
`duck/duck_side_01.png`. Match these before inventing.

## The rules

1. **Expressions are HAPPY or CONFIDENT. Never worried, never angry.**
   - Confident brows: inner ends LOW (builder: cube rot Y = +16° left,
     −16° right). Inner-ends-UP reads worried — forbidden.
   - Soften or DELETE brows on the sweetest species (bunny has none).
   - Big open smiles; the duck's upturned bill counts as a smile.
2. **Proportions:** one big head-body blob (~60% head), wide-set eyes with
   glints, tiny limbs. Every species keeps one signature silhouette hook
   (bunny: flopped ear tip; duck: head-feather curl; frog: eyes on top).
3. **Color:** vivid and saturated, not pastel. Blush pink #FF739E on every
   friendly critter. One accent color per species max.
4. **Outline:** chunky dark inverted-hull (solidify thickness −0.07,
   offset 1, flip normals, backface-culled dark material).
5. **Enemies** (when converted): same chunk and charm, but cool greys +
   one hot accent, LED eyes, no blush — cute enough to not scare, robotic
   enough to be clearly The Opposition.

## Render recipe (Blender 5.x — assets/critters_kawaii.py)

- `scene.view_settings.view_transform = 'Standard'` — **mandatory**; the
  default AgX desaturates everything to sage (this bit us on frog v1-v2).
- Sun energy 2.4, world background strength 0.85 (more blows pink to white).
- Ortho camera, front +10° above (rot X 80°), ortho_scale 2.6 (3.0 for
  tall ears), 256px transparent RGBA.
- 12 frames per view: idle squash 1–6, hop with stretch 7–12 (keyframes on
  a root empty; scale-only squash so views stay consistent).
- 3 views per species: front (0°), back (180°), side = **40° three-quarter**
  facing RIGHT (a true 90° profile floats far-side features — forbidden).
  The game mirrors side for leftward movement.
- Run headless: `blender.exe -b -P assets/critters_kawaii.py -- <sp> <out>`.

## Integration contract

- Frames at `assets/<sp>/<sp>_<view>_<NN>.png` (view ∈ front|back|side,
  NN ∈ 01..12); add the species to ART_SPECIES in game.js.
- Loader must stay behind `typeof Image !== 'undefined'` (headless safety);
  render falls back front-view → procedural.
- In-game draw size: `w = size * 4.6`, y offset `−w * 0.6`.
- Acceptance: LOOK at front + side + one hop frame at full size AND
  squint-test at ~32px. Then run the full test suite.
