import { loadTown, type LatLon, type TownPick } from "@/lib/towns";

const isLatLon = (c: LatLon) => Number.isFinite(c?.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c?.lon) && Math.abs(c.lon) <= 180;

// POST /api/town/load with a search result -> starts the download (or finds it cached).
// Optional "center": load the area around that point instead of the town center (region picker).
// Returns right away; poll GET /api/town/<slug> for progress.
export async function POST(request: Request) {
  const p = (await request.json().catch(() => null)) as (TownPick & { center?: LatLon }) | null;
  const ok =
    p &&
    typeof p.name === "string" && p.name.length > 0 && p.name.length <= 100 &&
    typeof p.state === "string" && /^[A-Z]{2}$/.test(p.state) &&
    isLatLon(p) &&
    (p.center === undefined || isLatLon(p.center));
  if (!ok) return Response.json({ error: "Expected { name, state, county, lat, lon, center? }" }, { status: 400 });

  try {
    const pick = { name: p.name, state: p.state, county: p.county ?? null, lat: p.lat, lon: p.lon };
    const center = p.center && { lat: p.center.lat, lon: p.center.lon };
    const { slug } = loadTown(pick, center);
    return Response.json({ slug });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
