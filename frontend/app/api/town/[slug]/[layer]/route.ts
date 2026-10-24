import fs from "node:fs/promises";
import path from "node:path";
import { isValidSlug, LAYERS, townDir } from "@/lib/towns";

// GET /api/town/<slug>/<layer> -> that town's shrunk GeoJSON (buildings, roads, ...)
export async function GET(_req: Request, ctx: RouteContext<"/api/town/[slug]/[layer]">) {
  const { slug, layer } = await ctx.params;
  if (!isValidSlug(slug) || !(layer in LAYERS)) return new Response("Not found", { status: 404 });
  try {
    const body = await fs.readFile(path.join(townDir(slug), `${layer}.geojson`));
    return new Response(body, { headers: { "Content-Type": "application/geo+json" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
