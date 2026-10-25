import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readGuides, readLesson, readModules } from "../lessonFiles";
import LessonPlayer from "../LessonPlayer";
import { LoadingScreen } from "../../ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Neighbor Learn",
  description: "Lessons about data centers, inside a 3D model of a real town",
};

// One page per module in content/modules.json, built ahead of time
export function generateStaticParams() {
  return readModules().map((m) => ({ moduleId: m.id }));
}

// params are read inside Suspense so navigating here stays instant (Next 16 cacheComponents)
export default function LessonPage({ params }: PageProps<"/learn/[moduleId]">) {
  return (
    <Suspense fallback={<LoadingScreen visible title="Loading" />}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/learn/[moduleId]">["params"] }) {
  const { moduleId } = await params;
  const lesson = readLesson(moduleId);
  if (!lesson) notFound();
  return <LessonPlayer lesson={lesson} guides={readGuides()} />;
}
