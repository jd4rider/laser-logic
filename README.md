# Laser Logic

Rotate mirrors to steer laser beams into the receivers. Built with Phaser 4, Vite and Electron — playable in the browser and as a desktop app for macOS, Windows and Linux.

- Play in your browser: <https://jd4rider.github.io/laser-logic/play/>
- Downloads: <https://github.com/jd4rider/laser-logic/releases/latest>

## How to play

Tap a mirror to flip it and steer the beams into every target. A target lights up only when it receives exactly its colour.

- **Colour filters** pass only their own colour. **Splitters** send a beam two ways. **Prisms** split white light into red, green and blue.
- **Movable mirrors** (gold ring) can be dragged to any empty cell, and tapped to flip.
- **Journey** — 60 levels across 5 worlds. Finish close to par for 3 stars.
- **Rush** — 120 seconds. Every solved puzzle adds time.

Use **Hint**, **Undo** and **Reset** freely.

## Develop

```sh
npm install
npm run dev      # web dev server
npm test         # puzzle logic tests
npm start        # build and open in Electron
npm run dist:mac # package an installer (also dist:win, dist:linux)
```

## Release

Push a tag like `v0.1.0` and the **Release apps** workflow builds the macOS, Windows and Linux installers. Every push to `main` deploys the web version to GitHub Pages.
