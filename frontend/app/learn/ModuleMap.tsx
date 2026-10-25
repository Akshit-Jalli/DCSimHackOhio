"use client";
import { useState } from "react";
import Link from "next/link";
import { BANDS, textFor, type Band, type GuideInfo, type ModuleInfo } from "./content";
import { Guide } from "./Guide";
import { saveProfile, type Profile } from "./progress";
import { BAND_LABEL, bigButton, INK, Modal, MUTED, SkyBackground } from "./ui";

// Node spots on the winding path, in % of the map box (box is 1000 x 600). Room for 6 modules.
const SPOTS = [
  [14, 26],
  [50, 20],
  [86, 28],
  [80, 70],
  [46, 76],
  [12, 70],
];
const PATH = "M140 156 C 290 70 360 80 500 120 S 760 210 860 168 C 990 230 960 380 800 420 C 680 455 600 470 460 456 S 220 400 120 420";

type State = "done" | "open" | "locked" | "soon";

// Level select: Module 1 open, each next one opens when the one before is done.
export function ModuleMap({ profile, modules, guides, playable }: { profile: Profile; modules: ModuleInfo[]; guides: GuideInfo[]; playable: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const band = profile.band;
  const guide = guides.find((g) => g.id === profile.guide) ?? guides[0];

  const stateOf = (i: number): State => {
    const m = modules[i];
    if (profile.modules[m.id]?.done) return "done";
    const unlocked = i === 0 || !!profile.modules[modules[i - 1].id]?.done;
    if (!unlocked) return "locked";
    return playable.includes(m.id) ? "open" : "soon";
  };
  const current = modules.findIndex((_, i) => stateOf(i) === "open");
  // The guide stands at the next module to play, or at the last one finished
  const lastDone = modules.reduce((at, m, i) => (profile.modules[m.id]?.done ? i : at), -1);
  const guideAt = current >= 0 ? current : lastDone;
  const opened = modules.find((m) => m.id === openId);
  const openedIndex = modules.findIndex((m) => m.id === openId);

  return (
    <SkyBackground>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", flexWrap: "wrap" }}>
        <Guide id={guide.id} name={guide.name} size={60} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>Hi, {profile.name}!</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: MUTED }}>
            {BAND_LABEL[band].short} · exploring with {guide.name}
          </div>
        </div>
        <button onClick={() => setTeacher(true)} style={{ ...bigButton("plain"), minHeight: 50, fontSize: 17 }}>
          📋 For teachers
        </button>
        <button onClick={() => setConfirmReset(true)} style={{ ...bigButton("plain"), minHeight: 50, fontSize: 17 }}>
          Switch student
        </button>
      </header>

      {/* The level map */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 150px" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1000 / 600" }}>
          <svg aria-hidden viewBox="0 0 1000 600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <path d={PATH} fill="none" stroke="#ffffff" strokeWidth={26} strokeLinecap="round" opacity={0.85} />
            <path d={PATH} fill="none" stroke="#ffcc80" strokeWidth={8} strokeLinecap="round" strokeDasharray="2 22" />
          </svg>

          {modules.map((m, i) => {
            const [x, y] = SPOTS[i] ?? SPOTS[SPOTS.length - 1];
            const st = stateOf(i);
            const isCurrent = i === current;
            return (
              <div key={m.id} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 190 }}>
                {i === guideAt && (
                  <div style={{ position: "absolute", left: -44, top: -62, pointerEvents: "none" }}>
                    <Guide id={guide.id} name={guide.name} size={74} mood={isCurrent ? "wow" : "happy"} />
                  </div>
                )}
                <button
                  onClick={() => setOpenId(m.id)}
                  aria-label={`Module ${i + 1}: ${textFor(m.title, band)} (${st === "done" ? "done" : st === "locked" ? "locked" : st === "soon" ? "coming soon" : "open"})`}
                  style={{
                    width: 108,
                    height: 108,
                    borderRadius: "50%",
                    border: "6px solid #fff",
                    background: st === "done" ? "#ffca28" : st === "open" ? "#1e88e5" : "#cfd8dc",
                    boxShadow: st === "locked" || st === "soon" ? "0 5px 0 #90a4ae" : st === "done" ? "0 6px 0 #f9a825" : "0 6px 0 #1565c0",
                    fontSize: 46,
                    cursor: "pointer",
                    position: "relative",
                    animation: isCurrent ? "dcm-bounce 1.6s ease-in-out infinite" : undefined,
                    filter: st === "locked" ? "grayscale(1)" : undefined,
                  }}
                >
                  <span style={{ opacity: st === "locked" ? 0.45 : 1 }}>{m.icon}</span>
                  {st === "locked" && <span style={{ position: "absolute", right: -8, bottom: -8, fontSize: 30 }}>🔒</span>}
                  {st === "done" && <span style={{ position: "absolute", right: -8, bottom: -8, fontSize: 30 }}>⭐</span>}
                </button>
                <div style={{ background: "#fff", borderRadius: 14, padding: "6px 12px", fontSize: 17, fontWeight: 800, textAlign: "center", lineHeight: 1.2, boxShadow: "0 3px 10px rgba(0,0,0,0.1)", color: st === "locked" ? MUTED : INK, textWrap: "balance" }}>
                  {i + 1}. {textFor(m.title, band)}
                  {st === "soon" && <div style={{ fontSize: 14, color: MUTED }}>Coming soon</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Free Build: always open */}
        <Link
          href="/learn/build"
          style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8, background: "#fff", borderRadius: 26, padding: "18px 24px", textDecoration: "none", color: INK, boxShadow: "0 8px 24px rgba(20,60,100,0.15)", border: "3px solid #ffe082" }}
        >
          <span style={{ fontSize: 52 }}>🏗️</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 26, fontWeight: 800 }}>Free Build</span>
            <span style={{ display: "block", fontSize: 18, fontWeight: 600, color: MUTED }}>Place data centers anywhere and see what happens.</span>
          </span>
          <span style={bigButton()}>Open →</span>
        </Link>
      </main>
      <style>{`@keyframes dcm-bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } } @media (prefers-reduced-motion: reduce) { button { animation: none !important } }`}</style>

      {/* One module's card */}
      {opened && (
        <Modal onClose={() => setOpenId(null)}>
          {/* onStart closes the card first: Next keeps this page's state, so it would still be open when the student comes back */}
          <ModuleCard module={opened} index={openedIndex} state={stateOf(openedIndex)} band={band} profile={profile} prevTitle={openedIndex > 0 ? textFor(modules[openedIndex - 1].title, band) : ""} onStart={() => setOpenId(null)} />
        </Modal>
      )}

      {teacher && (
        <Modal onClose={() => setTeacher(false)} width={860}>
          <TeacherNotes modules={modules} startBand={band} playable={playable} />
        </Modal>
      )}

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)} width={520}>
          <h2 style={{ fontSize: 30, margin: "0 0 10px" }}>Switch student?</h2>
          <p style={{ fontSize: 20, color: MUTED, margin: "0 0 24px", lineHeight: 1.4 }}>This removes {profile.name}&apos;s name and progress from this computer.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button onClick={() => setConfirmReset(false)} style={bigButton("plain")}>
              Keep {profile.name}
            </button>
            <button onClick={() => saveProfile(null)} style={{ ...bigButton(), background: "#e53935", boxShadow: "0 4px 0 #b71c1c" }}>
              Yes, start over
            </button>
          </div>
        </Modal>
      )}
    </SkyBackground>
  );
}

function ModuleCard({
  module: m,
  index,
  state,
  band,
  profile,
  prevTitle,
  onStart,
}: {
  module: ModuleInfo;
  index: number;
  state: State;
  band: Band;
  profile: Profile;
  prevTitle: string;
  onStart: () => void;
}) {
  const progress = profile.modules[m.id];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 60 }}>{m.icon}</span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: MUTED }}>Module {index + 1}</div>
          <h2 style={{ fontSize: 32, margin: 0, lineHeight: 1.15 }}>{textFor(m.title, band)}</h2>
        </div>
      </div>
      <p style={{ fontSize: 22, lineHeight: 1.4, margin: "18px 0 24px", textWrap: "pretty" }}>{textFor(m.blurb, band)}</p>
      {state === "locked" && <p style={{ fontSize: 20, fontWeight: 700, color: MUTED }}>🔒 Finish “{prevTitle}” to open this one.</p>}
      {state === "soon" && <p style={{ fontSize: 20, fontWeight: 700, color: MUTED }}>🚧 We&apos;re still building this one. Check back soon!</p>}
      {(state === "open" || state === "done") && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ flex: 1, fontSize: 19, fontWeight: 700, color: MUTED }}>{state === "done" ? "⭐ Done! You can play it again." : progress?.step ? "You started this one." : ""}</span>
          <Link href={`/learn/${m.id}`} onClick={onStart} style={bigButton()}>
            {state === "done" ? "Play again" : progress?.step ? "Keep going →" : "Start →"}
          </Link>
        </div>
      )}
    </div>
  );
}

// For teachers: goal, time and matching standards per grade band
function TeacherNotes({ modules, startBand, playable }: { modules: ModuleInfo[]; startBand: Band; playable: string[] }) {
  const [band, setBand] = useState<Band>(startBand);
  return (
    <div>
      <h2 style={{ fontSize: 30, margin: "0 0 6px" }}>For teachers</h2>
      <p style={{ fontSize: 17, color: MUTED, margin: "0 0 16px", lineHeight: 1.45 }}>
        No accounts: a student&apos;s first name and answers stay in this browser only. Lessons take place in a 3D model of Wilmington, Ohio. Electricity facts come from the data center&apos;s size; other numbers are labeled rough estimates.
      </p>
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {BANDS.map((b) => (
          <button
            key={b}
            role="tab"
            aria-selected={band === b}
            onClick={() => setBand(b)}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: band === b ? "3px solid #1e88e5" : "2px solid #cfd8dc", background: band === b ? "#e3f2fd" : "#fff", fontFamily: "inherit", fontSize: 17, fontWeight: 800, cursor: "pointer", color: INK }}
          >
            {BAND_LABEL[b].short}
          </button>
        ))}
      </div>
      {modules.map((m, i) => (
        <section key={m.id} style={{ borderTop: "2px solid #eceff1", padding: "14px 0" }}>
          <h3 style={{ fontSize: 21, margin: "0 0 6px" }}>
            {m.icon} {i + 1}. {textFor(m.title, band)} {!playable.includes(m.id) && <span style={{ fontSize: 15, color: MUTED }}>(coming soon)</span>}
          </h3>
          {m.teacher ? (
            <>
              <p style={{ fontSize: 17, margin: "0 0 6px", lineHeight: 1.45 }}>
                <b>Goal:</b> {textFor(m.teacher.goal, band)}
              </p>
              {m.teacher.minutes && (
                <p style={{ fontSize: 17, margin: "0 0 6px" }}>
                  <b>Time:</b> {textFor(m.teacher.minutes, band)} minutes
                </p>
              )}
              {m.teacher.standards?.[band] && (
                <div style={{ fontSize: 16, lineHeight: 1.45 }}>
                  <b>NGSS:</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 22, listStyle: "disc" }}>
                    {m.teacher.standards[band]!.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 17, color: MUTED, margin: 0 }}>No teacher notes yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
