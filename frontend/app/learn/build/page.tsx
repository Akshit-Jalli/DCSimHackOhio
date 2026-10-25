import type { Metadata } from "next";
import TownApp from "../../TownApp";

export const metadata: Metadata = { title: "DCSim Learn · Free Build" };

// Free Build for students: the simulator with only ready towns (no town search, no area picker)
export default function FreeBuildPage() {
  return <TownApp kidMode />;
}
