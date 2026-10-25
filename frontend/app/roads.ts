// A walkable graph from the town's road polylines (scene meters: x east, z south).
// Segment endpoints are snapped to a coarse grid so streets that nearly meet
// connect; dead ends simply turn the walker around.

export type RoadLine = { pts: [number, number][]; w: number };

export type Seg = { ax: number; az: number; bx: number; bz: number; len: number; w: number; a: number; b: number };
export type RoadGraph = { segs: Seg[]; adj: number[][] }; // adj[node] = segment indices touching it

const SNAP = 6; // meters

export function buildGraph(roads: RoadLine[]): RoadGraph {
  const nodes = new Map<string, number>();
  const adj: number[][] = [];
  const segs: Seg[] = [];
  const nodeOf = (x: number, z: number) => {
    const k = `${Math.round(x / SNAP)},${Math.round(z / SNAP)}`;
    let n = nodes.get(k);
    if (n === undefined) {
      n = adj.length;
      nodes.set(k, n);
      adj.push([]);
    }
    return n;
  };
  for (const { pts, w } of roads) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      const a = nodeOf(ax, az);
      const b = nodeOf(bx, bz);
      const idx = segs.length;
      segs.push({ ax, az, bx, bz, len, w, a, b });
      adj[a].push(idx);
      adj[b].push(idx);
    }
  }
  return { segs, adj };
}

/** Index of the segment whose midpoint is closest to (x, z). Brute force; called once per walker. */
export function nearestSeg(g: RoadGraph, x: number, z: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < g.segs.length; i++) {
    const s = g.segs[i];
    const d = Math.hypot((s.ax + s.bx) / 2 - x, (s.az + s.bz) / 2 - z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Pick the next segment at `node`, avoiding going straight back unless it's a dead end. */
export function nextSeg(g: RoadGraph, node: number, from: number, u: number): number {
  const opts = g.adj[node];
  if (opts.length <= 1) return from;
  const others = opts.filter((i) => i !== from);
  return others[Math.floor(u * others.length)] ?? from;
}
