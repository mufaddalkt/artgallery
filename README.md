# The Living Gallery

A continuous, scroll-controlled museum built with React, TypeScript, Three.js, GSAP, and ScrollTrigger. Eight authentic artwork reproductions are presented in four connected galleries, entered through hinged bronze doors and ending in a sculptural rotunda.

## Run locally

Use Node.js 22.12 or newer and npm. Validation used Node.js 24.21.0. From this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server binds to `127.0.0.1`. For a repeatable installation from the included lockfile, use `npm ci` instead of `npm install`.

```sh
npm run check
node scripts/check-timeline.mjs
npm run build
npm run preview
```

`build` produces the static site in `dist/`; `preview` serves that build locally. No account, API key, or backend service is required. Artwork files are bundled in `public/artworks/`. Google Fonts supplies the two typefaces; system font fallbacks remain available if that request fails.

## Explore

- Scroll or swipe vertically to move; reverse scrolling retraces the same journey.
- Arrow keys, Page Up, and Page Down move between artwork stops. Space advances; Home returns to the entrance and End opens the rotunda.
- The progress marks and Visitor guide provide direct navigation.
- “Discover the story” opens the artwork's interpretation, medium, collection, and source credits.
- Ambient sound starts muted and only runs after it is enabled. Subtle mouse look is optional.

The Visitor guide includes a reduced-motion mode and an accessible reading room. Reduced motion uses stationary viewing poses, and the preference is saved locally when storage is available. The initial setting follows the operating system unless a visitor has saved a choice. The reading room also appears if the 3D renderer cannot initialize or loses its graphics context.

## How the journey works

Native document scrolling spans a 16,500-pixel tour. GSAP ScrollTrigger maps that scroll position to one normalized playhead, with a short scrub interval in cinematic mode. GSAP ScrollToPlugin animates keyboard and navigation-button destinations; native scroll input can interrupt those moves.

`sampleTimeline()` derives every camera pose, door angle, artwork-information fade, and room index from the same normalized progress. Camera positions follow centripetal splines; orientation uses quaternion interpolation. Each artwork has a stationary reading interval. Door movement reverses with the playhead, and the camera does not cross the entrance until both leaves are fully open.

The camera stays at a 1.66-meter eye height with a 52-degree vertical field of view. Artwork viewing distances respond to viewport aspect ratio and the full dimensions of each frame, preserving room boundaries and space below the artwork for captions. Painting scale is a curatorial display choice; image proportions follow the source reproduction.

| Module | Responsibility |
| --- | --- |
| `src/App.tsx` | Visitor interface, keyboard controls, story dialogs, accessibility, reading room, and opt-in room tone |
| `src/scene/scroll.ts` | GSAP playhead, ScrollTrigger setup, and ScrollToPlugin navigation |
| `src/scene/timeline.ts` | Deterministic route, viewing stops, responsive composition, information fades, and entrance timing |
| `src/scene/museum.ts` | Three.js renderer, camera updates, scene lifecycle, adaptive resolution, and render invalidation |
| `src/scene/architecture.ts` | Rooms, actual hinged doors, archways, benches, lights, and rotunda |
| `src/scene/materials.ts` | Original procedural stone, timber, and metal surface textures |
| `src/scene/paintings.ts` | Dimensional frames, artwork proportions, physical labels, lighting, and progressive image loading |
| `src/data/artworks.ts` | Editable catalogue, accessible descriptions, interpretation, reproduction rights, and museum sources |
| `scripts/check-timeline.mjs` | Executable route, clearance, determinism, and projection checks against the real TypeScript modules |

Repeated architectural elements use instancing. Small artwork thumbnails load first; full-resolution images are requested for the current and upcoming stops. Pixel density is limited on smaller devices and can decrease when sustained rendering cost is high. Idle scenes render sparingly, with explicit updates when artwork textures finish loading. The scene disposes of its geometry, materials, textures, renderer, and event listeners on exit.

## Artwork and credits

The collection includes *Mona Lisa*, *The Starry Night*, *Girl with a Pearl Earring*, *The Night Watch*, *The Birth of Venus*, *A Sunday on La Grande Jatte — 1884*, *The Scream*, and the Art Institute of Chicago's 1889 version of *The Bedroom*.

The exact source files, museum research links, reproduction rights, and image modifications are recorded in `public/artworks/CREDITS.md` and in the catalogue. Retain those credits when distributing the site. In particular, the reproduction of *The Scream* credits photographer Børre Høstland under Creative Commons Attribution 4.0; the other listed reproductions carry public-domain designations in their source records. The 1920-pixel images and 420-pixel thumbnails preserve their source aspect ratios. Historical artworks are not AI-generated.

This is an independent imagined exhibition; the original works remain in their respective collections, and no museum endorsement is implied.

## Executed validation

The following checks passed locally:

- `npm run check`: strict TypeScript compilation.
- `node scripts/check-timeline.mjs`: 100,005 route samples across 16:9, 4:3, square, 390×844, and 360×900 viewports.

The geometry check verifies finite poses, normalized quaternions, constant eye height, forward and reverse determinism, stationary viewing intervals, door-opening order, outer-wall limits, portal clearance, and walking clearance around bench footprints. It projects the actual outer frame corners into each tested viewport, checks that every complete frame fits, and verifies the mobile caption area remains clear.

The final run's maximum portal offset was 0.268 meters inside a portal with a 2.75-meter half-width. The largest absolute horizontal frame projection was 0.918 in normalized device coordinates, where the viewport edge is 1. Add `--details` to print per-artwork projection bounds. These checks establish mathematical route and framing properties; they do not measure frame rate or replace visual and interaction testing on target devices.

## Practical constraints and extension

The 3D view needs a WebGL2-capable browser and GPU. Rendering uses environment lighting, physically based materials, a limited dynamic-shadow budget, and soft contact-shadow textures; it does not use ray tracing. Frame rate depends on the device. The tested portrait aspect ratios extend down to 0.4; unusually narrow embedded viewports need additional composition review.

The tour is a guided route, without free-roaming collision physics or WebXR. The geometry checker covers the authored room and furniture layout. If you move walls, benches, portals, or artwork, update the route and its clearance checks together. Adding artworks requires extending both the catalogue and timeline stop arrays, then reviewing the corresponding room geometry.

Deploy `dist/` at an origin root with ordinary static-file hosting. Current asset URLs begin with `/`; hosting under a subdirectory requires updating the asset paths and Vite base configuration. This repository contains the source and local run instructions; deployment is a separate operation.
