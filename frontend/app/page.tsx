import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./_landing/landing.css";
import { fontVars } from "./_landing/fonts";
import { Footer, Header, REPO, Section } from "./_landing/Chrome";
import ProductViews from "./_landing/ProductViews";
import heroNight from "@/public/landing/hero-night.jpg";
import cardSite from "@/public/landing/card-site.jpg";

export const metadata: Metadata = {
  title: "Neighbor · What kind of neighbor is a data center?",
  description: "Place a data center in a real US town and compare 15 years with and without it. Every number shows its formula and its source.",
};

const SIM = "/simulate";

const AUDIENCES = [
  { who: "Residents", what: "Where it would go, who would hear it, and what it means for your water and power bill." },
  { who: "Councils and school boards", what: "Abatement and payment terms tested against 15 years of tax revenue and state aid, before the vote." },
  { who: "Planners and developers", what: "Cooling, water source and size compared, with the choice that moves the outcome most shown first." },
];

const FINDINGS = [
  { value: "$1.35M", unit: "per year", text: "The most state aid the local schools can lose. Past roughly $1.7B of construction, a bigger campus changes nothing more for them.", n: 1 },
  { value: "+5.2%", unit: "on bills", text: "Residential electric bill effect estimated where the utility is investor owned, as AES Ohio is.", n: 2 },
  { value: "1,757.4", unit: "lb CO₂ / MWh", text: "Emissions for each megawatt hour drawn at the margin of the regional grid.", n: 3 },
];

const FOOTNOTES = [
  "Our analysis of Ohio's school funding formula with the deal's abatement and PILOT terms. Preliminary.",
  "Published estimate for investor owned utilities. Source tier B, shown with a range in the simulator.",
  "EPA eGRID2023, RFCW subregion, non baseload output emission rate. Source tier A.",
];

const STEPS = [
  { title: "Load the real town", body: "Buildings, roads, water, fields and the power grid come from open map data for the town you pick." },
  { title: "Set the deal on the table", body: "Size, cooling, water source, tax abatement and payment terms: the levers a council actually negotiates." },
  { title: "Run plain formulas", body: "Year by year from 2026 to 2041, with a range wherever an input is uncertain." },
  { title: "Show the source", body: "Every result opens to the formula behind it and the graded source behind each input." },
];

const ROADMAP = [
  { when: "Today", what: "Wilmington, fully sourced", how: "Forecast for the proposed AWS campus, checked against New Albany, where a campus already runs." },
  { when: "Next", what: "Any Ohio city", how: "Search a city and it renders. County, utility, grid and school district inputs load on their own." },
  { when: "Later", what: "Other states", how: "Map, grid and emissions data already cover the country. Tax and school aid law is added state by state." },
];

const TIERS = [
  { t: "A", kind: "Government data and peer reviewed research", use: "Used as fact" },
  { t: "B", kind: "Working papers and journalism", use: "Used with a range" },
  { t: "C", kind: "Operator self reports", use: "Used with caution and labeled" },
  { t: "D", kind: "Statements from a party to the deal", use: "Shown as a claim, never used as an input" },
];

export default function Home() {
  return (
    <main className={`lp ${fontVars} min-h-screen`}>
      {/* Hero */}
      <section className="relative flex min-h-[92svh] items-end overflow-hidden bg-[#0b0f16] text-white">
        <Header tone="over" />
        <Image
          src={heroNight}
          alt="Night view of the simulator: a data center campus outside Wilmington, Ohio, with its noise zone and new power line"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[30%_60%]"
        />
        <div className="absolute inset-0 bg-[#0b0f16]/55" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 md:px-8 md:pb-16">
          <div className="ml-auto max-w-[620px]">
            <h1 className="lp-serif text-[46px] leading-[1.02] md:text-[76px]">See what a data center would do to your town.</h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/85">
              Place a campus on a 3D model of a real town and run the next 15 years: water, power bills, schools, noise, land and jobs. Every number shows its formula and its source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href={SIM} className="bg-white px-5 py-3 text-[var(--ink)] hover:bg-[var(--paper)]">Open the simulator</Link>
              <Link href="#method" className="border border-white/50 px-5 py-3 hover:border-white">Read the method</Link>
            </div>
          </div>
          <dl className="lp-mono mt-14 grid grid-cols-2 gap-y-3 border-t border-white/20 pt-5 text-xs text-white/70 md:grid-cols-4">
            <div><dt className="text-white/45">Case study</dt><dd>Wilmington, Ohio</dd></div>
            <div><dt className="text-white/45">Proposal</dt><dd>$4B AWS campus</dd></div>
            <div><dt className="text-white/45">Horizon</dt><dd>2026 to 2041</dd></div>
            <div><dt className="text-white/45">Calibrated on</dt><dd>New Albany, Ohio</dd></div>
          </dl>
        </div>
      </section>

      {/* Who it's for */}
      <Section n="01" label="Who it's for">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <h2 className="lp-serif text-[38px] leading-[1.08] md:text-[52px]">For everyone with a seat at the table.</h2>
            <dl className="mt-10 border-t border-[var(--ink)]">
              {AUDIENCES.map((a) => (
                <div key={a.who} className="grid gap-1 border-b border-[var(--rule)] py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <dt className="font-medium">{a.who}</dt>
                  <dd className="text-[var(--muted)]">{a.what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="self-end">
            <div className="border border-[var(--rule)] bg-[#e4e2d8]">
              <Image src={cardSite} alt="A data center campus placed on farmland, with the red noise zone drawn around it" placeholder="blur" sizes="(max-width: 1024px) 100vw, 560px" className="h-auto w-full" />
            </div>
            <figcaption className="lp-mono mt-3 text-xs text-[var(--muted)]">Four data halls on 320 acres of farmland, with the noise zone in red.</figcaption>
          </figure>
        </div>
      </Section>

      {/* Product */}
      <Section id="product" n="02" label="The product">
        <h2 className="lp-serif mb-10 text-[38px] leading-[1.08] md:text-[52px]">The simulator as it runs today.</h2>
        <ProductViews />
      </Section>

      {/* Findings */}
      <Section n="03" label="Findings so far">
        <h2 className="lp-serif text-[38px] leading-[1.08] md:text-[52px]">What the Wilmington run shows.</h2>
        <div className="mt-10 border-t border-[var(--ink)]">
          {FINDINGS.map((f) => (
            <div key={f.value} className="grid gap-2 border-b border-[var(--rule)] py-7 md:grid-cols-[320px_1fr] md:items-baseline md:gap-10">
              <p className="lp-serif text-[52px] leading-none md:text-[64px]">
                {f.value}
                <span className="lp-mono ml-3 align-middle text-xs text-[var(--muted)]">{f.unit}</span>
              </p>
              <p className="max-w-xl text-[var(--muted)]">
                {f.text}
                <sup className="lp-mono ml-1 text-[var(--accent)]">{f.n}</sup>
              </p>
            </div>
          ))}
        </div>
        <ol className="lp-mono mt-6 space-y-1 text-xs text-[var(--muted)]">
          {FOOTNOTES.map((f, i) => (
            <li key={i}>{i + 1}. {f}</li>
          ))}
        </ol>
      </Section>

      {/* Method */}
      <Section id="method" n="04" label="Method">
        <h2 className="lp-serif max-w-3xl text-[38px] leading-[1.08] md:text-[52px]">Four steps, each one you can check.</h2>
        <ol className="mt-10 border-t border-[var(--ink)]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[44px_1fr] gap-4 border-b border-[var(--rule)] py-6 md:grid-cols-[60px_260px_1fr] md:gap-8">
              <span className="lp-mono text-sm text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-medium">{s.title}</h3>
              <p className="col-start-2 text-[var(--muted)] md:col-start-3">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Full width statement */}
      <section className="relative overflow-hidden bg-[#0b0f16] text-white">
        <Image src={heroNight} alt="" fill placeholder="blur" sizes="100vw" className="object-cover object-[30%_80%]" />
        <div className="absolute inset-0 bg-[#0b0f16]/70" />
        <div className="relative mx-auto max-w-7xl px-4 py-32 md:px-8 md:py-44">
          <p className="lp-serif max-w-3xl text-[38px] leading-[1.08] md:text-[60px]">Before a town signs a 30 year deal, it should get to play it out first.</p>
        </div>
      </section>

      {/* Roadmap */}
      <Section n="05" label="Roadmap">
        <h2 className="lp-serif text-[38px] leading-[1.08] md:text-[52px]">From one town to any town.</h2>
        <table className="mt-10 w-full border-t border-[var(--ink)] text-left">
          <tbody>
            {ROADMAP.map((r) => (
              <tr key={r.when} className="border-b border-[var(--rule)] align-top">
                <th scope="row" className="lp-mono w-24 py-5 pr-4 text-xs font-normal uppercase tracking-[0.12em] text-[var(--accent)] md:w-40">{r.when}</th>
                <td className="py-5 pr-6 font-medium md:w-72">{r.what}</td>
                <td className="hidden py-5 text-[var(--muted)] md:table-cell">{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Sources */}
      <Section id="sources" n="06" label="Sources">
        <h2 className="lp-serif text-[38px] leading-[1.08] md:text-[52px]">About 50 references, each one graded.</h2>
        <p className="mt-5 max-w-2xl text-[var(--muted)]">Where we could not find an answer, the simulator says so and marks the question open.</p>
        <table className="mt-10 w-full border-t border-[var(--ink)] text-left">
          <thead>
            <tr className="lp-mono border-b border-[var(--rule)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <th className="w-16 py-3 font-normal">Tier</th>
              <th className="py-3 font-normal">Kind of source</th>
              <th className="hidden py-3 font-normal md:table-cell">How the engine uses it</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((x) => (
              <tr key={x.t} className="border-b border-[var(--rule)] align-top">
                <td className="lp-serif py-4 text-2xl">{x.t}</td>
                <td className="py-4 pr-6">
                  {x.kind}
                  <span className="mt-1 block text-sm text-[var(--muted)] md:hidden">{x.use}</span>
                </td>
                <td className="hidden py-4 text-[var(--muted)] md:table-cell">{x.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Close */}
      <section className="border-t border-[var(--rule)]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-20 md:flex-row md:items-end md:px-8 md:py-28">
          <h2 className="lp-serif max-w-2xl text-[38px] leading-[1.08] md:text-[52px]">Try it on Wilmington.</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={SIM} className="bg-[var(--ink)] px-5 py-3 text-[var(--paper)] hover:bg-black">Open the simulator</Link>
            <a href={REPO} className="border border-[var(--ink)] px-5 py-3 hover:bg-[var(--ink)] hover:text-[var(--paper)]">View the code</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
