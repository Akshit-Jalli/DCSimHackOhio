import type { Metadata } from "next";
import LearnHome from "./LearnHome";
import { playableModules, readGuides, readModules } from "./lessonFiles";

export const metadata: Metadata = {
  title: "Neighbor Learn",
  description: "Lessons about data centers for grades K-12, inside a 3D model of a real town",
};

export default function LearnPage() {
  return <LearnHome modules={readModules()} guides={readGuides()} playable={playableModules()} />;
}
