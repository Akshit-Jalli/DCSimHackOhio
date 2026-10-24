import { isValidSlug, townStatus } from "@/lib/towns";

// GET /api/town/<slug> -> { state: "ready", town } | "loading" (with progress) | "error" | "missing"
export async function GET(_req: Request, ctx: RouteContext<"/api/town/[slug]">) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return Response.json({ state: "missing" }, { status: 404 });
  const status = await townStatus(slug);
  return Response.json(status, { status: status.state === "missing" ? 404 : 200 });
}
