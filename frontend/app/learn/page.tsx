import type { Metadata } from "next";
import Link from "next/link";
import { textFor } from "./content";
import { readModules } from "./lessonFiles";

export const metadata: Metadata = { title: "DCSim Learn" };

// Placeholder: onboarding and the module map come in the next step
export default function LearnPage() {
  return (
    <main style={{ padding: 40, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <h1>DCSim Learn</h1>
      <ul style={{ fontSize: 20, lineHeight: 2 }}>
        {readModules().map((m) => (
          <li key={m.id}>
            <Link href={`/learn/${m.id}`}>{textFor(m.title, "3-5")}</Link>
          </li>
        ))}
        <li>
          <Link href="/simulate">Free Build</Link>
        </li>
      </ul>
    </main>
  );
}
