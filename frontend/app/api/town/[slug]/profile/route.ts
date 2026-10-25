import { WILMINGTON } from "@/app/sim/townProfile";

// GET /api/town/<slug>/profile -> { state: "ready", profile } | { state: "unavailable", message, needs }
//
// Autofill for an arbitrary town is Phase 1 of the intake plan: resolve the
// town to its keys (county FIPS, school district IRN, eGRID subregion,
// utility, NPDES permit), then fetch each required value from its source.
// None of those fetchers exist yet, and several need API keys or bulk files.
// So: Wilmington returns its verified profile; any other town returns an
// honest list of what the server would need, and the UI keeps the user on
// manual entry. This route must never invent numbers.
const NEEDS = [
  "Ohio DEW SFPR workbook cached on the server (school formula inputs by IRN)",
  "USDA NASS Quick Stats API key (farm count, cash rent)",
  "EPA ECHO lookup for the sewer plant serving the site (design and average flow)",
  "EPA eGRID ZIP-to-subregion table (marginal CO2 rate)",
  "EIA-861 service territory (utility and ownership type)",
];

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (slug === "wilmington-oh") {
    return Response.json({ state: "ready", profile: WILMINGTON });
  }
  return Response.json(
    {
      state: "unavailable",
      message: `No verified profile for "${slug}" yet.`,
      needs: NEEDS,
    },
    { status: 404 }
  );
}
