import React, { useState } from "react";
import { DynamicIsland } from "./island/DynamicIsland";
import { SwallowOverlay } from "./components/SwallowOverlay";
import { EditorialEssay } from "./components/EditorialEssay";
import { KeyboardShortcutIndicator } from "./components/KeyboardShortcutIndicator";
import { useSwallowText } from "./hooks/useSwallowText";
import type { IslandMode } from "./core/layout";
import "./App.css";

export const App: React.FC = () => {
  const [islandMode, setIslandMode] = useState<IslandMode>("notch");

  const {
    activeChunks,
    status,
    gulpProgress,
    isIslandNudged,
    targetCoords,
    hasSelection,
    selectedPreview,
    triggerSwallow,
    registerChunkNode,
    swallowedStack,
    sneezeSnippet,
    sneezeCount,
    hoveredSnippetId,
    setHoveredSnippetId,
    drySniffleText,
    sneezeWindupText,
  } = useSwallowText();

  // Find hovered snack to flash original coordinates on the page
  const hoveredSnippet = swallowedStack.find((s) => s.id === hoveredSnippetId);

  return (
    <div className="stage-container">
      <div className="stage-grid" />

      {/* ── DYNAMIC ISLAND HOST WITH ARTICULATED TUSKY RIG & TRUNK STASH ── */}
      <DynamicIsland
        currentMode={islandMode}
        onModeChange={(m) => setIslandMode(m)}
        status={status}
        sneezeCount={sneezeCount}
        targetPos={targetCoords}
        gulpProgress={gulpProgress}
        isIslandNudged={isIslandNudged}
        swallowedSnippets={swallowedStack}
        onSneezeSnippet={sneezeSnippet}
        onHoverSnippet={setHoveredSnippetId}
        drySniffleText={drySniffleText}
        sneezeWindupText={sneezeWindupText}
      />

      {/* ── Ground-to-Sky Tether Highlight Pulse on Page ── */}
      {hoveredSnippet && (
        <div
          className="fixed pointer-events-none z-40 transition-all duration-200 animate-pulse"
          style={{
            left: `${hoveredSnippet.rect.left - 4}px`,
            top: `${hoveredSnippet.rect.top - 2}px`,
            width: `${hoveredSnippet.rect.width + 8}px`,
            height: `${hoveredSnippet.rect.height + 4}px`,
            borderRadius: "6px",
            background: "rgba(99, 102, 241, 0.16)",
            border: "1.5px solid rgba(129, 140, 248, 0.65)",
            boxShadow: "0 0 16px rgba(99, 102, 241, 0.3)",
          }}
        />
      )}

      {/* ── 60FPS HARDWARE-ACCELERATED TEXT CLONE OVERLAY (ZERO BEAMS) ── */}
      <SwallowOverlay
        chunks={activeChunks}
        registerChunkNode={registerChunkNode}
      />

      {/* ── PHASE 5: EDITORIAL PLAYGROUND & CONTEXT (OPTION C HYBRID) ── */}
      <main className="editorial-master-wrapper">
        {/* ── 1. Curated Editorial Essay (High-craft serif typography, pull-quotes, quick bite pills) ── */}
        <EditorialEssay />




      </main>

      {/* ── 4. Unobtrusive Floating Keyboard Shortcut Indicator ── */}
      <KeyboardShortcutIndicator
        hasSelection={hasSelection}
        selectedPreview={selectedPreview}
        onFeed={triggerSwallow}
        swallowedCount={swallowedStack.length}
        onSneeze={() => sneezeSnippet()}
      />


    </div>
  );
};

export default App;
