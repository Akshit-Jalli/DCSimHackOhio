// Shared day/night state. `target` is 0 (day) or 1 (night); `t` eases toward it every frame.
// 3D pieces read `night.t` inside useFrame so the switch fades smoothly.
export const night = { target: 0, t: 0 };

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
