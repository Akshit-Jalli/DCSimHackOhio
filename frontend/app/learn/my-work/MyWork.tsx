"use client";
import Link from "next/link";
import { PRESETS } from "../../sim/presets";
import { textFor, type Band, type Choice, type GuideInfo, type Lesson, type ModuleInfo, type Text } from "../content";
import { factsFor, factVars, fill } from "../facts";
import { Guide } from "../Guide";
import { useProfile } from "../progress";
import { BAND_LABEL, bigButton, INK, MUTED, SkyBackground } from "../ui";

const LETTERS = "ABCDEFGH";

type Item =
  | { kind: "guess"; question: string; mine: string; answer?: string; right?: boolean }
  | { kind: "vote"; question: string; mine: string }
  | { kind: "short"; question: string; mine: string };

// What the student answered in one lesson, as their grade band saw it
function itemsFor(lesson: Lesson, band: Band, answers: Record<string, string>, name: string): Item[] {
  const steps = lesson.steps.filter((s) => !s.bands || s.bands.includes(band));
  const place = steps.find((s) => s.type === "do" && s.action === "place");
  const presetId = place?.type === "do" && place.action === "place" ? place.preset ?? "enterprise" : "enterprise";
  const vars = { name, ...factVars(factsFor(PRESETS.find((p) => p.id === presetId)?.mw ?? 60, lesson)) };
  const t = (x: Text) => fill(textFor(x, band), vars).replace(/\*\*/g, "");
  const choiceText = (choices: Choice[] | undefined, id: string | undefined) => {
    const i = choices?.findIndex((c) => c.id === id) ?? -1;
    return i >= 0 && choices ? `${LETTERS[i]}. ${t(choices[i].text)}` : "";
  };

  const items: Item[] = [];
  for (const s of steps) {
    if (s.type === "predict" && answers[s.id]) {
      const check = steps.find((c) => c.type === "check" && c.prediction === s.id);
      const answerId = check?.type === "check" ? check.answer : undefined;
      items.push({
        kind: "guess",
        question: t(s.text),
        mine: choiceText(s.choices, answers[s.id]),
        answer: answerId ? choiceText(s.choices, answerId) : undefined,
        right: answerId ? answers[s.id] === answerId : undefined,
      });
    } else if (s.type === "reflect" && answers[s.id]) {
      items.push(s.kind === "vote" ? { kind: "vote", question: t(s.text), mine: choiceText(s.choices, answers[s.id]) } : { kind: "short", question: t(s.text), mine: answers[s.id] });
    }
  }
  return items;
}

// Printable summary of a student's guesses, votes and written answers (all saved in this browser)
export default function MyWork({ modules, lessons, guides }: { modules: ModuleInfo[]; lessons: Lesson[]; guides: GuideInfo[] }) {
  const profile = useProfile();
  if (profile === undefined) return <SkyBackground>{null}</SkyBackground>;
  if (profile === null) {
    return (
      <SkyBackground>
        <main style={{ padding: 40, fontSize: 22 }}>
          No student on this computer yet. <Link href="/learn">Start here</Link>.
        </main>
      </SkyBackground>
    );
  }
  const band = profile.band;
  const guide = guides.find((g) => g.id === profile.guide) ?? guides[0];
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const done = modules
    .map((m, i) => ({ m, i, lesson: lessons.find((l) => l.id === m.id), progress: profile.modules[m.id] }))
    .filter((x) => x.lesson && x.progress && (x.progress.done || Object.keys(x.progress.answers ?? {}).length));

  return (
    <div className="mywork" style={{ minHeight: "100vh", background: "#f4f9fd", color: INK, fontFamily: "var(--font-lesson), system-ui, sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .mywork { background: #fff !important; }
          .mywork section { break-inside: avoid; box-shadow: none !important; border: 1px solid #ccc; }
        }
      `}</style>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div className="no-print" style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
          <Link href="/learn" style={bigButton("plain")}>
            ← Map
          </Link>
          <button onClick={() => window.print()} style={bigButton()}>
            🖨️ Print
          </button>
        </div>

        <header style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
          <Guide id={guide.id} name={guide.name} size={76} bob={false} />
          <div>
            <h1 style={{ fontSize: 38, margin: 0, lineHeight: 1.1 }}>{profile.name}&apos;s work</h1>
            <div style={{ fontSize: 18, fontWeight: 700, color: MUTED }}>
              {BAND_LABEL[band].short} · {today}
            </div>
          </div>
        </header>

        {done.length === 0 && <p style={{ fontSize: 22 }}>Finish a lesson and your guesses and answers will show up here.</p>}

        {done.map(({ m, i, lesson, progress }) => {
          const items = itemsFor(lesson!, band, progress!.answers ?? {}, profile.name);
          return (
            <section key={m.id} style={{ background: "#fff", borderRadius: 22, padding: "22px 26px", marginBottom: 18, boxShadow: "0 6px 20px rgba(20,60,100,0.1)" }}>
              <h2 style={{ fontSize: 26, margin: "0 0 4px" }}>
                {m.icon} Module {i + 1}: {textFor(m.title, band)} {progress!.done && "⭐"}
              </h2>
              <div style={{ fontSize: 16, fontWeight: 700, color: MUTED, marginBottom: 12 }}>{progress!.done ? "Finished" : "Started"}</div>
              {items.map((it, j) => (
                <div key={j} style={{ borderTop: "2px solid #eef2f5", padding: "12px 0" }}>
                  <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>{it.question}</div>
                  {it.kind === "guess" && (
                    <div style={{ fontSize: 18, lineHeight: 1.5 }}>
                      My guess: <b>{it.mine}</b>
                      {it.answer && (
                        <>
                          <br />
                          Answer: <b>{it.answer}</b> {it.right ? "✅" : "❌"}
                        </>
                      )}
                    </div>
                  )}
                  {it.kind === "vote" && (
                    <div style={{ fontSize: 18 }}>
                      My vote: <b>{it.mine}</b>
                    </div>
                  )}
                  {it.kind === "short" && <div style={{ fontSize: 18, lineHeight: 1.5, background: "#f7fafc", border: "2px solid #e3eaf2", borderRadius: 14, padding: "10px 14px", whiteSpace: "pre-wrap" }}>{it.mine}</div>}
                </div>
              ))}
            </section>
          );
        })}
        <p style={{ fontSize: 14, color: MUTED, marginTop: 24 }}>Saved only on this computer. Numbers in DCSim lessons are worked out from the data center&apos;s size or are labeled rough estimates.</p>
      </main>
    </div>
  );
}
