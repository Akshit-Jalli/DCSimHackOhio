import type { Metadata } from "next";
import TownApp from "../TownApp";

export const metadata: Metadata = {
  title: "DCSim · Simulator",
  description: "Place a data center in a real town and compare 15 years with and without it",
};

// The 3D simulator (was the home page). Supports ?town=<slug>, same as before.
export default function SimulatePage() {
  return <TownApp />;
}
