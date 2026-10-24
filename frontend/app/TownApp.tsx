"use client";
import { useEffect, useRef, useState } from "react";
import type { TownPick } from "@/lib/towns";
import { setTown, type TownInfo } from "./mapConfig";
import Scene from "./Scene";
import { LoadingScreen } from "./ui/LoadingScreen";

const DEFAULT_TOWN = "wilmington-oh";
// Downtown Wilmington, matching the files committed in public/
const WILMINGTON_FALLBACK: TownInfo = { slug: "wilmington-oh", name: "Wilmington", state: "OH", countyFips: "39027", lat: 39.43611, lon: -83.81389 };

const LAYER_LABELS: Record<string, string> = {
  buildings: "Buildings",
  landcover: "Fields & forest",
  roads: "Roads",
  water: "Water",
  places: "Places",
  infrastructure: "Power grid",
};

type Download = { label: string; done: string[]; error: string | null };

// Picks the town (from ?town=<slug>, or the search box), downloads it if needed, then shows the 3D scene.
// Switching towns remounts the whole scene (key = slug) so nothing from the old town is left over.
export default function TownApp() {
  const [town, setTownState] = useState<TownInfo | null>(null);
  const [download, setDownload] = useState<Download | null>(null);
  const job = useRef(0); // bump to cancel the download we're waiting on

  function show(t: TownInfo, fromPublic = false) {
    setTown(t, fromPublic);
    setTownState(t);
    setDownload(null);
    document.title = `DCSim · ${t.name}, ${t.state}`;
    const url = new URL(window.location.href);
    if (t.slug === DEFAULT_TOWN) url.searchParams.delete("town");
    else url.searchParams.set("town", t.slug);
    window.history.replaceState(null, "", url);
  }

  // Wilmington always works: from the cache, or from public/ on a fresh clone
  async function showDefault() {
    job.current++;
    try {
      const s = await fetch(`/api/town/${DEFAULT_TOWN}`).then((r) => r.json());
      if (s.state === "ready") return show(s.town);
    } catch {
      // API down: fall through to public/
    }
    show(WILMINGTON_FALLBACK, true);
  }

  // Wait for a town on the server (start = begin downloading it first), showing progress
  async function open(label: string, slug: string | null, start?: TownPick) {
    const id = ++job.current;
    setDownload({ label, done: [], error: null });
    try {
      if (start) {
        const res = await fetch("/api/town/load", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(start) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start the download");
        slug = data.slug as string;
      }
      for (;;) {
        const s = await fetch(`/api/town/${slug}`).then((r) => r.json());
        if (id !== job.current) return; // cancelled
        if (s.state === "ready") return show(s.town);
        if (s.state === "error") throw new Error(s.error);
        if (s.state === "missing") throw new Error(`"${label}" hasn't been downloaded. Search for it to download it.`);
        setDownload({ label, done: s.done, error: null });
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      if (id === job.current) setDownload({ label, done: [], error: (e as Error).message });
    }
  }

  function pickTown(p: TownPick) {
    if (town && p.name === town.name && p.state === town.state) return;
    open(`${p.name}, ${p.state}`, null, p);
  }

  function cancel() {
    job.current++;
    setDownload(null);
    if (!town) showDefault();
  }

  // First load: the town in the URL, or Wilmington. Runs once; the URL only exists in the browser.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("town");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time start from the URL
    if (slug && slug !== DEFAULT_TOWN) open(slug, slug);
    else showDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = town ? `Back to ${town.name}` : "Go to Wilmington";
  return (
    <>
      {town && <Scene key={town.slug} town={town} onPickTown={pickTown} />}
      {download ? (
        <LoadingScreen
          visible
          title={download.error ? `Couldn't load ${download.label}` : `Getting ${download.label}`}
          steps={download.error ? undefined : Object.keys(LAYER_LABELS).map((k) => ({ label: LAYER_LABELS[k], done: download.done.includes(k) }))}
          note="New towns take about 15–30 seconds. Downloaded towns open instantly next time."
          error={download.error}
          actions={[{ label: download.error ? back : "Cancel", onClick: cancel }]}
        />
      ) : (
        !town && <LoadingScreen visible title="Loading" />
      )}
    </>
  );
}
