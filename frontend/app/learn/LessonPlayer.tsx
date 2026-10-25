"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadWilmington } from "../defaultTown";
import type { LessonControl, SceneEvent } from "../lessonControl";
import { setTown, type TownInfo } from "../mapConfig";
import Scene from "../Scene";
import { LoadingScreen } from "../ui/LoadingScreen";
import { BANDS, textFor, type Band, type GuideInfo, type Lesson, type Step } from "./content";
import { Guide } from "./Guide";
import { updateModule, useProfile } from "./progress";
import { SpeechBubble } from "./SpeechBubble";
import { bigButton, FONT } from "./ui";

// Runs a lesson's steps on top of the 3D scene (always Wilmington).
// Grade band and guide come from the student's profile; ?band=K-2 overrides the band for testing.
export default function LessonPlayer({ lesson, guides }: { lesson: Lesson; guides: GuideInfo[] }) {
  const router = useRouter();
  const profile = useProfile();
  const [town, setTownState] = useState<TownInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(1); // counts step changes, so returning to a step flies again
  const [bandOverride, setBandOverride] = useState<Band | null>(null);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("band") as Band | null;
    if (b && BANDS.includes(b)) setBandOverride(b); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the URL
    loadWilmington().then(({ town, fromPublic }) => {
      setTown(town, fromPublic);
      setTownState(town);
    });
  }, []);

  // No student on this computer yet: onboarding first
  useEffect(() => {
    if (profile === null) router.replace("/learn");
  }, [profile, router]);

  // Pick up where the student left off (a finished lesson starts over)
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !profile) return;
    resumed.current = true;
    const saved = profile.modules[lesson.id];
    if (saved && !saved.done && saved.step > 0) {
      setIndex(Math.min(saved.step, lesson.steps.length - 1)); // eslint-disable-line react-hooks/set-state-in-effect -- once, when saved progress is first read
      setVisit((v) => v + 1);
    }
  }, [profile, lesson]);

  const band: Band = bandOverride ?? profile?.band ?? "3-5";
  const guide = guides.find((g) => g.id === profile?.guide) ?? guides[0];
  const step: Step = lesson.steps[index];
  const last = index === lesson.steps.length - 1;

  function go(to: number) {
    const next = Math.max(0, Math.min(lesson.steps.length - 1, to));
    setIndex(next);
    setVisit((v) => v + 1);
    updateModule(lesson.id, { step: next });
  }

  function finish() {
    updateModule(lesson.id, { step: index, done: true });
    router.push("/learn");
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

  if (!town || !profile) return <LoadingScreen visible title="Loading" />;

  return (
    <>
      <Scene town={town} lesson={control} />

      {/* Back to the module map */}
      <Link href="/learn" style={{ ...bigButton("plain"), position: "fixed", top: 16, right: 16, zIndex: 20, minHeight: 52, fontSize: 18, border: "none", boxShadow: "0 4px 14px rgba(20,40,60,0.2)" }}>
        ← Map
      </Link>

      {mapReady && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 20,
            display: "flex",
            gap: 26, // room for the bubble's tail
            alignItems: "flex-end",
            fontFamily: FONT,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Guide id={guide.id} name={guide.name} mood={step.mood ?? "happy"} talking={talking} size={104} />
            <span style={{ background: guide.color, color: "#fff", fontWeight: 800, fontSize: 16, borderRadius: 10, padding: "2px 10px", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{guide.name}</span>
          </div>

          <SpeechBubble
            text={textFor(step.text, band)}
            band={band}
            stepKey={String(visit)}
            onTyping={setTalking}
            footer={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#78909c", flex: 1, minWidth: 48 }}>
                  {index + 1} / {lesson.steps.length}
                </span>
                {index > 0 && (
                  <button onClick={() => go(index - 1)} style={btn(false)}>
                    ← Back
                  </button>
                )}
                {last ? (
                  <button onClick={finish} style={btn(true)}>
                    Finish ✓
                  </button>
                ) : (
                  <button onClick={() => go(index + 1)} style={btn(true)} autoFocus>
                    Next →
                  </button>
                )}
              </div>
            }
          />
        </div>
      )}
    </>
  );
}

// Big, easy-to-hit buttons (a bit smaller than the map's so the bubble stays compact)
function btn(primary: boolean): React.CSSProperties {
  return { ...bigButton(primary ? "primary" : "plain"), minHeight: 52, minWidth: 110, padding: "0 22px", fontSize: 19, borderRadius: 16, borderWidth: primary ? 0 : 2 };
}
