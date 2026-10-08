import React from "react";

interface IslandShapeProps {
  width: number;
  height: number;
  cornerRadius: number;
  isExpanded?: boolean;
  isDocked?: boolean;
  className?: string;
  fill?: string;
  stroke?: string;
  children?: React.ReactNode;
}

/**
 * Procedural SVG implementation of Coucou & Apple Dynamic Island Capsule
 * - When floating: Full continuous rounded capsule geometry (pill in compact, rounded in expanded)
 * - Dynamic shadow: Micro-shadow in default/compact state, elevated soft shadow in expanded state.
 */
export const IslandShape: React.FC<IslandShapeProps> = ({
  width,
  height,
  cornerRadius,
  isExpanded = false,
  isDocked = false,
  className = "",
  fill = "#000000",
  stroke = "rgba(255, 255, 255, 0.12)",
  children,
}) => {
  const cr = Math.min(cornerRadius, height / 2);
  const w = width;
  const h = height;

  let pathD = "";

  if (isDocked) {
    // ── Flush Top Bezel Docked Mode ──
    pathD = [
      `M 0 0`,
      `L ${w} 0`,
      `L ${w} ${h - cr}`,
      `A ${cr} ${cr} 0 0 1 ${w - cr} ${h}`,
      `L ${cr} ${h}`,
      `A ${cr} ${cr} 0 0 1 0 ${h - cr}`,
      `Z`,
    ].join(" ");
  } else {
    // ── Floating Dynamic Island Capsule ──
    pathD = [
      `M ${cr} 0`,
      `L ${w - cr} 0`,
      `A ${cr} ${cr} 0 0 1 ${w} ${cr}`,
      `L ${w} ${h - cr}`,
      `A ${cr} ${cr} 0 0 1 ${w - cr} ${h}`,
      `L ${cr} ${h}`,
      `A ${cr} ${cr} 0 0 1 0 ${h - cr}`,
      `L 0 ${cr}`,
      `A ${cr} ${cr} 0 0 1 ${cr} 0`,
      `Z`,
    ].join(" ");
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Dynamic drop shadow filter based on state */}
        <filter id="coucou-glow" x="-20%" y="-20%" width="140%" height="150%">
          {isExpanded ? (
            <>
              {/* Elevated floating chamber shadow */}
              <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#000000" floodOpacity="0.18" />
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000000" floodOpacity="0.10" />
            </>
          ) : (
            <>
              {/* Ultra-subtle, crisp micro-shadow for default & compact states */}
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.08" />
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.04" />
            </>
          )}
        </filter>

        {/* Subtle rim highlight gradient */}
        <linearGradient id="island-rim-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.22)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.04)" />
        </linearGradient>

        {/* Golden Ingestion Rim Highlight */}
        <linearGradient id="island-ingest-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(250, 204, 21, 0.45)" />
          <stop offset="50%" stopColor="rgba(254, 240, 138, 0.95)" />
          <stop offset="100%" stopColor="rgba(250, 204, 21, 0.45)" />
        </linearGradient>

        {/* Vibrant Emerald Sneeze Rim Highlight */}
        <linearGradient id="island-sneeze-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(52, 211, 153, 0.45)" />
          <stop offset="50%" stopColor="rgba(134, 239, 172, 0.95)" />
          <stop offset="100%" stopColor="rgba(52, 211, 153, 0.45)" />
        </linearGradient>
      </defs>

      {/* Main black island body */}
      <path
        d={pathD}
        fill={fill}
        filter="url(#coucou-glow)"
        stroke={stroke}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {children}
    </svg>
  );
};
