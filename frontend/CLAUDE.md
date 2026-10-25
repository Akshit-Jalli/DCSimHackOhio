# DCSim frontend: 3D data center impact map

Hackathon project (HackOhio). Users drop a data center onto a 3D model of a real town and see its impacts on water, power bills, schools/taxes, noise, land, and jobs over 2026 to 2041.
Owner of this folder: dk (3D map / frontend). Teammates own the Python simulation engine and data.
dk prefers plain-language explanations, short answers, and direct step-by-step instructions while on a deadline. He is learning JS/Three.js; briefly say what changed and why.

## Stack
- Next.js 16 (App Router, TypeScript, Turbopack) + React 19
- three 0.186, @react-three/fiber 9, @react-three/drei 10
- Run: `npm run dev` in this folder. http://localhost:3000 is the landing page; the 3D simulator is at http://localhost:3000/simulate (`?town=<slug>` works there).
- Windows machine (cmd). Python 3.14 with the `overturemaps` package is installed (run it as `python -m overturemaps`). The town download calls it.
- Node 24 runs `scripts/precache.ts` directly (TypeScript type stripping). Code shared with it (`lib/towns.ts`) must stay plain TS: no enums, imports with `.ts` extensions.
- AGENTS.md says this Next.js version has breaking changes: check `node_modules/next/dist/docs/` before using Next APIs.
- Source files use CRLF line endings. Read Python-written files as UTF-8 explicitly (Windows Python defaults to cp1252).

## Setup (once per clone)
1. `frontend/.env.local` (not committed): `NOMINATIM_CONTACT=<your email>`. Town search needs it (Nominatim usage policy).
2. `npm run precache` downloads the demo towns (Wilmington, New Albany, Athens, all OH) into `data/towns/` (not committed, ~10-25 MB per town). `npm run precache -- "Dayton, OH"` adds others; `-- "Athens, OH@39.35,-82.05"` adds an area of a town centered on lat,lon.
3. Without step 2, Wilmington still loads from the committed `public/*.geojson` fallback.

## Any town: how it works
- User clicks the town name in the header (`ui/TownSearch.tsx`). "Ready" lists cached towns (instant). Typing searches Nominatim (US cities/towns/villages only, 600 ms debounce).
- Picking a new town: `POST /api/town/load` starts the download, `TownApp.tsx` polls `GET /api/town/<slug>` and shows layer-by-layer progress (`ui/LoadingScreen.tsx`). New towns take ~15-30 s.
- Ready: `setTown()` in `mapConfig.tsx` sets the map center and data URLs, then `<Scene key={slug}>` remounts so nothing from the old town is left over. URL becomes `?town=<slug>`.
- Region picker (`ui/RegionPicker.tsx`, Leaflet + OSM standard tiles):
  - Picking a new search result, or "Pick another area of X" in the town menu, opens a flat map with a draggable 14.25 km square (or click the map to move it).
  - The square can go at most 40 km from the town. Green dashed squares are areas already downloaded (click = open).
  - Generate sends `center` to `POST /api/town/load`.
  - "Ready" towns in the menu still open directly (demo towns stay instant).
  - OSM tile policy: keep the attribution, no pre-fetching or bulk downloads. Fine for the hackathon; a public launch with real traffic should switch to e.g. OpenFreeMap.
- Areas: an area within 250 m of the town's point is the town's default map (`athens-oh`). Others get their own cache entry with the center rounded to 0.001° in the slug (`athens-oh-39350n82050w`).
  - In `town.json`, `lat/lon` = map center and `townLat/townLon` = the town's point; the header shows the offset ("Athens, OH · 4.2 km NE").
  - `countyFips` is looked up at the map center, so an area across a county line sends that county (e.g. NE of Wilmington = 39047 Fayette).
- Server side (`lib/towns.ts`):
  - Search: Nominatim with a User-Agent from `NOMINATIM_CONTACT`, max 1 request/1.1 s per process, results cached in memory.
  - County FIPS from the FCC Census API (`geo.fcc.gov/api/census/area`).
  - Download: the 6 Overture layers in parallel for a 14.25 km box around the town center, into `data/towns/<slug>/raw/`.
  - Shrink: keep only the fields the map uses, round coordinates to 6 decimals, sort buildings biggest first. 63 MB -> 22 MB for New Albany.
  - `town.json` is written last. A folder without it is an unfinished download and resumes. To re-shrink after changing the kept fields, delete `town.json` and rerun precache (raw files are kept).
- API routes (`app/api/town/`): `GET /api/town` (cached list), `GET /api/town/search?q=`, `POST /api/town/load`, `GET /api/town/<slug>` (ready / loading with layers done / error / missing), `GET /api/town/<slug>/<layer>` (buildings, landcover, roads, water, places, infrastructure).

## K-12 learning (/learn)
Pivot: K-12 ed tech. No accounts; everything stays in the browser.
- `/learn`: onboarding (first name, grade band K-2/3-5/6-8/9-12, pick a guide), then the module map (level select; each module unlocks when the previous is done). "📋 For teachers" shows goal, minutes and NGSS per band. "📄 My work" = printable page of guesses, votes and written answers.
- `/learn/<module>`: lesson player on top of the 3D scene, always Wilmington. Step types: talk, look, predict, do (place / year), check, reflect (vote / short). Read-aloud uses on-device voices only (auto for K-2).
- `/learn/build`: Free Build in kid mode (only ready towns, no town search or area picker). `/simulate` is unchanged.
- Content is data: `content/modules.json`, `content/guides.json`, `content/lessons/<id>.json`. How to write lessons: `content/README.md`. Run `npm run check-lessons` after editing.
- Numbers rule: lesson facts are only worked out from the data center's size (`app/learn/facts.ts`, homes assume full power all year) with the per-home figure and its source in the lesson file. Anything from the fake engine is labeled "rough estimate"; pin badges are off in lessons.
- Scene control: `app/lessonControl.ts` (camera fly targets, lock camera, allowed presets, panels, highlights, "Build here!" suggestion, events back to the lesson). Without a `lesson` prop Scene is the normal simulator.
- Progress: `app/learn/progress.ts`, one localStorage key `dcsim-learn-v1` (memory fallback if storage is blocked).
- To verify with a teacher: NGSS picks in modules.json; EIA 10,791 kWh/home (2022) in module-1.json.

## Scale and coordinates (keep these)
- 1 scene unit = 1 meter. x = east, z = south (north is -z), y = up.
- Map center (0,0) = the current town's center (`LAT0/LON0`, set by `setTown()`). `toXY()` / `toLatLon()` in `app/mapConfig.tsx` convert. Wilmington's center is downtown (39.43611, -83.81389).
- Grid: 1 tile = 285 m = 20 acres. Map = 50 x 50 tiles (about 14.25 km square). `MAP_HALF_M` in `lib/towns.ts` must match `MAP_HALF`.
- Building heights are exaggerated x3 (`HEIGHT_SCALE`); footprints are real. Terrain is NOT modeled (hilly towns like Athens look flat).
- At most 25,000 buildings are drawn (biggest first). ALL buildings still count for the loud zone and "can't build here" tiles.
- Data center presets: Enterprise 60 MW / 2x2 tiles, Hyperscale 250 MW / 4x4, AI campus 1000 MW / 6x6. A data hall = 62.5 MW.

## Files (app/)
- `page.tsx` + `_landing/`: landing page (from the teammates' `landing-page` branch). `terms/`, `privacy/`: legal pages. Landing images in `public/landing/`.
- `simulate/page.tsx`: the simulator route; renders `TownApp`.
- `TownApp.tsx`: picks the town (URL, search), downloads/polls, shows the loading screen, mounts `Scene`.
- `Scene.tsx`: main screen. Canvas, sky, lights, day/night, drag-and-drop, placement rules, builds the engine input, all UI wiring.
- `mapConfig.tsx`: town center, `setTown()`, `layerUrl()`, grid, `toXY` / `toLatLon`, edge clipping planes.
- `MapLayers.tsx`: land cover, water, roads, "can't build here" tiles, tree scatter points.
- `Buildings.tsx`: buildings merged into one mesh; shader does red noise-zone tint, hides buildings under the lot, lit windows at night.
- `Trees.tsx`: instanced low-poly trees in forest areas.
- `DataCenter.tsx`: code-built data halls (no external model), construction phase (steel frames + cranes), pop-in and drop animations, night glow.
- `Landmarks.tsx`: pins picked from the town's places data (schools, colleges, hospitals, fire, police, city hall, water plant), water towers, power lines, substations, dashed "new power line" to nearest substation.
  - Rules: by Overture `basic_category`, plus name checks where the data is noisy (clinics tagged "hospital").
  - Same-kind pins close together merge, with a max per kind.
  - Colleges listed only as departments get one pin named after the shared prefix ("Wilmington College", "Ohio University").
- `labels.tsx`: floating HTML labels positioned each frame by `LabelProjector` (we replaced drei `<Html>` because it logged React 19 unmount errors).
- `night.ts`: shared day/night value read inside `useFrame`.
- `sim/types.ts`: engine input/output types (match the team's JSON spec). `sim/presets.ts`: presets and phases. `sim/fakeEngine.ts`: PLACEHOLDER formulas. All numbers shown are demo numbers until the real engine is connected; the UI says so.
- `ui/Panels.tsx`: build menu, settings panel, impacts panel (animated numbers + sparklines), year slider. `ui/TownSearch.tsx`, `ui/LoadingScreen.tsx`: see above.
- `lib/towns.ts`, `scripts/precache.ts`: server side, see "Any town".

## Engine contract
- Input (`SimInput`): site (fips_county, lat, lon, acres, prior_land_use...), facility (it_load_mw, pue, cooling, water_source, capex, phases...), policy (abatement, PILOT, setback...), horizon 2026-2041. `fips_county` comes from the town (`town.countyFips`, e.g. Wilmington 39027 Clinton, New Albany 39049 Franklin, Athens 39009).
- Output: one `YearResult` per year. Swap `runSimulation()` in `sim/fakeEngine.ts` for a call to the real engine. Plan: call it on drop / settings change (not on every mouse move) and show "calculating...".
- Open issue: moving the data center only changes location-based outputs. Ask the engine team which outputs use location (noise, land, school district, distance to substation, water source).
- Open issue: per-town engine inputs. `fakeEngine` constants (water system capacity, school enrollment, tax rate) are Wilmington guesses, so other towns show "Demo numbers (Wilmington defaults)". dk is asking the data team for per-town inputs.

## Data licensing
Overture/OpenStreetMap data needs attribution ("© OpenStreetMap contributors, Overture Maps"). It is shown in the town search box. Keep it visible if that UI changes.

## Not wired yet
- `public/models/transmission_tower.glb` (Meshy model, simplified from 1.5M to ~10k triangles) is NOT wired in yet. It is meant to replace the gray box pylons at the real `power_tower` points in each town's infrastructure layer, rotated along the nearest power line, with wires at about 84% of tower height. Use one InstancedMesh.
- `public/models/utica_gas_well_pad.glb` (simplified to ~47k triangles) must NOT be placed in town as if it were real. There are no Utica gas wells in any of these towns (Wilmington, New Albany, Athens, Marysville). Ohio's Utica wells are in eastern Ohio, e.g. Belmont County. The real gas infrastructure on these maps is underground pipelines (infrastructure class `pipeline`, e.g. the Rockies Express Pipeline near Wilmington). Decision pending with dk: show the pad on an off-map island labeled with its real location, place it at an address dk provides, or drop it.
- Meshy models must be simplified before use (originals were 70-100 MB). `npx @gltf-transform/cli` weld, simplify, resize, jpeg works.

## Known data gaps
- Some pin names come straight from the data and read oddly ("Wilmington Fire Chief" = the fire station). Names show on hover only.
- Water plant pins are found by name, so towns that buy water from elsewhere (New Albany uses Columbus) may have none.
