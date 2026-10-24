import { searchTowns } from "@/lib/towns";

// GET /api/town/search?q=athens -> up to 5 US towns to pick from
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json({ results: await searchTowns(q) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
