import { lessonFont } from "./fonts";

// All /learn pages use the rounded lesson font (var(--font-lesson))
export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return <div className={lessonFont.variable}>{children}</div>;
}
