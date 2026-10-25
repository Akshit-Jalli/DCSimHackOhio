import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";

// Landing and legal pages only. The simulator keeps the app's own fonts.
// Serif for headlines (reads like a planning report), Plex for body and figures.
export const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--lp-serif" });
export const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--lp-sans" });
export const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--lp-mono" });

export const fontVars = `${serif.variable} ${sans.variable} ${mono.variable}`;
