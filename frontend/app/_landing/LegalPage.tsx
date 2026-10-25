import type { ReactNode } from "react";
import "./landing.css";
import { fontVars } from "./fonts";
import { Footer, Header } from "./Chrome";

// Shared layout for /terms and /privacy
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className={`lp ${fontVars} min-h-screen`}>
      <Header />
      <article className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-24">
        <p className="lp-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Last updated {updated}</p>
        <h1 className="lp-serif mt-4 text-[44px] leading-[1.05] md:text-[60px]">{title}</h1>
        <div className="lp-legal mt-10 space-y-8 leading-relaxed">
          {children}
        </div>
      </article>
      <Footer />
    </main>
  );
}
