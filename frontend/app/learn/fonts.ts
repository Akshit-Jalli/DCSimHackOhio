import { Nunito } from "next/font/google";

// Rounded, friendly font for lesson text only (the 3D app keeps its own font). Used as var(--font-lesson).
export const lessonFont = Nunito({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-lesson" });
