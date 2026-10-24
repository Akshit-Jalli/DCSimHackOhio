# Data Center Impact Simulator — Wilmington, Ohio

A negotiation tool for towns that haven't signed yet. Set the deal terms —
abatement, PILOT share, cooling type, tariff outcome — and watch fifteen years
of consequences diverge, with every number traceable to its formula and source.

Modeled on the real **$4B AWS proposal at 1488 S US 68, Wilmington** (Clinton
County, FIPS 39027). Not a hypothetical: Amazon already owns the parcel, and
four related rezoning referendums are on the **November 3, 2026 ballot**.

## Quick start

```bash
pip install numpy pyyaml
python engine/model.py          # 10,000 draws, ~80s
python engine/model.py 1000     # 1,000 draws, ~8s — same answer to <1%
python engine/validate.py       # validation suite, 20 checks
```

Writes `out/results.json` and `out/validation.json`.

The map front end is a separate lane:

```bash
cd frontend && npm install && npm run dev
```

## Layout

| Path | What it is |
|---|---|
| `PLAN.md` | **Read this first.** Full project plan, findings, open decisions |
| `VALIDATION.md` | What is validated, what is not, and why. Read before quoting accuracy |
| `ROADMAP.md` | The v0.8 → v1.0 gates, and what is deliberately out of scope |
| `data/baseline_wilmington.json` | Verified inputs, 13 sections, every value sourced |
| `data/coefficients.yaml` | The judgment layer — 46 coefficients, each with a source, method and confidence |
| `scenarios/aws_wilmington.json` | The real proposal plus lever ranges |
| `engine/model.py` | System-dynamics engine, 8 channels + 3 feedback loops, Monte Carlo |
| `engine/validate.py` | Four-tier validation suite |
| `out/results.json` | The output contract Lane B and Lane C build against |
| `out/validation.json` | The accuracy report, committed so it is readable without running the suite |
| `frontend/` | Next.js + deck.gl 3D map that consumes `out/results.json` |

## How it works

Three inputs, not one. `scenario.json` is what the user sets, `baseline.json`
is pulled per town, and `coefficients.yaml` is ~33 sourced judgment calls.
Only the middle one is really a download.

It is a **deterministic causal system-dynamics model**, not ML. There are maybe
thirty US towns with a hyperscale build *and* measured downstream effects —
n≈30 against ~100 features is fitting noise, and a black box would destroy the
provenance that is the whole point. Monte Carlo over coefficient bands gives
honest uncertainty; a tornado chart says which coefficient to research next.

## Two findings worth knowing before you read the code

**School state-aid loss saturates.** Wilmington City Schools has $679.74/pupil
of headroom before the 10% state funding floor binds — about **$326M of market
value**. A $4B campus is 12× past that, so the loss caps at **$1,348,238/yr and
is identical at $0.5B, $1B, $2B and $4B**. "Bigger is worse for schools" is
false beyond a threshold this town crossed long ago.

**The water that matters is upstream.** Direct site water is near zero under air
cooling. Indirect generation water is **~3,570 Mgal/year** — roughly 600× the
developer's own claimed site figure.

## Status

**Engine v1.0.** Eight channels plus three feedback loops, Monte Carlo over 46
coefficient bands, the counterfactual in the same call, three arms (tariff
holds / tariff fails / loops off), saturation curve, tornado on four targets,
`geo` for the map, `ledgers` for six household archetypes, the upstream gas
chain, and noise.

The feedback loops are what separate a simulation from a spreadsheet: land
speculation → cash rent → farm exit; ratepayer bill → political backlash →
moratorium; MW → sanitary load → sewer headroom. A moratorium is an **emergent
outcome, not an input** — it fires in ~27% of draws. Every loop gain is our own
assumption with a wide band, and they dominate the tornado, which is the model
correctly reporting what it does not know.

**Validation: 20/20 checks pass, 6/6 independent external replications** against
published Ohio DEW figures, worst relative error 2.1e-06. Read `VALIDATION.md`
before quoting any of that. It validates implementation and one module's formula
replication; it does **not** validate a 2041 forecast, and in Ohio the water
channel is unvalidatable because ODNR has zero data center visibility.

## A note on neutrality

This models a live, contested decision with a vote pending and litigation in
progress. The glass box is the neutrality mechanism. Findings here already cut
both ways — against the opposition (AWS's water draw is small; the city has
been buying 7 MGD it never half-used for thirty years) and against the
developer (a 30-year CRA for ~100 permanent jobs; AES is investor-owned, the
worst ratepayer bucket). A tool that only confirms one side is propaganda with
a chart on it.

Don't publish this framed as a verdict on the referendums. It's a method,
demonstrated on a real case.
