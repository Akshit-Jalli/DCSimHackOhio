import type { TownInfo } from "./mapConfig";

export const DEFAULT_TOWN = "wilmington-oh";

// Downtown Wilmington, matching the files committed in public/
const WILMINGTON_FALLBACK: TownInfo = { slug: "wilmington-oh", name: "Wilmington", state: "OH", county: "Clinton County", countyFips: "39027", lat: 39.43611, lon: -83.81389 };

// Wilmington always works: from the town cache, or from public/ on a fresh clone (fromPublic = true).
// Pass the result to setTown(town, fromPublic).
export async function loadWilmington(): Promise<{ town: TownInfo; fromPublic: boolean }> {
  try {
    const s = await fetch(`/api/town/${DEFAULT_TOWN}`).then((r) => r.json());
    if (s.state === "ready") return { town: s.town, fromPublic: false };
  } catch {
    // API down: fall through to public/
  }
  return { town: WILMINGTON_FALLBACK, fromPublic: true };
}
