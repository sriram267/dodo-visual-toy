// Coucou Island Geometry & Layout Metrics
// Exact values ported from CoucouKit/IslandTypes.swift + windows/src/core/layout.ts

export type IslandMode = "notch" | "expanded";

export interface IslandDimensions {
  width: number;
  height: number;
  radius: number;
  topRadius: number; // negative = concave ears for notch mode, positive = convex rounded
}

// Coucou Dimensional Standards (Points / CSS Pixels)
// Notch height increased to 40px for generous breathing room & mascot presence
export const NOTCH_W = 240;
export const NOTCH_H = 40;

export const EXPANDED_W = 468;
export const EXPANDED_H = 146;

export const ROUNDED_CORNER = 20; // 40 / 2 for notch capsule
export const EXPANDED_CORNER = 30; // expanded Trunk Stash pill corners
export const EAR_RADIUS = 14; // notch concave ear radius

// Wake Strip Hover Sensor (matches Coucou edge hit test)
export const WAKE_STRIP_W = 240;
export const WAKE_STRIP_H = 6;

// Bot placement in expanded view (unboxed Tusky in left chamber)
export const BOT_X = 46; // center-x from left edge
export const BOT_DIAMETER = 44;

// Color System & State Washes
export const ISLAND_COLORS = {
  shell: "#000000",
  rim: "rgba(255, 255, 255, 0.08)",
  rimHover: "rgba(255, 255, 255, 0.16)",
  textPrimary: "rgba(255, 255, 255, 0.94)",
  textSecondary: "rgba(255, 255, 255, 0.52)",
  textMuted: "rgba(255, 255, 255, 0.32)",
  cardBg: "rgba(255, 255, 255, 0.04)",
  cardBorder: "rgba(255, 255, 255, 0.06)",
  cardHighlight: "rgba(255, 255, 255, 0.08)",
  
  // Radial Washes (bottom glow per view state)
  washIdle: "radial-gradient(circle at 50% 120%, rgba(99, 102, 241, 0.22) 0%, rgba(0, 0, 0, 0) 70%)",
  washActive: "radial-gradient(circle at 50% 120%, rgba(52, 211, 153, 0.26) 0%, rgba(0, 0, 0, 0) 70%)",
  washAnticipation: "radial-gradient(circle at 50% 120%, rgba(245, 165, 36, 0.28) 0%, rgba(0, 0, 0, 0) 70%)",
};

export function getModeDimensions(mode: IslandMode): IslandDimensions {
  switch (mode) {
    case "notch":
      return {
        width: NOTCH_W,
        height: NOTCH_H,
        radius: NOTCH_H / 2, // 20px continuous pill
        topRadius: -EAR_RADIUS, // concave ears
      };
    case "expanded":
      return {
        width: EXPANDED_W,
        height: EXPANDED_H,
        radius: EXPANDED_CORNER,
        topRadius: 0, // seamless flat / convex
      };
  }
}
