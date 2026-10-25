"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadWilmington } from "../defaultTown";
import type { FlyTarget, LessonControl, SceneEvent } from "../lessonControl";
import { setTown, type TownInfo } from "../mapConfig";
import Scene from "../Scene";
import { PRESETS } from "../sim/presets";
import { LoadingScreen } from "../ui/LoadingScreen";
import { BANDS, textFor, type Band, type Choice, type GuideInfo, type Lesson, type Mood, type Step } from "./content";
import { FactCard } from "./FactCard";
import { factsFor, factVars, fill } from "./facts";
import { Guide } from "./Guide";
import { saveAnswer, updateModule, useProfile } from "./progress";
import { useSpeech } from "./speech";
import { SpeechBubble } from "./SpeechBubble";
import { bigButton, FONT, INK, Modal } from "./ui";

const PIN_KINDS = ["school", "college", "hospital", "fire", "police", "cityhall", "water", "water_tower", "substation"];
const LETTERS = "ABCDEFGH";

// Runs a lesson's steps on top of the 3D scene (always Wilmington).
// Grade band and guide come from the student's profile; ?band=K-2 overrides the band for testing.
export default function LessonPlayer({ lesson, guides }: { lesson: Lesson; guides: GuideInfo[] }) {
  const router = useRouter();
  const profile = useProfile();
  const speech = useSpeech();
  const [town, setTownState] = useState<TownInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(1); // counts step changes, so returning to a step flies again
  const [bandOverride, setBandOverride] = useState<Band | null>(null);
  const [talking, setTalking] = useState(false);
  // What the student has done in the 3D scene (from Scene events)
  const [placed, setPlaced] = useState<{ preset: string; mw: number } | null>(null);
  const [year, setYear] = useState(lesson.startYear ?? 2031);
  // Property tax break: the first value seen, and whether the student has moved it since
  const [abatement, setAbatement] = useState<{ start: number | null; changed: boolean }>({ start: null, changed: false });
  const [bottomSpace, setBottomSpace] = useState(0); // height of the build menu / year bar
  const [finished, setFinished] = useState(false);

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

  const band: Band = bandOverride ?? profile?.band ?? "3-5";
  const guide = guides.find((g) => g.id === profile?.guide) ?? guides[0];
  // Steps for this grade band only
  const steps = useMemo(() => lesson.steps.filter((s) => !s.bands || s.bands.includes(band)), [lesson, band]);
  const step: Step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const answers = profile?.modules[lesson.id]?.answers ?? {};

  // Pick up where the student left off (a finished lesson starts over). Steps after a "do" step
  // need the data center on the map, so resuming never skips past the first "do" step.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !profile) return;
    resumed.current = true;
    const saved = profile.modules[lesson.id];
    if (!saved || saved.done || saved.step <= 0) return;
    const firstDo = steps.findIndex((s) => s.type === "do");
    const at = Math.min(saved.step, steps.length - 1, firstDo >= 0 ? firstDo : Infinity);
    setIndex(at); // eslint-disable-line react-hooks/set-state-in-effect -- once, when saved progress is first read
    setVisit((v) => v + 1);
  }, [profile, lesson, steps]);

  // Facts from the data center's size: the placed one, or the one the lesson will ask for
  const placeStep = steps.find((s) => s.type === "do" && s.action === "place");
  const lessonPreset = placeStep && placeStep.type === "do" && placeStep.action === "place" ? placeStep.preset ?? "enterprise" : "enterprise";
  const preset = PRESETS.find((p) => p.id === (placed?.preset ?? lessonPreset)) ?? PRESETS[0];
  const facts = factsFor(placed?.mw ?? preset.mw, preset.tiles * preset.tiles * 20, lesson); // 1 tile = 20 acres
  const vars = { name: profile?.name ?? "", guide: guide.name, ...factVars(facts, lesson) };
  const t = (x: Parameters<typeof textFor>[0]) => fill(textFor(x, band), vars);

  // Is this step finished (so Next works)?
  const done = (() => {
    switch (step.type) {
      case "predict":
        return !!answers[step.id];
      case "do":
        if (step.action === "place") return !!placed;
        if (step.action === "year") return !!placed && year >= step.atLeast;
        return abatement.changed;
      case "reflect":
        return step.kind === "vote" ? !!answers[step.id] : (answers[step.id] ?? "").trim().length >= 3;
      default:
        return true;
    }
  })();

  // What the guide says and how it looks
  let text: string;
  let mood: Mood = step.mood ?? "happy";
  if (step.type === "check") {
    const picked = answers[step.prediction];
    const right = picked === step.answer;
    const pred = steps.find((s) => s.type === "predict" && s.id === step.prediction);
    const choice = pred?.type === "predict" ? pred.choices.find((c) => c.id === picked) : undefined;
    text = fill(t(right ? step.text.right : step.text.wrong), { choice: choice ? textFor(choice.text, band) : "" });
    mood = step.mood ?? (right ? "wow" : "thinking");
  } else if (step.type === "do" && done) {
    text = step.doneText ? t(step.doneText) : "Nice work! ✅";
    mood = "wow";
  } else {
    text = t(step.text);
  }
  const choices: Choice[] = step.type === "predict" || (step.type === "reflect" && step.kind === "vote") ? (step.choices ?? []) : [];
  const answerKey = step.type === "predict" || step.type === "reflect" ? step.id : null;

  // Read aloud: automatic for K-2, 🔊 button for everyone (on-device voices only)
  const spoken = [text.replace(/\*\*/g, ""), ...choices.map((c, i) => `${LETTERS[i]}: ${t(c.text)}`)].join(". ");
  const { speak, stop } = speech;
  useEffect(() => {
    if (mapReady && band === "K-2") speak(spoken);
    // Only when the step changes (or the map first appears), not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, mapReady, band, speech.available]);
  useEffect(() => stop, [stop]);

  function go(to: number) {
    const next = Math.max(0, Math.min(steps.length - 1, to));
    stop();
    setIndex(next);
    setVisit((v) => v + 1);
    updateModule(lesson.id, { step: next });
  }

  function finish() {
    stop();
    updateModule(lesson.id, { step: index, done: true });
    setFinished(true);
  }

  // Keep the speech bubble above the build menu / year bar
  useEffect(() => {
    const el = document.getElementById("dc-bottom-controls");
    if (!el) return;
    const ro = new ResizeObserver(() => setBottomSpace(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapReady]);

  // What this step asks the 3D scene to do
  const yearShown = steps.slice(0, index + 1).some((s) => s.type === "do" && s.action === "year");
  const control: LessonControl = useMemo(() => {
    const isPlace = step.type === "do" && step.action === "place";
    const isAbatement = step.type === "do" && step.action === "abatement";
    const suggest = isPlace && step.suggest && (step.suggest.bands ?? ["K-2", "3-5"]).includes(band) ? step.suggest : null;
    const preset = isPlace ? PRESETS.find((p) => p.id === (step.preset ?? "enterprise")) : undefined;
    let fly: FlyTarget | undefined = step.type === "look" ? step.target : step.type === "talk" || step.type === "do" ? step.fly : undefined;
    if (!fly && suggest) fly = "datacenter"; // before placing, this looks at the suggested spot
    const landmark = (step.type === "talk" || step.type === "look" ? step.landmark : undefined) ?? (step.type === "look" && typeof step.target === "string" && PIN_KINDS.includes(step.target) ? step.target : undefined);
    const highlight = step.type === "look" || step.type === "do" ? step.highlight ?? null : null;
    return {
      fly: fly ? { id: visit, target: fly } : undefined,
      lockCamera: step.type === "look" ? step.lockCamera : false,
      presets: isPlace ? [preset?.id ?? "enterprise"] : [],
      showYear: yearShown,
      showImpacts: (lesson.showImpacts ?? ["6-8", "9-12"]).includes(band) || !!highlight,
      showSettings: isAbatement ? "abatement" : false,
      startYear: lesson.startYear,
      highlightMetric: highlight,
      highlightLandmark: (landmark as LessonControl["highlightLandmark"]) ?? null,
      suggest: suggest && preset ? { x: suggest.x, z: suggest.z, tiles: preset.tiles } : null,
      onEvent: (e: SceneEvent) => {
        if (e.type === "loaded") setMapReady(true);
        else if (e.type === "placed") setPlaced({ preset: e.preset, mw: e.mw });
        else if (e.type === "removed") setPlaced(null);
        else if (e.type === "year") setYear(e.year);
        else if (e.type === "abatement") setAbatement((a) => (a.start == null ? { start: e.pct, changed: false } : { start: a.start, changed: a.changed || e.pct !== a.start }));
      },
    };
  }, [step, visit, lesson.startYear, lesson.showImpacts, band, yearShown]);

  if (!town || !profile) return <LoadingScreen visible title="Loading" />;

  const fact = (step.type === "look" || step.type === "check") && step.fact ? step.fact : null;

  return (
    <>
      <Scene town={town} lesson={control} />

      {/* Back to the module map */}
      <Link href="/learn" onClick={stop} style={{ ...bigButton("plain"), position: "fixed", top: 16, right: 16, zIndex: 20, minHeight: 52, fontSize: 18, border: "none", boxShadow: "0 4px 14px rgba(20,40,60,0.2)" }}>
        ← Map
      </Link>

      {finished && (
        <Modal onClose={() => router.push("/learn")} width={560}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
            <Guide id={guide.id} name={guide.name} mood="wow" size={120} />
            <div style={{ fontSize: 54 }}>⭐</div>
            <h2 style={{ fontSize: 32, margin: 0, lineHeight: 1.15, textWrap: "balance" }}>You finished “{textFor(lesson.title, band)}”!</h2>
            <p style={{ fontSize: 20, margin: "4px 0 16px", color: "#4a5560" }}>Great work, {profile.name}.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/learn/my-work" style={bigButton("plain")}>
                📄 My work
              </Link>
              <Link href="/learn" style={bigButton()}>
                Back to map →
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {mapReady && fact && <FactCard fact={fact} facts={facts} band={band} source={lesson.facts?.homeMWhPerYear?.source} />}

      {mapReady && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20 + (bottomSpace ? bottomSpace + 14 : 0),
            transform: "translateX(-50%)",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 20,
            display: "flex",
            gap: 26, // room for the bubble's tail
            alignItems: "flex-end",
            fontFamily: FONT,
            transition: "bottom 0.3s",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Guide id={guide.id} name={guide.name} mood={mood} talking={talking} size={104} />
            <span style={{ background: guide.color, color: "#fff", fontWeight: 800, fontSize: 16, borderRadius: 10, padding: "2px 10px", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{guide.name}</span>
          </div>

          <SpeechBubble
            text={text}
            band={band}
            stepKey={`${visit}-${done}`}
            onTyping={setTalking}
            footer={
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Multiple choice (predict, vote) */}
                {choices.length > 0 && answerKey && (
                  <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {choices.map((c, i) => {
                      const on = answers[answerKey] === c.id;
                      return (
                        <button key={c.id} role="radio" aria-checked={on} onClick={() => saveAnswer(lesson.id, answerKey, c.id)} style={choiceStyle(on)}>
                          <span style={{ width: 34, height: 34, borderRadius: 17, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? "#1e88e5" : "#e3f2fd", color: on ? "#fff" : "#1565c0", fontWeight: 800 }}>{LETTERS[i]}</span>
                          <span>{t(c.text)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Short answer */}
                {step.type === "reflect" && step.kind === "short" && (
                  <textarea
                    value={answers[step.id] ?? ""}
                    onChange={(e) => saveAnswer(lesson.id, step.id, e.target.value)}
                    maxLength={500}
                    rows={3}
                    aria-label="Your answer"
                    placeholder={step.placeholder ? t(step.placeholder) : "Type your answer…"}
                    style={{ width: "100%", boxSizing: "border-box", fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, padding: "12px 14px", borderRadius: 16, border: "3px solid #90caf9", outline: "none", resize: "vertical" }}
                  />
                )}

                {/* Where this step's numbers come from */}
                {step.cite && step.cite.length > 0 && (
                  <div style={{ width: 0, minWidth: "100%", fontSize: 13, lineHeight: 1.35, color: "#5f6b76", fontWeight: 600 }}>
                    {step.cite.map((k) => (
                      <div key={k}>📚 Source: {lesson.facts?.[k]?.source}</div>
                    ))}
                  </div>
                )}

                {/* Read aloud, step count, Back / Next */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {speech.available && (
                    <button onClick={() => speak(spoken)} aria-label="Read aloud" title="Read aloud" style={{ ...btn(false), minWidth: 52, padding: 0 }}>
                      🔊
                    </button>
                  )}
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#78909c", flex: 1, minWidth: 48 }}>
                    {index + 1} / {steps.length}
                  </span>
                  {index > 0 && (
                    <button onClick={() => go(index - 1)} style={btn(false)}>
                      ← Back
                    </button>
                  )}
                  {last ? (
                    <button onClick={finish} disabled={!done} style={btn(true, !done)}>
                      Finish ✓
                    </button>
                  ) : (
                    <button onClick={() => go(index + 1)} disabled={!done} style={btn(true, !done)}>
                      Next →
                    </button>
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}
    </>
  );
}

// Big, easy-to-hit buttons (a bit smaller than the map's so the bubble stays compact)
function btn(primary: boolean, disabled = false): CSSProperties {
  return { ...bigButton(primary ? "primary" : "plain", disabled), minHeight: 52, minWidth: 110, padding: "0 22px", fontSize: 19, borderRadius: 16, borderWidth: primary ? 0 : 2 };
}

function choiceStyle(on: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 56,
    padding: "8px 14px",
    borderRadius: 16,
    border: on ? "3px solid #1e88e5" : "2px solid #cfd8dc",
    background: on ? "#e3f2fd" : "#fff",
    fontFamily: FONT,
    fontSize: 19,
    fontWeight: 700,
    color: INK,
    textAlign: "left",
    cursor: "pointer",
  };
}
