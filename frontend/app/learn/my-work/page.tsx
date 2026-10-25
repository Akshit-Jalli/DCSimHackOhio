import type { Metadata } from "next";
import type { Lesson } from "../content";
import { readGuides, readLesson, readModules } from "../lessonFiles";
import MyWork from "./MyWork";

export const metadata: Metadata = { title: "Neighbor Learn · My work" };

export default function MyWorkPage() {
  const modules = readModules();
  const lessons = modules.map((m) => readLesson(m.id)).filter((l): l is Lesson => !!l);
  return <MyWork modules={modules} lessons={lessons} guides={readGuides()} />;
}
