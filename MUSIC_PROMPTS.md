# MOB RULE — Suno prompt pack (the score)

Generate these under YOUR paid Suno account (the commercial license
attaches to the generator). For every track: pick **instrumental only**,
generate 3–4 candidates, keep the one that makes the kids bounce.
Kids' votes are the QA.

## The style spine (paste at the START of every prompt)

> Playful orchestral-toybox instrumental for a cute family video game,
> whistling melodies, ukulele, glockenspiel, toy percussion, warm tuba
> bass, cheerful and adventurous, no vocals, clean loop-friendly
> structure, steady tempo,

Then append the per-track flavor below. Keep each full prompt under
Suno's length limit; the spine + flavor lines fit.

## The tracks

| File name | Flavor to append |
|---|---|
| `backyard.ogg` | sunny lazy-afternoon march, 100 bpm, easygoing and homey, light kazoo accents |
| `riverside.ogg` | gentle water-side stroll, 96 bpm, banjo and fiddle, bubbling flute runs like a stream, splashy woodblock |
| `farm.ogg` | barnyard hoedown, 112 bpm, fiddle and washboard, boot-stomp rhythm, playful and muddy |
| `quarry.ogg` | rock-hopping adventure, 108 bpm, marimba and stone-clack percussion, bold brass hits, echoing canyon feel |
| `dunes.ogg` | sunny desert caravan, 104 bpm, twangy guitar, shakers, heat-shimmer strings, a wandering oboe melody |
| `plateau.ogg` | stormy heroic march, 116 bpm, timpani rolls like thunder, urgent strings, brave brass, rain-stick texture |
| `rooftop.ogg` | neon night funk, 118 bpm, retro synthwave bass, electric piano, city-lights arpeggios, cool and sneaky |
| `boss_mowtron.ogg` | goofy menacing machine march, 120 bpm, heavy clanking percussion, low brass blats, revving textures, silly-scary |
| `boss_succ.ogg` | swirling vacuum waltz of doom, 3/4 time, spiraling strings, woozy theremin-like lead, comic menace |
| `boss_bunnytron.ogg` | EPIC final boss anthem but adorable, 126 bpm, full orchestra plus chiptune leads, choir-like synth pads, triumphant and huge |
| `title.ogg` | the main theme: warm welcoming overture, whistling lead melody, builds to a joyful parade march, memorable and singable |
| `victory.ogg` | short triumphant fanfare into a happy parade groove, confetti energy, 30 seconds is plenty |

## Generation tips
- Ask Suno for ~2:00–2:30 tracks (loops trim well from that length).
  `victory.ogg` short is fine.
- If a candidate has a great section but a weak intro, note the
  timestamps — the loop tool can cut to the good part.
- Consistency check: play `backyard` then `rooftop` back to back. Same
  band, different venue? Keep. Different game? Regenerate with the spine
  intact.
- If your Suno tier exports **stems**, download them for `plateau`,
  `rooftop`, and the three boss tracks — the engine can layer drums in
  as fights heat up. Not required: the engine works great with single
  files (it duck-swells the whole track on intensity instead).

## Install
Drop finished files in `assets/music/` with the exact names above
(the loop tool outputs them correctly): the engine picks them up on the
next load — no code changes. Any missing file falls back to the synth
score automatically.
