# PLAYBOOK — definition of done for EVERY change (any model, any session)

This file exists so that quality does not depend on which AI model or which
session does the work. Follow it mechanically. No step is optional.

## The ritual (in order, every change)

1. **Read CLAUDE.md first.** It holds the architecture, the invariants, and
   the gotchas that have already bitten us once (merges shrink lists mid-
   iteration; passive entities must never gate wave completion; the no-maze
   law; localStorage keys are namespaced per edition).
2. **Syntax gate:** `node --check` on every touched file in `src/`.
3. **Assertion gate:** `node tests/engine.mjs` — must be 100% green.
   New features ADD assertions (a feature without a test doesn't exist).
   Count-based assertions must measure mob WORTH (Σ 3^(tier-1)), never raw
   count — merges shrink counts.
4. **Balance gate:** `node tests/simulate.mjs 12 pip 0` — verdict must be
   IN BAND (mediocre bot: median wave 6–11 on GARDEN PARTY fresh save,
   0 victories). After balance-touching changes also run
   `... 12 pip 4 maxed` — a maxed save must NOT cruise MAXIMUM TIDY.
   If the sim ceiling looks like difficulty, suspect a bug first (the
   wave-9 cone softlock masqueraded as "max wave 9" for days).
5. **Perf gate:** `node tests/perf.mjs` — avg logic frame < 2ms at max load.
6. **Docs:** update CLAUDE.md (new invariants/gotchas) and README.md
   (player-facing features + assertion count) in the same commit.
7. **Commit** with a body that says what and why; then **push**.
8. **Verify the deploy by reading the served file** — NEVER trust the
   GitHub checkmark:
   `curl -s https://redmeatboy.github.io/<repo>/src/<file> | grep <new-marker>`
   If Pages fails or stalls (it does, ~weekly):
   `gh api repos/RedMeatBoy/<repo>/pages/builds -X POST` forces a fresh
   build. Re-verify after.

## Art changes (additional gates)

- Follow `assets/STYLE.md` exactly — expressions, palette, outline, camera,
  and the render checklist live there.
- **LOOK at every render** (open the PNG) before accepting it. Never
  batch-accept unseen art. Check specifically: expression reads Happy or
  Confident; colors are vivid (if sage/grey, the view transform is wrong);
  nothing floats detached from the body; silhouette reads at 32px.
- New species: iterate until the still frame passes, then check one hop
  frame and one side/back frame.
- After integrating: run the full assertion suite (art must never break
  headless tests — loaders live behind `typeof Image !== 'undefined'`).

## Design changes (the taste gates)

- Every mechanic must be explainable to a 5-year-old in one sentence, and
  every button must have an obvious job (see game-quality lessons: losses
  must be legible; feel-critical precision input is forbidden).
- Every hazard/obstacle: readable at a glance, exploitable by strategy.
- Kid-facing text is also SPOKEN (announcer) — pre-readers play this game.
- When adding difficulty/economy knobs: the difficulty ladder absorbs power
  creep; never nerf a player-visible toy to fix balance if a knob exists.

## Playtest protocol

Ship one coherent feature set per deploy, then STOP for Brad's family
playtest before the next design-changing batch. Feedback rounds are the
real QA. Log each round's feedback + resolution in CLAUDE.md.
