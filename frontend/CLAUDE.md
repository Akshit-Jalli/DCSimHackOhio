# DCSim frontend: 3D data center impact map

Hackathon project (HackOhio). Users drop a data center onto a 3D model of a real town and see its impacts on water, power bills, schools/taxes, noise, land, and jobs over 2026 to 2041.
Owner of this folder: dk (3D map / frontend). Teammates own the Python simulation engine and data.
dk prefers plain-language explanations, short answers, and direct step-by-step instructions while on a deadline. He is learning JS/Three.js; briefly say what changed and why.

## Stack
- Next.js 16 (App Router, TypeScript, Turbopack) + React 19
- three 0.186, @react-three/fiber 9, @react-three/drei 10
- Run: `npm run dev` in this folder, open http://localhost:3000
- Windows machine (cmd). Python 3.14 with the `overturemaps` package is installed (run it as `python -m overturemaps`).
- AGENTS.md says this Next.js version has breaking changes: check `node_modules/next/dist/docs/` before using Next APIs.

## Scale and coordinates (keep these)
- 1 scene unit = 1 meter. x = east, z = south (north is -z), y = up.
- Map center (0,0) = downtown Wilmington, OH (39.43611, -83.81389). `toXY()` in `app/mapConfig.tsx` converts lon/lat to meters.
- Grid: 1 tile = 285 m = 20 acres. Map = 50 x 50 tiles (about 14.25 km square).
- Building heights are exaggerated x3 (`HEIGHT_SCALE`); footprints are real.
- Data center presets: Enterprise 60 MW / 2x2 tiles, Hyperscale 250 MW / 4x4, AI campus 1000 MW / 6x6. A data hall = 62.5 MW.

## Files (app/)
- `Scene.tsx`: main screen. Canvas, sky, lights, day/night, drag-and-drop, placement rules, builds the engine input, all UI wiring.
- `mapConfig.tsx`: center point, grid, `toXY` / `toLatLon`, edge clipping planes.
- `MapLayers.tsx`: land cover, water, roads (from GeoJSON), "can't build here" tiles, tree scatter points.
- `Buildings.tsx`: all buildings merged into one mesh; shader does red noise-zone tint, hides buildings under the lot, lit windows at night.
- `Trees.tsx`: instanced low-poly trees in forest areas.
- `DataCenter.tsx`: code-built data halls (no external model), construction phase (steel frames + cranes), pop-in and drop animations, night glow.
- `Landmarks.tsx`: schools/hospital/etc. pins (currently a hand-picked Wilmington list), water towers, power lines, substations, dashed "new power line" to nearest substation.
- `labels.tsx`: floating HTML labels positioned each frame by `LabelProjector` (we replaced drei `<Html>` because it logged React 19 unmount errors).
- `night.ts`: shared day/night value read inside `useFrame`.
- `sim/types.ts`: engine input/output types (match the team's JSON spec). `sim/presets.ts`: presets and phases. `sim/fakeEngine.ts`: PLACEHOLDER formulas. All numbers shown are demo numbers until the real engine is connected; the UI says so.
- `ui/Panels.tsx`: build menu, settings panel, impacts panel (animated numbers + sparklines), year slider.

## Data (public/)
Downloaded from Overture Maps for the Wilmington bounding box (west,south,east,north = -83.897,39.372,-83.731,39.500):
`buildings.geojson`, `landcover.geojson`, `roads.geojson`, `water.geojson`, `places.geojson`, `infrastructure.geojson`.
Command pattern: `python -m overturemaps download --bbox=W,S,E,N -f geojson --type=<building|land_cover|segment|water|place|infrastructure> -o <file>`.
Overpass (overpass-turbo) was unreliable (502s/timeouts), which is why we use Overture.

## Engine contract
- Input (`SimInput`): site (fips_county, lat, lon, acres, prior_land_use...), facility (it_load_mw, pue, cooling, water_source, capex, phases...), policy (abatement, PILOT, setback...), horizon 2026-2041. County FIPS for Wilmington is 39027 (Clinton). The team's example JSON had 39089 (Licking) by mistake.
- Output: one `YearResult` per year. Swap `runSimulation()` in `sim/fakeEngine.ts` for a call to the real engine. Plan: call it on drop / settings change (not on every mouse move) and show "calculating...".
- Open issue: moving the data center only changes location-based outputs. Ask the engine team which outputs use location (noise, land, school district, distance to substation, water source).

## Not wired yet
- `public/models/transmission_tower.glb` (Meshy model, simplified from 1.5M to ~10k triangles): meant to replace the gray box pylons at the 73 real `power_tower` points in `infrastructure.geojson`, rotated along the nearest power line, with wires at about 84% of tower height. Use one InstancedMesh.
- `public/models/utica_gas_well_pad.glb` (simplified to ~47k triangles): there are NO Utica gas wells in Wilmington/Clinton County (they are in eastern Ohio, e.g. Belmont County, ~260 km east). The real gas infrastructure on this map is underground pipelines incl. the Rockies Express Pipeline (in infrastructure.geojson, class `pipeline`). Decision pending with dk: show the pad on an off-map island labeled with its real location, place it at an address dk provides, or drop it. Do not place it in town as if it were real.
- Meshy models must be simplified before use (originals were 70-100 MB). `npx @gltf-transform/cli` weld, simplify, resize, jpeg works.

## NEXT TASK: make it work for any town
Goal: user types a town name and gets the same 3D map for that town.

What is Wilmington-specific today:
1. `LAT0/LON0` in mapConfig (map center) and the bounding box used for downloads.
2. Static GeoJSON files in public/ (one town only).
3. Hand-picked `PLACES` list in Landmarks.tsx (replace with a category filter on places.geojson: schools, hospital, fire, police, city hall, water treatment).
4. Text: "Wilmington, Ohio" header, loading screen, tab title, fips_county "39027".
5. Placeholder constants in fakeEngine (water system capacity, school enrollment, tax rate) are Wilmington guesses.

Suggested approach (check with dk before building):
- Small backend (the team already uses Python): `GET /api/town?q=<name>` geocodes the town (e.g. Nominatim), builds a bbox around it, runs the 6 Overture downloads, caches them per town on disk, returns the files. First load of a new town can take 1-3 minutes, so: show progress, and PRE-CACHE the towns used in the live demo so the demo never waits on downloads.
- Frontend: make the center point and data URLs come from the selected town instead of constants; everything else already works in local meters.
- Also get county FIPS for the town (e.g. Census geocoder) and pass it to the engine.
- Biggest risk is not the map: the engine needs per-town inputs (water system, schools, tax rates). Make sure the data team has a plan, or "any town" will show Wilmington numbers on another town's map.
- Alternative if downloads are too slow: vector tiles in the browser (e.g. OpenFreeMap/Protomaps), which load any town instantly but need new parsing code.
