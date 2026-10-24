import { loadTown, type TownPick } from "@/lib/towns";

// POST /api/town/load with a search result -> starts the download (or finds it cached).
// Returns right away; poll GET /api/town/<slug> for progress.
export async function POST(request: Request) {
  const p = (await request.json().catch(() => null)) as TownPick | null;
  const ok =
    p &&
    typeof p.name === "string" && p.name.length > 0 && p.name.length <= 100 &&
    typeof p.state === "string" && /^[A-Z]{2}$/.test(p.state) &&
    Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
  if (!ok) return Response.json({ error: "Expected { name, state, county, lat, lon }" }, { status: 400 });

  const { slug } = loadTown({ name: p.name, state: p.state, county: p.county ?? null, lat: p.lat, lon: p.lon });
  return Response.json({ slug });
}
