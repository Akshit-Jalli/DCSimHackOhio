"use client";
import type { Mood } from "./content";

// The 4 guide characters, drawn in code (no image files). Names and colors live in content/guides.json;
// this file only knows how each one is drawn, by id. All share one face so moods look the same.

const CSS = `
.dcg-blink { transform-box: fill-box; transform-origin: center; animation: dcg-blink 4.2s infinite; }
@keyframes dcg-blink { 0%, 93%, 100% { transform: scaleY(1) } 96% { transform: scaleY(0.1) } }
.dcg-talk { transform-box: fill-box; transform-origin: center; animation: dcg-talk 0.2s ease-in-out infinite alternate; }
@keyframes dcg-talk { from { transform: scaleY(0.3) } to { transform: scaleY(1) } }
.dcg-bob { animation: dcg-bob 2.8s ease-in-out infinite; }
@keyframes dcg-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@media (prefers-reduced-motion: reduce) { .dcg-blink, .dcg-talk, .dcg-bob { animation: none } }
`;

// Eyes, cheeks and mouth, centered between the eyes at (x, y)
function Face({ x, y, mood, talking, ink }: { x: number; y: number; mood: Mood; talking: boolean; ink: string }) {
  const wow = mood === "wow";
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="dcg-blink">
        {wow ? (
          <>
            <circle cx={-12} cy={0} r={6.5} fill="#fff" stroke={ink} strokeWidth={2} />
            <circle cx={12} cy={0} r={6.5} fill="#fff" stroke={ink} strokeWidth={2} />
            <circle cx={-12} cy={0.5} r={3.2} fill={ink} />
            <circle cx={12} cy={0.5} r={3.2} fill={ink} />
          </>
        ) : (
          <>
            <ellipse cx={-12} cy={0} rx={4.2} ry={5.6} fill={ink} />
            <ellipse cx={12} cy={0} rx={4.2} ry={5.6} fill={ink} />
            <circle cx={-10.6} cy={-2.2} r={1.5} fill="#fff" />
            <circle cx={13.4} cy={-2.2} r={1.5} fill="#fff" />
          </>
        )}
      </g>
      {mood === "thinking" && <path d="M 6 -11 Q 12 -15 18 -12" stroke={ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />}
      <ellipse cx={-21} cy={9} rx={4.5} ry={2.8} fill="#ff8a80" opacity={0.55} />
      <ellipse cx={21} cy={9} rx={4.5} ry={2.8} fill="#ff8a80" opacity={0.55} />
      {talking ? (
        <ellipse className="dcg-talk" cx={0} cy={12} rx={5.5} ry={5} fill={ink} />
      ) : wow ? (
        <ellipse cx={0} cy={13} rx={4.5} ry={6} fill={ink} />
      ) : mood === "thinking" ? (
        <path d="M -6 13 Q 1 10 8 12" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      ) : (
        <path d="M -9 9 Q 0 19 9 9" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

type FaceProps = { mood: Mood; talking: boolean };

// Spark-powered robot
function Volt({ mood, talking }: FaceProps) {
  return (
    <>
      <line x1={60} y1={30} x2={60} y2={17} stroke="#6d4c41" strokeWidth={3} strokeLinecap="round" />
      <polygon points="61,1 50,16 58,16 54,27 69,10 61,10 66,1" fill="#fff176" stroke="#f57f17" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={16} cy={68} r={7} fill="#ffe082" stroke="#e69500" strokeWidth={3} />
      <circle cx={104} cy={68} r={7} fill="#ffe082" stroke="#e69500" strokeWidth={3} />
      <rect x={18} y={28} width={84} height={82} rx={24} fill="#ffb300" stroke="#e69500" strokeWidth={3} />
      <rect x={28} y={42} width={64} height={50} rx={16} fill="#fff8e1" />
      <Face x={60} y={62} mood={mood} talking={talking} ink="#3e2723" />
    </>
  );
}

// Water drop
function Drip({ mood, talking }: FaceProps) {
  return (
    <>
      <path d="M60 5 C 60 5 103 52 103 77 A 43 43 0 0 1 17 77 C 17 52 60 5 60 5 Z" fill="#29b6f6" stroke="#0288d1" strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={38} cy={60} rx={6} ry={13} fill="#fff" opacity={0.5} transform="rotate(-25 38 60)" />
      <Face x={60} y={78} mood={mood} talking={talking} ink="#01354d" />
    </>
  );
}

// Little cube
function Bit({ mood, talking }: FaceProps) {
  return (
    <>
      <polygon points="20,40 40,20 108,20 88,40" fill="#b39ddb" stroke="#4527a0" strokeWidth={3} strokeLinejoin="round" />
      <polygon points="88,40 108,20 108,92 88,112" fill="#5e35b1" stroke="#4527a0" strokeWidth={3} strokeLinejoin="round" />
      <rect x={20} y={40} width={68} height={72} rx={6} fill="#7e57c2" stroke="#4527a0" strokeWidth={3} />
      <rect x={28} y={46} width={8} height={8} rx={2} fill="#d1c4e9" opacity={0.8} />
      <Face x={54} y={74} mood={mood} talking={talking} ink="#ffffff" />
    </>
  );
}

// Leaf sprite
function Fern({ mood, talking }: FaceProps) {
  return (
    <>
      <path d="M60 16 C 60 7 67 2 75 6" stroke="#2e7d32" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M60 13 C 105 30 107 85 60 111 C 13 85 15 30 60 13 Z" fill="#66bb6a" stroke="#388e3c" strokeWidth={3} strokeLinejoin="round" />
      <path d="M60 20 L60 104 M60 40 L44 30 M60 40 L76 30 M60 96 L46 88 M60 96 L74 88" stroke="#c8e6c9" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <Face x={60} y={66} mood={mood} talking={talking} ink="#1b3d1d" />
    </>
  );
}

const DRAW = { volt: Volt, drip: Drip, bit: Bit, fern: Fern } as const;

export function Guide({
  id,
  name,
  mood = "happy",
  talking = false,
  size = 96,
  bob = true,
}: {
  id: string;
  name: string; // for screen readers
  mood?: Mood;
  talking?: boolean;
  size?: number;
  bob?: boolean;
}) {
  const Draw = DRAW[id as keyof typeof DRAW] ?? Volt;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={name} style={{ overflow: "visible", flexShrink: 0 }}>
      <style>{CSS}</style>
      <ellipse cx={60} cy={116} rx={34} ry={5} fill="#000" opacity={0.12} />
      <g className={bob ? "dcg-bob" : undefined}>
        <Draw mood={mood} talking={talking} />
      </g>
    </svg>
  );
}
