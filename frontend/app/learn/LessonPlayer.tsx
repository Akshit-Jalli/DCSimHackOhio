"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadWilmington } from "../defaultTown";
import type { LessonControl, SceneEvent } from "../lessonControl";
import { setTown, type TownInfo } from "../mapConfig";
import Scene from "../Scene";
import { LoadingScreen } from "../ui/LoadingScreen";
import { BANDS, textFor, type Band, type Lesson, type Step } from "./content";

const FONT = "var(--font-geist-sans), system-ui, sans-serif";
// Bigger text for younger readers
const TEXT_SIZE: Record<Band, number> = { "K-2": 26, "3-5": 23, "6-8": 21, "9-12": 20 };

// Runs a lesson's steps on top of the 3D scene (always Wilmington).
// Step (a): talk and look steps. The grade band comes from ?band= until onboarding exists.
export default function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [town, setTownState] = useState<TownInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(1); // counts step changes, so returning to a step flies again
  const [band, setBand] = useState<Band>("3-5");

  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("band") as Band | null;
    if (b && BANDS.includes(b)) setBand(b); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the URL
    loadWilmington().then(({ town, fromPublic }) => {
      setTown(town, fromPublic);
      setTownState(town);
    });
  }, []);

  const step: Step = lesson.steps[index];
  const last = index === lesson.steps.length - 1;

  function go(to: number) {
    setIndex(Math.max(0, Math.min(lesson.steps.length - 1, to)));
    setVisit((v) => v + 1);
  }

  // What this step asks the 3D scene to do
  const control: LessonControl = useMemo(() => {
    const fly = step.type === "look" ? step.target : step.fly;
    const landmark = step.landmark ?? (step.type === "look" && typeof step.target === "string" && !["home", "datacenter", "loudzone"].includes(step.target) ? step.target : undefined);
    return {
      fly: fly ? { id: visit, target: fly } : undefined,
      lockCamera: step.type === "look" ? step.lockCamera : false,
      presets: [], // building comes with "do" steps
      showYear: false,
      showSettings: false,
      startYear: lesson.startYear,
      highlightMetric: step.type === "look" ? step.highlight ?? null : null,
      highlightLandmark: (landmark as LessonControl["highlightLandmark"]) ?? null,
      onEvent: (e: SceneEvent) => {
        if (e.type === "loaded") setMapReady(true);
      },
    };
  }, [step, visit, lesson.startYear]);

  if (!town) return <LoadingScreen visible title="Loading" />;

  return (
    <>
      <Scene town={town} lesson={control} />

      {/* Back to the module map */}
      <Link
        href="/learn"
        style={{ position: "fixed", top: 16, right: 16, zIndex: 20, background: "white", color: "#263238", borderRadius: 14, padding: "12px 18px", fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 4px 14px rgba(20,40,60,0.2)", fontFamily: FONT }}
      >
        ← Map
      </Link>

      {mapReady && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            width: "min(760px, calc(100vw - 32px))",
            zIndex: 20,
            display: "flex",
            gap: 14,
            alignItems: "flex-end",
            fontFamily: FONT,
          }}
        >
          {/* Guide placeholder: the real guide characters come with onboarding */}
          <div aria-hidden style={{ width: 84, height: 84, flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg, #1e88e5, #43a047)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
            {step.mood === "wow" ? "😮" : step.mood === "thinking" ? "🤔" : "😊"}
          </div>

          {/* Speech bubble */}
          <div style={{ flex: 1, background: "white", borderRadius: 22, padding: "18px 20px 14px", boxShadow: "0 8px 30px rgba(20,40,60,0.25)", color: "#263238" }}>
            <p style={{ margin: 0, fontSize: TEXT_SIZE[band], lineHeight: 1.4 }}>{textFor(step.text, band)}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <span style={{ fontSize: 14, color: "#78909c", flex: 1 }}>
                {index + 1} / {lesson.steps.length}
              </span>
              {index > 0 && (
                <button onClick={() => go(index - 1)} style={btn(false)}>
                  ← Back
                </button>
              )}
              {last ? (
                <Link href="/learn" style={{ ...btn(true), textDecoration: "none" }}>
                  Finish ✓
                </Link>
              ) : (
                <button onClick={() => go(index + 1)} style={btn(true)} autoFocus>
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Big, easy-to-hit buttons
function btn(primary: boolean): React.CSSProperties {
  return {
    minHeight: 52,
    minWidth: 110,
    padding: "0 22px",
    borderRadius: 16,
    border: primary ? "none" : "2px solid #cfd8dc",
    background: primary ? "#1e88e5" : "white",
    color: primary ? "white" : "#263238",
    fontSize: 19,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
