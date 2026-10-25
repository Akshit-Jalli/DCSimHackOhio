import Link from "next/link";
import type { ReactNode } from "react";

export const REPO = "https://github.com/Akshit-Jalli/DCSimHackOhio";

// Top bar. "over" sits on the hero photo; "page" is the plain version for other pages.
export function Header({ tone = "page" }: { tone?: "over" | "page" }) {
  const over = tone === "over";
  return (
    <header className={over ? "absolute inset-x-0 top-0 z-10 text-white" : "border-b border-[var(--rule)]"}>
      <div className={`mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8 ${over ? "border-b border-white/20" : ""}`}>
        <Link href="/" className="lp-serif text-[22px] leading-none">
          dcsim
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#product" className="hidden hover:underline sm:inline">Product</Link>
          <Link href="/#method" className="hidden hover:underline sm:inline">Method</Link>
          <Link href="/#sources" className="hidden hover:underline sm:inline">Sources</Link>
          <Link href="/learn" className="hover:underline">Learn</Link>
          <Link
            href="/simulate"
            className={`px-3.5 py-2 ${over ? "bg-white text-[var(--ink)] hover:bg-[var(--paper)]" : "bg-[var(--ink)] text-[var(--paper)] hover:bg-black"}`}
          >
            Open the simulator
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-[var(--ink)] text-[#bdb8aa]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[2fr_1fr_1fr_1fr] md:px-8">
        <div>
          <p className="lp-serif text-[22px] text-[var(--paper)]">dcsim</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">A data center impact simulator for the towns being asked to host one. A student prototype built at HackOhio 2026.</p>
        </div>
        <FooterCol title="Product" links={[{ href: "/simulate", label: "Simulator" }, { href: "/learn", label: "Learn (K-12)" }, { href: "/#method", label: "Method" }, { href: "/#sources", label: "Sources" }]} />
        <FooterCol title="Project" links={[{ href: REPO, label: "GitHub" }, { href: `${REPO}/blob/main/LICENSE`, label: "MIT License" }]} />
        <FooterCol title="Legal" links={[{ href: "/terms", label: "Terms of use" }, { href: "/privacy", label: "Privacy policy" }]} />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 px-4 py-6 text-xs md:flex-row md:justify-between md:px-8">
        <span>Built by Akshit, Dhanush and Prithvi.</span>
        <span>Map data © Overture Maps Foundation and OpenStreetMap contributors.</span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="text-sm">
      <p className="lp-mono mb-3 text-xs uppercase tracking-[0.12em] text-[var(--paper)]">{title}</p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.href.startsWith("http") ? (
              <a href={l.href} className="hover:text-[var(--paper)] hover:underline">{l.label}</a>
            ) : (
              <Link href={l.href} className="hover:text-[var(--paper)] hover:underline">{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Numbered section label in the left column, content on the right
export function Section({ id, n, label, children, className = "" }: { id?: string; n: string; label: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-6 border-t border-[var(--rule)] ${className}`}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-20 md:grid-cols-[180px_1fr] md:gap-10 md:px-8 md:py-28">
        <p className="lp-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="text-[var(--accent)]">{n}</span> {label}
        </p>
        <div>{children}</div>
      </div>
    </section>
  );
}
