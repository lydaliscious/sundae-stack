# Sundae Stack

A motion-controlled party game for the Little TV. Step left and right in front of the TV to move a cartoon toddler who holds a big sundae bowl over their head. Catch falling scoops and toppings, dodge falling toys, and finish each sundae with a cherry to serve it. Rounds last 60 seconds of play or three spills.

> "Catch ice cream. Dodge toys. Add a cherry to finish!"

## Run it

```bash
cd apps/sundae
export NODE_AUTH_TOKEN=$(gh auth token)   # only to install the private @kabletv packages
npm install
npm run dev                               # http://127.0.0.1:7143 (binds 0.0.0.0)
little dev                                # optional: the Little simulator, reusing the dev server above
```

`npm run dev` and `npm run build` first run `scripts/copy-mediapipe.mjs`. It copies the MediaPipe wasm into `public/mediapipe/` and downloads the pose model once. If either is missing at runtime, the app loads them from the CDN.

| Command | What it does |
| --- | --- |
| `npm test` | Vitest: scoring, cherry offer and 6 s re-offer, Rainbow bonus, exactly-once catches, catch surface and side hits, spills, round timing, restart, difficulty schedule, spawn spacing, calibration, mirroring, deadband, smoothing, tracking loss, face speckles |
| `npm run lint` | ESLint |
| `npm run build` | Production build (Next.js 16, Turbopack) |
| `little manifest validate` | Checks `little/manifest.json` (also served at `/little/manifest.json`) |
| `little dev snapshot` / `little dev call <tool> '{…}'` | What the TV agent sees, and firing a tool as the agent would |

## How to play

- **Camera:** choose **Play with Camera**. Setup has four steps: stand in the middle, step left, step right, then try it out. The toddler follows your hips, not your arms, so waving doesn't steer. Your position maps directly to a place on screen: stand still and the toddler stays put.
- **Arrow keys:** choose **Play with Arrow Keys**. The keys drive the same movement system as the camera.
- **Scoring:**
  - Each scoop adds 10 points and each topping adds 5 to the current sundae ("This sundae").
  - A cherry is offered once the sundae has 3 scoops. If you miss it, another one comes about 6 seconds later.
  - Catching the cherry serves the sundae. Its points are banked plus a 25-point bonus, and it joins the counter.
  - Three different scoop flavors make a **Rainbow Sundae**, worth 30 more points when it's served.
  - A toy spills the sundae. Its unbanked points are lost and one of your three bowls is used up. Banked points stay.
  - Toppings caught before the first scoop just slide off.
- **Pausing:** Escape (Back) or the pause button opens the pause menu, where you can resume, recalibrate, restart, toggle sound or quit. The game also freezes whenever it can't see exactly one player clearly. It resumes after 3 seconds once tracking is stable again.
- **Remote:** arrows move between buttons and Enter presses them. During a round, arrows steer in keyboard mode.

## Little integration

- **Tools** (in `little/manifest.json`): `start_game {mode}`, `pause`, `resume`, `restart`, `recalibrate`, `confirm_calibration`, `redo_calibration`, `skip_calibration`, `toggle_sound {on}`, `show_results`, `back_to_menu` and `get_game_status`. Each tool calls the same action as the matching on-screen button. Only the tools that make sense on the current screen are active.
- **Launch:** `{"mode": "camera" | "keyboard"}` starts a round right away.
- **Perception:** menu buttons, the calibration steps, HUD readouts (banked score, this sundae, time left, spills left) and the results are annotated with `data-little-*`, with numbers in `data-little-data`.
- **Events:** `round_started`, `sundae_served`, `rainbow_sundae`, `sundae_spilled`, `tracking_lost`, `tracking_restored`, `paused` and `round_over`.
- **Body tracking:** if Little grants `sense.pose`, the game uses Little's body points and never sees video. If no pose frame arrives within 4 seconds (for example in `little dev` without realtime pose), it falls back to MediaPipe Pose Landmarker on a camera opened with `media.camera` (or `getUserMedia` in a plain browser).
- **Pause and visibility:** Little's pause, a hidden page and (outside Little) lost window focus all freeze every clock, stop the camera and suspend audio.

## Tuning

| What | Where |
| --- | --- |
| Round length, points, cherry timing, difficulty schedule (spawn interval, fall time, toy share), spawn spacing, catch overlap, stack compression, speckle cap | `DEFAULT_CONFIG` in `src/game/config.ts` |
| Deadband, smoothing time constant, arrow-key speed, playable x range | `DEFAULT_MOVEMENT` in `src/input/movement.ts` |
| Tracking confidence, stability and loss timing, jump detection | `DEFAULT_TRACKING` in `src/input/tracking.ts` |
| Calibration hold time and tolerance, minimum step size | `DEFAULT_CAPTURE` in `src/input/calibration.ts` and `CALIBRATION_LIMITS` in `src/input/mapping.ts` |

## Code map

- `src/game/`: the pure, deterministic simulation (seeded RNG, fixed 1/120 s steps). It covers spawning, collisions against the top of the stack, scoring, spills and speckles. It never touches the DOM.
- `src/input/`: pure input mapping (calibration, mirroring, deadband, smoothing, tracking health) plus the replaceable `PoseInputAdapter`s in `adapters/` (Little `sense.pose`, MediaPipe).
- `src/render/`: procedural Canvas 2D art (parlor, toddler, sundae, items, effects, results thumbnails).
- `src/engine/runner.ts`: the game loop and every user-facing action (UI buttons, remote and Little tools all call these).
- `src/audio/sfx.ts`: synthesized WebAudio sound effects.
- `src/components/`: the React/shadcn screens (menu, calibration, HUD, pause dialog, results) and `LittleBridge.tsx`.

## Privacy

- **Little pose:** with `sense.pose`, only body keypoints reach the app.
- **MediaPipe fallback:** camera frames are analysed in the browser on the TV and never uploaded. Only the hip midpoint is used for steering, and the skeleton is drawn in the calibration preview.
- **Camera lifetime:** the camera is released when the game is paused, hidden or finished, and when you leave the camera screens.
- **Stored data:** the best score and preferences (sound, last mode) are kept in `localStorage`. With Little, sound and mode are also saved as app state.

## Needs testing on Little hardware

- `sense.pose` on a real TV: frame rate, hip confidence, and how the person-count heuristic behaves with people in the background. The simulator grants `sense.pose` but sends no frames on this VM.
- `media.camera` on the device. In the simulator on a machine with no camera, the request never settles. The app times out after 12 s and offers **Try again** or the arrow keys.
- Calibration distances in a real living room: whether the default step thresholds (`minStep`, `tolerance`) suit both small children and adults.
- Frame pacing of Canvas 2D at 1920×1080 on the TV's GPU, and MediaPipe CPU fallback speed if WebGL isn't available.
- Remote Back key mapping (handled as Escape) and audio latency on the TV speakers.
