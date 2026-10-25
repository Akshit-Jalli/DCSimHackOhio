"use client";
import type { GuideInfo, ModuleInfo } from "./content";
import { ModuleMap } from "./ModuleMap";
import { Onboarding } from "./Onboarding";
import { useProfile } from "./progress";
import { SkyBackground } from "./ui";

// /learn: onboarding the first time on this computer, then the module map
export default function LearnHome({ modules, guides, playable }: { modules: ModuleInfo[]; guides: GuideInfo[]; playable: string[] }) {
  const profile = useProfile();
  if (profile === undefined) return <SkyBackground>{null}</SkyBackground>; // reading saved progress
  if (profile === null) return <Onboarding guides={guides} />;
  return <ModuleMap profile={profile} modules={modules} guides={guides} playable={playable} />;
}
