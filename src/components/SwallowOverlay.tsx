import React from "react";
import type { ActiveTextPiece } from "../hooks/useSwallowText";

interface SwallowOverlayProps {
  pieces?: ActiveTextPiece[];
  chunks?: ActiveTextPiece[]; // Backward-compatibility alias
  registerPieceNode?: (id: string, node: HTMLDivElement | null) => void;
  registerChunkNode?: (id: string, node: HTMLDivElement | null) => void; // Backward-compatibility alias
}

/**
 * High-performance 60fps text clone overlay for the Funnel Suction.
 * Renders individual word/character spans positioned precisely over original coordinates,
 * transforming only via GPU compositor (translate3d, rotate, scale, opacity).
 *
 * DO NOT draw visible funnel walls, beams, or glows. The text itself forms the funnel shape.
 * Completely unmounts when animation completes — leaves zero DOM remnants.
 */
export const SwallowOverlay: React.FC<SwallowOverlayProps> = ({
  pieces,
  chunks,
  registerPieceNode,
  registerChunkNode,
}) => {
  const activeItems = pieces ?? chunks ?? [];
  const registerNode = registerPieceNode ?? registerChunkNode;

  if (activeItems.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      {activeItems.map((piece) => (
        <div
          key={piece.id}
          ref={(node) => registerNode?.(piece.id, node)}
          style={{
            position: "fixed",
            left: `${piece.startRect.left}px`,
            top: `${piece.startRect.top}px`,
            width: `${piece.startRect.width}px`,
            height: `${piece.startRect.height}px`,
            fontFamily: piece.style.fontFamily,
            fontSize: piece.style.fontSize,
            fontWeight: piece.style.fontWeight,
            lineHeight: piece.style.lineHeight,
            color: piece.style.color,
            letterSpacing: piece.style.letterSpacing,
            whiteSpace: "nowrap",
            overflow: "visible",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            willChange: "transform, opacity",
            transformOrigin: "center center",
            pointerEvents: "none",
            WebkitFontSmoothing: "antialiased",
            textRendering: "optimizeLegibility",
          }}
        >
          {piece.text}
        </div>
      ))}
    </div>
  );
};
