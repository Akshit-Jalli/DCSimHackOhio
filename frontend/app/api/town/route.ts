import { listTowns } from "@/lib/towns";

// GET /api/town -> towns already downloaded (open instantly)
export async function GET() {
  return Response.json({ towns: await listTowns() });
}
