# Architecture Review

## Findings

1. `app/main.js` is the primary load and maintenance bottleneck.
   It is over 10,000 lines and owns routing, Firebase boot, app state, audio engines, tool UIs, practice playback, tuner logic, looper logic, recorder logic, and update handling. This blocks effective browser caching because a tiny tool change invalidates the whole startup module.

2. Tool code is only partly lazy-loaded.
   `sound-effects` already follows a good pattern in `app/tools/sound-effects.js`, but most other tools still live in `app/main.js`. The next best extraction targets are `metronome`, `recorder`, `tabs-preview`, `guitarpro-viewer`, `tuner`, and `looper`.

3. `index.html` is too responsible for app shell, styling, boot logic, and tool markup.
   The current CDN Tailwind setup is convenient for development but not ideal for production. A production build should compile CSS, purge unused classes, and serve a small local stylesheet.

4. Firebase was initialized twice.
   `index.html` imported Firebase v12 while `app/main.js` imports Firebase v11 and initializes the real app. The inline `index.html` initialization added network work without powering the app.

5. Shared utility behavior is mixed into feature code.
   Helpers for media decoding, escaping, sharing, time formatting, and file handling should move to `app/modules/` so extracted tools can reuse them without reaching through `main.js`.

## Split Order

1. Keep `app/main.js` as the app orchestrator only.
   It should own boot, auth state, routing, and dependency wiring.

2. Move tool metadata and lazy-load config to `app/tools/tool-registry.js`.
   This has been started.

3. Extract self-contained tools one by one.
   Start with `metronome` and `recorder` because they already have clear DOM islands and state boundaries.

4. Move pure helpers to shared modules.
   Recommended modules: `app/modules/media-utils.js`, `app/modules/dom-utils.js`, `app/modules/time-utils.js`, and `app/modules/share-utils.js`.
   `app/modules/media-utils.js` has been started with upload type detection, Data URL conversion, and file reading helpers.

5. Move larger data/config tables out of startup.
   Chord libraries, tuning presets, training defaults, and demo content can live in separate modules and be imported only where needed.

6. Replace CDN Tailwind with a local production stylesheet.
   This requires adding a minimal build step, but it will improve startup performance and modern production hygiene.

## Target Shape

```text
app/
  main.js
  modules/
    repository.js
    renderers.js
    media-utils.js
    dom-utils.js
    time-utils.js
  tools/
    tool-registry.js
    metronome.js
    recorder.js
    looper.js
    tabs-preview.js
    guitarpro-viewer.js
    sound-effects.js
```
