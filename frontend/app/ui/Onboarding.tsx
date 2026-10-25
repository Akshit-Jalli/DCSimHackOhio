"use client";
// First-run walkthrough. Generic on purpose: no town names, no company names.
// The simulator is meant to run on any town, so the onboarding explains what
// kind of thing this is and how to read it — including which numbers are
// solid and which are our assumptions. Shown once (localStorage), reopenable
// from the ? button. Styled to match ui/Panels.tsx.
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { panel } from "./Panels";

const STORAGE_KEY = "dcsim.onboarded.v1";
const BLUE = "#1e88e5";
const MUTED = "#607d8b";
const SOLID = "#43a047";
const EST = "#f9a825";
const ASSUMED = "#e53935";

function readSeen(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // private mode / blocked storage: the walkthrough just shows again next time
  }
}

type Step = { title: string; body: ReactNode };

const h: CSSProperties = { fontSize: 20, fontWeight: 800, marginBottom: 10, lineHeight: 1.2 };
const p: CSSProperties = { fontSize: 14, lineHeight: 1.5, color: "#37474f", margin: "0 0 10px" };
const li: CSSProperties = { fontSize: 14, lineHeight: 1.45, color: "#37474f", margin: "0 0 7px" };

function Chip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color,
        background: color + "1a",
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: "1px 6px",
        marginRight: 8,
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

const STEPS: Step[] = [
  {
    title: "What you're about to do",
    body: (
      <>
        <p style={p}>
          This is a simulation of what a large data center does to a town over fifteen years — to its
          electricity bills, its schools, its water, its farmland, its noise, and its jobs.
        </p>
        <p style={p}>
          It is <b>not a prediction</b>. It is a model that shows the mechanisms and the trade-offs, with the
          uncertainty on every number visible.
        </p>
        <p style={p}>
          Some things feed back on each other. Higher bills build opposition that can stop expansion. Land
          speculation raises rents and pushes marginal farms out. You will see those loops close.
        </p>
      </>
    ),
  },
  {
    title: "Place a data center",
    body: (
      <>
        <p style={p}>
          Drag a size from the bar at the bottom of the screen onto the map. The lot snaps to the grid and
          can&apos;t sit on water or on top of existing buildings. Nothing runs until you press the green
          <b> ✓ Confirm</b>. Until then you are in build mode: move it, swap it, or cancel.
        </p>
        <p style={p}>
          Where you put it matters. The distance to the nearest home sets the noise level, and the land you
          take is real land with a real use.
        </p>
      </>
    ),
  },
  {
    title: "Set the deal terms",
    body: (
      <>
        <p style={p}>These are the things a town actually negotiates:</p>
        <ul style={{ paddingLeft: 18, margin: "0 0 10px" }}>
          <li style={li}>
            <b>Size</b> — more megawatts means more jobs, and more load on everything else.
          </li>
          <li style={li}>
            <b>Cooling</b> — evaporative cooling uses water; air cooling uses more electricity instead. There is
            no free option.
          </li>
          <li style={li}>
            <b>Water source</b> — the city&apos;s own system, or wells on the site.
          </li>
          <li style={li}>
            <b>Property-tax abatement</b> — the discount the developer asks for. It is also what the schools
            give up.
          </li>
        </ul>
        <p style={p}>
          Every lever here is a term from real agreements. <b>Advanced</b> opens the rest: PUE, cost per
          megawatt, the PILOT payment, and a few engine coefficients you can move within their published
          range.
        </p>
        <p style={p}>
          <b>Town data</b> (top left) is the other half: the town&apos;s own school, sewer, farm and grid
          numbers the model runs on. Wilmington&apos;s are verified. Any other town starts on defaults you
          can edit or autofill.
        </p>
      </>
    ),
  },
  {
    title: "Run the years",
    body: (
      <>
        <p style={p}>
          The slider walks through the build-out. Watch what arrives and what leaves: construction jobs come
          in waves and end. Permanent jobs are few. Tax effects wait for the abatement to expire.
        </p>
        <p style={p}>
          If opposition crosses a threshold, expansion stops. That comes out of the model, not a script —
          it is the town reacting to what the deal did to its bills.
        </p>
        <p style={p}>
          The side panel shows each number small. <b>Analytics</b> shows every one of them large, with its
          range over all fifteen years, the engine&apos;s internal ledgers, and a table you can copy.
        </p>
      </>
    ),
  },
  {
    title: "Read the numbers honestly",
    body: (
      <>
        <p style={p}>Not every number is equally solid.</p>
        <p style={li}>
          <Chip color={SOLID}>Solid</Chip>
          Electricity, emissions, and land use come from physics and published data. School funding is the
          state&apos;s own formula, checked against every district in the state.
        </p>
        <p style={li}>
          <Chip color={EST}>Estimated</Chip>
          Household bills come from a national study of towns that got data centers. Jobs come from
          independent legislative audits, not developer press releases.
        </p>
        <p style={li}>
          <Chip color={ASSUMED}>Assumed</Chip>
          Noise, water rates, and how strongly the town reacts are our judgment. The ranges on those
          numbers show how wide that judgment is.
        </p>
        <p style={{ ...p, marginTop: 12 }}>
          What it can&apos;t tell you: whether the developer would accept a different deal, or anything local
          that this town&apos;s baseline doesn&apos;t include.
        </p>
      </>
    ),
  },
];

export default function Onboarding() {
  // Lazy initialiser, not an effect: TownApp mounts this only after a
  // client-side fetch resolves, so it is never server-rendered and there is
  // no hydration to disagree with.
  const [open, setOpen] = useState(() => !readSeen());
  const [step, setStep] = useState(0);

  const close = useCallback(() => {
    writeSeen();
    setOpen(false);
    setStep(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const last = step === STEPS.length - 1;

  return (
    <>
      {/* Reopen button: above the scale bar, clear of the view cube. */}
      <button
        type="button"
        aria-label="How this simulation works"
        title="How this simulation works"
        onClick={() => { setStep(0); setOpen(true); }}
        style={{
          ...panel,
          bottom: 72,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          border: "none",
          fontWeight: 800,
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          onClick={close}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            background: "rgba(20,40,60,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...panel,
              position: "relative",
              width: 540,
              maxWidth: "100%",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              padding: "22px 24px 18px",
              background: "rgba(255,255,255,0.94)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>
              Step {step + 1} of {STEPS.length}
            </div>
            <h2 id="onboarding-title" style={h}>{STEPS[step].title}</h2>
            <div>{STEPS[step].body}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div style={{ display: "flex", gap: 6, flex: 1 }} aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    onClick={() => setStep(i)}
                    style={{
                      width: i === step ? 18 : 7,
                      height: 7,
                      borderRadius: 4,
                      background: i === step ? BLUE : "#cfd8dc",
                      cursor: "pointer",
                      transition: "width .15s",
                    }}
                  />
                ))}
              </div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cfd8dc", background: "white", color: "#37474f", fontWeight: 600, cursor: "pointer" }}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? close() : setStep((s) => s + 1))}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: BLUE, color: "white", fontWeight: 700, cursor: "pointer" }}
              >
                {last ? "Start" : "Next"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 10 }}>
              Esc to close · reopen any time with the ? button
            </div>
          </div>
        </div>
      )}
    </>
  );
}
