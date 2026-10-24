// Download towns ahead of time so the live demo never waits.
//   npm run precache                      -> the demo towns below
//   npm run precache -- "Dayton, OH" ...  -> any towns (first search result is used)
// Re-shrink a cached town (e.g. after changing what we keep): delete data/towns/<slug>/town.json and rerun.
import { loadTown, searchTowns, type TownPick } from "../lib/towns.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: search will explain what to set
}

// Wilmington keeps the hand-picked downtown center the map was designed around
const DEMO: (string | TownPick)[] = [
  { name: "Wilmington", state: "OH", county: "Clinton County", lat: 39.43611, lon: -83.81389 },
  "New Albany, OH",
  "Athens, OH",
];

const args = process.argv.slice(2);
for (const item of args.length ? args : DEMO) {
  const start = Date.now();
  let pick: TownPick | undefined;
  if (typeof item === "string") {
    pick = (await searchTowns(item))[0];
    if (!pick) {
      console.log(`✗ ${item}: no US town found`);
      continue;
    }
  } else {
    pick = item;
  }
  const label = `${pick.name}, ${pick.state}`;
  try {
    const town = await loadTown(pick).promise;
    console.log(`✓ ${label} -> data/towns/${town.slug} (FIPS ${town.countyFips}) in ${((Date.now() - start) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.log(`✗ ${label}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
