"use client";
import { useEffect, useState } from "react";
import { setTown } from "./mapConfig";
import Scene from "./Scene";

const TOWN = "wilmington-oh";
// Downtown Wilmington, matching the files committed in public/
const WILMINGTON_FALLBACK = { slug: "wilmington-oh", lat: 39.43611, lon: -83.81389 };

// Gets the town's info from the API, points the map at it, then shows the 3D scene
export default function TownApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(`/api/town/${TOWN}`)
      .then((r) => r.json())
      .then((s) => {
        if (s.state !== "ready") throw new Error(`${TOWN} not cached`);
        setTown(s.town);
      })
      .catch(() => {
        // Not downloaded yet (e.g. fresh clone without npm run precache): use public/ files
        setTown(WILMINGTON_FALLBACK, true);
      })
      .finally(() => setReady(true));
  }, []);

  return ready ? <Scene /> : null;
}
