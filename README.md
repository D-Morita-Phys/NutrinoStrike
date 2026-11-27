# Neutrino Strike

A Monster Strike-style neutrino gacha that runs in the browser. You pick a
detector, then charge a glowing neutrino ball by dragging anywhere in the shot
window and release to fire it straight from the FRONT into DEPTH toward the
detector shown at the BACK (Super-Kamiokande or KamLAND). There is no gravity
and no arc, and there is no aiming: the ball always flies toward the detector.
How FAR you dragged (magnitude only) sets the neutrino energy and how forcefully
and fast the ball reaches the back, and a weighted lottery for that energy band
decides which species you actually observe. Reactor and geoneutrinos dominate
the low band, the diffuse supernova background dominates the mid band, and
atmospheric and accelerator neutrinos dominate the high band. A supernova burst
neutrino is the rare drop that can turn up in any band and sets off a special
celebration. Every species you observe is recorded in a collection (zukan) that
persists across reloads.

## Screen flow

The game is a lightweight multi-screen single-page app driven by a small,
pure scene state machine (`src/game/scenes.ts`); there is no framework or
router. The screens flow:

```
start  ->  select detector  ->  play  ->  result  ->  collection
```

- **Start**: title plus スタート (go to detector select) and コレクション
  (open the zukan).
- **Select detector**: choose KamLAND or Super-Kamiokande. Each choice shows a
  self-generated SVG illustration (no image files). The detector you pick
  becomes the single on-field target.
- **Play**: the drag-to-launch play field.
- **Result**: shown when a shot resolves. It presents the observed species with
  a large self-generated SVG illustration of that neutrino as the hero image,
  plus its Japanese name, color swatch, the detector it was seen at, the energy,
  and a full Japanese description, plus もういちど (replay with the same
  detector) and コレクションを見る (open the zukan).
- **Collection / zukan**: all six species; discovered ones show their own SVG
  illustration, name, color, and Japanese description, undiscovered ones are
  locked as `???` silhouettes (the illustration stays hidden until discovered).
  It also shows the discovery count (X / 6) and completion rate.

A persistent hamburger menu sits at the top of every screen with three actions:
やり直し (restart to the start screen), 音量調整 (a volume slider wired to the
audio engine), and コレクション (open the zukan).

## Tech stack

- Vite (dev server, bundler)
- TypeScript
- Canvas 2D for rendering (no game engine; motion is a small self-written
  depth integrator that advances the ball from the front to the detector plane
  at the back, with no gravity or bounce)
- Web Audio API for all sound (synthesized at runtime, no audio files)
- A small, pure scene state machine (no framework or router)
- Vitest for unit tests of the pure logic (lottery, physics, detectors, scenes,
  and the collection store)

## Prerequisites

- Node.js 18 or newer (developed and tested on Node 22)
- npm (bundled with Node)

## Setup and run

Install dependencies, then use any of the scripts below. The commands match the
`scripts` block in `package.json`.

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (serves the game at the printed localhost URL)
npm run build    # type-check (tsc) and produce a production bundle in dist/
npm run preview  # serve the built bundle from dist/ locally
npm test         # run the Vitest unit tests once
```

`npm run test:watch` is also available for re-running tests on change during
development.

## Controls

- Press (mouse) or touch **anywhere** on the play field to start charging. You
  do not need to grab the ball itself.
- Drag in **any direction** to charge. Only the DISTANCE you drag within the
  shot window matters (magnitude only); the direction is ignored. While you
  drag, a translucent charge gauge appears as a STRAIGHT arrow (a rectangular
  shaft plus a triangular head) pointing up toward the detector. The arrow is
  straight, with no curved segments, and its whole size (shaft length and
  thickness and head) grows with pull strength, so a weak pull draws a small
  arrow and a full pull a clearly larger one, reading the launch energy. An
  energy readout and band color accompany it. The arrow is a charge gauge, not
  an aim arrow: it always points toward the detector, because there is no
  aiming.
- Release to fire the ball straight into **depth** toward the detector at the
  back. The farther you dragged, the higher the neutrino energy and the more
  forcefully and faster the ball reaches the back. Arrival at the detector kicks
  off a short, decaying screen shake and a synthesized sound.
- Both mouse and touch input are supported. On touch screens the page does not
  scroll while you drag.

### Play-screen visuals

The launch is drawn in a Monster Strike-style pseudo-3D, all in Canvas 2D with
no external assets:

- **Pseudo-3D launch.** The neutrino ball reads as a sphere flying away from you
  into the field: it starts at the front and SHRINKS as it recedes into depth
  toward the detector at the back (the vanishing point), its drawn position
  converging on the detector center. It carries a fading motion trail and is
  shaded with a spherical highlight and rim so it looks round rather than flat.
  There is no gravity and no arc; the ball travels straight into depth.
  Everything is drawn with Canvas 2D gradients and paths; there is no WebGL, 3D
  engine, or image asset.
- **Charge-time shake on the ball only.** While you are pulling and charging the
  gauge, the vibration is applied to the neutrino ball alone, not the whole
  screen. A stronger pull produces a stronger vibration, so the shake reads the
  energy you are building up. The ball's world coordinates are untouched; the
  wobble is a draw-time transform.
- **Focus on the target.** From the moment you release until the ball hits, the
  camera pushes in toward the chosen detector so the target clearly becomes the
  main subject while the ball flies to it. The zoom is a draw-time
  (save/translate/scale/restore) transform that leaves the physics and hit test
  in world coordinates, and it resets cleanly on replay.
- **Photon burst on hit.** The instant the ball reaches the detector, a radial
  burst of bright, light-colored particles fires from the hit point to evoke the
  photon flash a real detector registers. The particles stream outward and fade,
  drawn with additive Canvas 2D compositing so they read as glowing light. The
  burst plays on every hit, sits alongside the rare-drop flash, and is cleared
  on replay so each run starts clean. Like the other effects it is drawing-only
  and never touches the physics; the particle math is a set of pure functions in
  `src/game/effects.ts`.

When the ball reaches the detector plane at the back, the launch energy is
converted to an energy band, the lottery draws a species using that band's
weights, and the app switches to the result screen with the species, detector, energy, and a full
Japanese description. Each observation is also recorded to the collection. If
the draw is a supernova burst, a rare celebration plays: a canvas flash, a
stronger shake, a distinct synthesized cue, and a レア発見！ banner on the
result screen. The first time you observe a species, the result screen shows a
NEW! badge.

### Audio

All sound is synthesized at runtime with the Web Audio API (oscillators, gain
envelopes, and noise bursts) in `src/game/audio.ts`. There are **no audio files
and no external URLs**, so the game works offline. The AudioContext is created
lazily and resumed on your first interaction to satisfy browser autoplay
policies. The hamburger 音量調整 slider sets the master volume, which is
persisted to `localStorage` and restored on the next visit.

### Collection and persistence

The collection (zukan) tracks which of the six species you have discovered.
State is stored in `localStorage` under a namespaced key through the pure store
in `src/game/collection.ts`, which takes an injectable `Storage`-like object so
it unit-tests without a browser. The store tolerates malformed or older stored
JSON (it keeps the valid parts and ignores the rest), so a format change never
wipes your progress. The collection page shows the discovered count (X / 6) and
completion percentage.

## Game design

Pull strength is the distance you drag within the shot window (magnitude only,
no direction) and maps to a neutrino energy between `MIN_ENERGY_MEV` (1 MeV) and
`MAX_ENERGY_MEV` (1000 MeV). The map is logarithmic, so each of the three energy
bands occupies a comparable slice of the pull range: a gentle pull lands in the
low band, a medium pull in the mid band, and a strong pull in the high band. The
same pull magnitude also sets how fast the ball advances through depth, so a
stronger pull reaches the detector at the back sooner.
That energy falls into one of three bands, and each band has its own weight
table that favors different species:

| Energy band | Range | Dominant species |
| --- | --- | --- |
| Low | ~0-10 MeV | Reactor neutrino, Geoneutrino |
| Mid | ~10-100 MeV | Supernova diffuse background neutrino (DSNB) |
| High | >=100 MeV | Atmospheric neutrino, Accelerator neutrino |

The six observable species:

- **Reactor neutrino** (原子炉ニュートリノ) - low energy, from nuclear reactor
  fission.
- **Geoneutrino** (地球ニュートリノ) - low energy, from radioactive decay
  inside the Earth.
- **Supernova diffuse background neutrino / DSNB** (超新星背景ニュートリノ) -
  mid energy, the faint background from all past supernovae.
- **Atmospheric neutrino** (大気ニュートリノ) - high energy, from cosmic-ray
  air showers.
- **Accelerator neutrino** (加速器ニュートリノ) - high energy, from particle
  accelerator beams.
- **Supernova burst neutrino** (超新星爆発ニュートリノ) - the RARE drop. It
  carries a small but nonzero weight in every band, so a lucky hit can produce
  it regardless of pull strength.

The two detectors (KamLAND themed to the low-energy regime, Super-Kamiokande to
the high-energy regime) are cosmetic targets. The observed species is always
decided by the lottery from the launch energy, not by which detector you hit.

The Japanese explanation shown for each species on the result and collection
screens lives in one easy-to-edit place: the `descriptionJa` field of
`NEUTRINO_INFO` in `src/game/neutrinos.ts`. It is pure data, and a unit test
asserts every species has a non-empty `descriptionJa`, so the copy can never
silently go missing. Edit the strings there to change the Japanese text.

## Tuning the balance

All gameplay balance lives in one place: the weight tables in
`src/game/neutrinos.ts`. This module is pure data with no dependency on
rendering, physics, or the DOM, so you can retune ratios without touching any
other file.

- `ENERGY_BANDS` is an array of bands. Each band has an `id` (`low` / `mid` /
  `high`), a MeV range (`minMeV` / `maxMeV`), and a `weights` record with one
  nonnegative number per species.
- To change how likely a species is in a given band, edit that band's
  `weights`. The numbers are relative selection weights, not probabilities, so
  the lottery normalizes them for you. Raising one species' weight makes it
  more common in that band; setting it to 0 removes it from that band.
- `MIN_ENERGY_MEV` and `MAX_ENERGY_MEV` set the energy range that pull strength
  maps onto, and each band's `minMeV` / `maxMeV` set where the band boundaries
  fall.
- Keep `supernovaBurst` small but nonzero in every band to preserve its "rare
  drop in any band" behavior.

The lottery itself (`src/game/lottery.ts`: `pullToEnergy`, `energyToBand`,
`drawNeutrino`), the physics (`src/game/physics.ts`), and the Canvas rendering
and input (`src/render/game.ts`) read from this data and do not need to change
when you rebalance the drop ratios.

## Deploying to GitHub Pages

The game is published as a GitHub Pages project page at
[https://d-morita-phys.github.io/NutrinoStrike/](https://d-morita-phys.github.io/NutrinoStrike/).

Deployment is automated with GitHub Actions (`.github/workflows/deploy.yml`):
every push to the `main` branch builds the site and publishes `dist/` to Pages.
You can also trigger it manually from the Actions tab (`workflow_dispatch`).

One-time setup (a repository maintainer has to do this once in the GitHub UI):

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

After that, pushing to `main` deploys automatically. Because the site lives
under the `/NutrinoStrike/` subpath, `vite.config.ts` sets `base` to
`/NutrinoStrike/` for production builds only (`npm run dev` still serves from
`/`), so assets resolve correctly on Pages.

## Project layout

```
NutrinoStrike/
  index.html              entry HTML (mounts #app)
  src/
    main.ts               locates #app and mounts the app shell
    style.css             page, screen, menu, result, and zukan styling
    game/                 pure logic (no DOM)
      neutrinos.ts        species data + Japanese descriptions + energy bands + weight tables (balance knobs)
      lottery.ts          pull -> energy -> band -> weighted draw
      physics.ts          depth integration and pull magnitude -> depth speed/energy
      detectors.ts        Super-Kamiokande / KamLAND targets
      scenes.ts           pure scene (screen) state machine
      collection.ts       pure discovery store (injectable Storage; localStorage-backed)
      audio.ts            Web Audio synthesis engine + volume persistence helpers
      __tests__/          Vitest unit tests (lottery, physics, detectors, scenes, collection)
    ui/                   DOM screens (no canvas drawing)
      app.ts              mounts the shell, wires the scene machine, Game, and collection
      screens.ts          the five screen containers (start/select/play/result/collection)
      menu.ts             persistent top bar + hamburger menu
      content.ts          renders the result card and the zukan grid from pure data
      detectorArt.ts      self-generated SVG illustrations for the detectors
      neutrinoArt.ts      self-generated SVG illustration per neutrino species
    render/
      game.ts             Canvas drawing, pointer/touch input, shake/flash, game loop
```

All visuals are self-generated (inline SVG and Canvas 2D/CSS) and all audio is
synthesized at runtime; the game ships with no external image or audio assets so
it runs offline on the GitHub Pages subpath. Each neutrino species has its own
symbolic inline-SVG illustration in `src/ui/neutrinoArt.ts` (reactor vessel,
cross-sectioned Earth, diffuse distant supernovae, a cosmic-ray shower cascade,
an accelerator ring, and an exploding star for the rare burst), built the same
way as the detector art and shown on the result screen and in the zukan.
