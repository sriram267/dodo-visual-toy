import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  NOTCH_W,
  NOTCH_H,
  EXPANDED_W,
  EXPANDED_H,
  EXPANDED_CORNER,
  WAKE_STRIP_W,
  WAKE_STRIP_H,
  ISLAND_COLORS,
  type IslandMode,
} from "../core/layout";
import { Spring } from "../core/anim";
import { IslandShape } from "./IslandShape";
import { IslandParticles } from "./IslandParticles";
import { TuskyAnchor, type TuskyExpression } from "./TuskyAnchor";
import { soundEngine } from "../core/soundEngine";
import type { SwallowedSnippet } from "../hooks/useSwallowText";
import "./DynamicIsland.css";

export interface DynamicIslandProps {
  currentMode?: IslandMode;
  onModeChange?: (mode: IslandMode) => void;
  status?: "idle" | "ready" | "ingesting" | "satisfied" | "sneezing";
  targetPos?: { x: number; y: number } | null;
  gulpProgress?: number;
  isIslandNudged?: boolean;
  swallowedSnippets?: SwallowedSnippet[];
  onSneezeSnippet?: (id?: string) => void;
  onHoverSnippet?: (id: string | null) => void;
  drySniffleText?: string | null;
  sneezeWindupText?: string | null;
  sneezeCount?: number;
}

/**
 * Coucou & Apple Dynamic Island Host
 * Floating hardware capsule with exact dimensions (184x40 notch, 430x110 Trunk Stash),
 * continuous capsule geometry, high-contrast typography, and left-anchored Tusky mascot.
 */
export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  currentMode = "notch",
  onModeChange,
  status = "idle",
  targetPos = null,
  gulpProgress = 0,
  isIslandNudged = false,
  swallowedSnippets = [],
  onSneezeSnippet,
  onHoverSnippet,
  drySniffleText = null,
  sneezeWindupText = null,
  sneezeCount = 0,
}) => {
  const [mode, setMode] = useState<IslandMode>(currentMode);
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isHovered, setIsHovered] = useState(false);
  const hasStash = swallowedSnippets.length > 0;

  // ── Tusky Expression State Machine (Clicks 1, 2, 3) ──
  const [hitStreak, setHitStreak] = useState<number>(0);
  const [expression, setExpression] = useState<TuskyExpression>("idle");
  const hitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Springs for smooth interpolated physical transitions matching Coucou
  const widthSpring = useRef(new Spring(NOTCH_W, 0.5, 0.72));
  const heightSpring = useRef(new Spring(NOTCH_H, 0.5, 0.72));
  const [currentW, setCurrentW] = useState(NOTCH_W);
  const [currentH, setCurrentH] = useState(NOTCH_H);
  const islandContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Idle Nudge State Machine (Wiggles trunk after 3 seconds of zero interaction) ──
  const [isNudging, setIsNudging] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateMode = useCallback(
    (newMode: IslandMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  // Sync external mode prop changes
  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  // Click outside to collapse expanded mode back to notch
  useEffect(() => {
    if (mode !== "expanded") return;

    const handleClickOutside = (e: MouseEvent) => {
      if (islandContainerRef.current && !islandContainerRef.current.contains(e.target as Node)) {
        updateMode("notch");
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [mode, updateMode]);

  // Mascot Click Expression Trigger
  const handleMascotClick = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      // If currently dizzy (lockout during 1.5-second recovery), ignore clicks
      if (expression === "dizzy") return;

      if (hitTimeoutRef.current) {
        clearTimeout(hitTimeoutRef.current);
        hitTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      const nextHit = (hitStreak % 3) + 1;
      setHitStreak(nextHit);

      if (nextHit === 1) {
        // ── Click 1: 🙂↔️ Warning ('Dont hit me again pal') ──
        soundEngine.playMascotWarning();
        setExpression("warning");
        hitTimeoutRef.current = setTimeout(() => {
          setExpression("idle");
          setHitStreak(0);
        }, 3500);
      } else if (nextHit === 2) {
        // ── Click 2: Angry Elephant ('Stoooopp it') ──
        soundEngine.playMascotAngry();
        setExpression("angry");
        hitTimeoutRef.current = setTimeout(() => {
          setExpression("idle");
          setHitStreak(0);
        }, 3500);
      } else if (nextHit === 3) {
        // ── Click 3: Dizzy Spirals & Banner (Image 2 Parity) ──
        soundEngine.playMascotDizzy();
        setExpression("dizzy");

        // 1.5-second lockout timer
        hitTimeoutRef.current = setTimeout(() => {
          setExpression("idle");
          setHitStreak(0);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }, 1500);
      }
    },
    [expression, hitStreak]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hitTimeoutRef.current) clearTimeout(hitTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (nudgeResetTimeoutRef.current) clearTimeout(nudgeResetTimeoutRef.current);
    };
  }, []);

  // ── 3-Second Inactivity Idle Nudge: Wiggles Tusky's trunk to draw attention without static text ──
  useEffect(() => {
    // Only nudge if resting in default idle notch mode
    if (status !== "idle" || expression !== "idle" || mode !== "notch") {
      setIsNudging(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (nudgeResetTimeoutRef.current) clearTimeout(nudgeResetTimeoutRef.current);
      return;
    }

    const scheduleNudge = (delayMs = 3000) => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        setIsNudging(true);
        if (nudgeResetTimeoutRef.current) clearTimeout(nudgeResetTimeoutRef.current);
        nudgeResetTimeoutRef.current = setTimeout(() => {
          setIsNudging(false);
          // Subsequent nudge every 5 seconds if idle continues
          scheduleNudge(5000);
        }, 850);
      }, delayMs);
    };

    const handleUserInteraction = () => {
      // User interacted: cancel any active wiggle and restart 3s timer
      setIsNudging(false);
      if (nudgeResetTimeoutRef.current) clearTimeout(nudgeResetTimeoutRef.current);
      scheduleNudge(3000);
    };

    scheduleNudge(3000);

    const eventNames = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    eventNames.forEach((ev) => window.addEventListener(ev, handleUserInteraction, { passive: true }));
    document.addEventListener("selectionchange", handleUserInteraction);
    document.addEventListener("copy", handleUserInteraction);
    document.addEventListener("paste", handleUserInteraction);

    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (nudgeResetTimeoutRef.current) clearTimeout(nudgeResetTimeoutRef.current);
      eventNames.forEach((ev) => window.removeEventListener(ev, handleUserInteraction));
      document.removeEventListener("selectionchange", handleUserInteraction);
      document.removeEventListener("copy", handleUserInteraction);
      document.removeEventListener("paste", handleUserInteraction);
    };
  }, [status, expression, mode]);

  // Set spring targets on mode change, expressions, sneeze banners, or subtle swallow nudge
  useEffect(() => {
    let targetW = NOTCH_W;
    let targetH = NOTCH_H;

    if (status === "sneezing") {
      targetW = 276;
      targetH = NOTCH_H + 4;
    } else if (status === "ingesting") {
      // Dynamic island expands smoothly while sucking in text
      targetW = 284;
      targetH = NOTCH_H + 6;
    } else if (sneezeWindupText) {
      targetW = 276;
      targetH = NOTCH_H + 4;
    } else if (drySniffleText) {
      targetW = 270;
      targetH = NOTCH_H;
    } else if (expression === "warning") {
      targetW = 310;
      targetH = NOTCH_H;
    } else if (expression === "angry") {
      targetW = 260;
      targetH = NOTCH_H;
    } else if (expression === "dizzy") {
      targetW = 460;
      targetH = 62;
    } else if (mode === "notch") {
      targetW = status === "ready" || hasStash ? 256 : NOTCH_W;
      targetH = NOTCH_H;
    } else if (mode === "expanded") {
      targetW = EXPANDED_W;
      targetH = EXPANDED_H;
    }

    // Subtle island breathe expansion during swallow (eases back on settle)
    const nudgeW = isIslandNudged ? 6 : 0;
    const nudgeH = isIslandNudged ? 3 : 0;

    widthSpring.current.setTarget(targetW + nudgeW);
    heightSpring.current.setTarget(targetH + nudgeH);
  }, [mode, isIslandNudged, expression, status, drySniffleText, sneezeWindupText, hasStash]);

  // 60fps Spring integration loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      const movingW = widthSpring.current.step(dt);
      const movingH = heightSpring.current.step(dt);

      setCurrentW(widthSpring.current.value);
      setCurrentH(heightSpring.current.value);

      if (movingW || movingH) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mode, isIslandNudged, expression, status, drySniffleText, sneezeWindupText]);

  // Global mouse tracking for eye glance and proximity (RAF throttled for 120fps/60fps fluid tracking)
  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setMousePos({ x: e.clientX, y: e.clientY });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Keyboard shortcut: Escape collapses island back to resting notch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "expanded") {
        updateMode("notch");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, updateMode]);

  useEffect(() => {
    if (status === "sneezing" || drySniffleText || sneezeWindupText) {
      updateMode("notch");
    }
  }, [status, drySniffleText, sneezeWindupText, updateMode]);

  const isExpanded = mode === "expanded" && status !== "sneezing" && !drySniffleText && !sneezeWindupText && expression === "idle";
  // Capsule corner radius: half-height for notch (pill), 28px for expanded / dizzy banner
  const isDizzyBanner = expression === "dizzy";
  const cornerRadius = isExpanded ? EXPANDED_CORNER : isDizzyBanner ? 28 : currentH / 2;

  const badgeColor =
    status === "ready" || status === "ingesting"
      ? "#facc15"
      : status === "sneezing"
      ? "#34d399"
      : hasStash
      ? "#34d399"
      : "rgba(255, 255, 255, 0.35)";

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none select-none"
      style={{ top: "10px" }}
    >
      {/* ── Coucou Wake Strip (click to expand) ── */}
      <div
        className="absolute -top-2.5 pointer-events-auto cursor-pointer"
        style={{
          width: WAKE_STRIP_W,
          height: WAKE_STRIP_H + 10,
          zIndex: 60,
        }}
        onClick={() => {
          if (mode === "notch" && expression === "idle") updateMode("expanded");
        }}
      />

      {/* ── Main Dynamic Island Container ── */}
      <div
        ref={islandContainerRef}
        id="dynamic-island-container"
        className={`relative pointer-events-auto island-wrapper ${
          isExpanded ? "island-expanded" : ""
        } ${status === "ingesting" ? "island-ingesting" : ""} ${
          status === "sneezing" ? "island-sneezing" : ""
        }`}
        style={{
          width: `${currentW}px`,
          height: `${currentH}px`,
          borderRadius: `${cornerRadius}px`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (expression === "idle" && mode !== "expanded") {
            updateMode("expanded");
          }
        }}
      >
        {/* Procedural Continuous Capsule SVG Shell */}
        <IslandShape
          width={currentW}
          height={currentH}
          cornerRadius={cornerRadius}
          isExpanded={isExpanded}
          isDocked={false}
          fill={ISLAND_COLORS.shell}
          stroke={
            status === "ingesting"
              ? "url(#island-ingest-rim)"
              : status === "sneezing"
              ? "url(#island-sneeze-rim)"
              : isHovered
              ? "rgba(255, 255, 255, 0.22)"
              : "rgba(255, 255, 255, 0.12)"
          }
        />

        {/* Procedural Particle System (Yellow Inward Suction / Green Outward Sneeze) */}
        <IslandParticles
          width={currentW}
          height={currentH}
          cornerRadius={cornerRadius}
          status={status}
          isExpanded={isExpanded}
        />

        {/* ── NOTCH MODE (184x40) / EXPRESSION BANNERS ── */}
        {!isExpanded && (
          <>
            {status === "sneezing" ? (
              /* ── SNEEZE ACTIVE BANNER (Inhale Wind-Up 0-380ms & Explosive Recoil 380-1120ms) ── */
              <div
                className="absolute inset-0 flex items-center justify-between px-3.5 animate-fade-in"
                style={{
                  color: "#ffffff",
                  padding: "0 12px 0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "visible",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "visible" }}>
                  <div
                    id="tusky-mascot-click-target"
                    onClick={handleMascotClick}
                    style={{ display: "flex", alignItems: "center", overflow: "visible", position: "relative", zIndex: 30 }}
                  >
                    <TuskyAnchor
                      key={`tusky-sneeze-${sneezeCount}`}
                      isNotch
                      expression="idle"
                      mousePos={mousePos}
                      targetPos={targetPos}
                      status="sneezing"
                      sneezeKey={sneezeCount}
                      gulpProgress={gulpProgress}
                      onClick={handleMascotClick}
                    />
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#fef08a", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                    {sneezeWindupText || "Acchooo! 💨"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#facc15",
                      boxShadow: "0 0 8px #facc15",
                    }}
                  />
                </div>
              </div>
            ) : drySniffleText ? (
              /* ── DRY SNIFFLE BANNER ── */
              <div
                className="absolute inset-0 flex items-center justify-between px-3.5 animate-fade-in"
                style={{
                  color: "#ffffff",
                  padding: "0 12px 0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "visible",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "visible" }}>
                  <div
                    id="tusky-mascot-click-target"
                    onClick={handleMascotClick}
                    style={{ display: "flex", alignItems: "center", overflow: "visible", position: "relative", zIndex: 30 }}
                  >
                    <TuskyAnchor
                      isNotch
                      expression="idle"
                      mousePos={mousePos}
                      targetPos={targetPos}
                      status="ready"
                      gulpProgress={gulpProgress}
                      onClick={handleMascotClick}
                    />
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#fef08a", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                    {drySniffleText}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#facc15",
                      boxShadow: "0 0 8px #facc15",
                    }}
                  />
                </div>
              </div>
            ) : expression === "dizzy" ? (
              /* ── 3. DIZZY BANNER (1:1 IMAGE 2 PARITY) ── */
              <div
                className="absolute inset-0 flex items-center px-4 animate-fade-in"
                style={{
                  color: "#ffffff",
                  padding: "0 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  overflow: "visible",
                }}
              >
                {/* Left: Dizzy Mascot (@ @ spiral eyes + pink blush cheeks) */}
                <div
                  id="tusky-mascot-click-target"
                  onClick={handleMascotClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    overflow: "visible",
                    position: "relative",
                    zIndex: 30,
                  }}
                  title="Too many hits at once! Resting..."
                >
                  <TuskyAnchor
                    isNotch
                    expression="dizzy"
                    mousePos={mousePos}
                    targetPos={targetPos}
                    status={status}
                    gulpProgress={gulpProgress}
                    onClick={handleMascotClick}
                  />
                </div>

                {/* Right: Exact typography from Image 2 */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, textAlign: "left" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    Too many hits at once.
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.58)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    Give me a sec — back to work in three seconds.
                  </span>
                </div>
              </div>
            ) : expression === "warning" ? (
              /* ── 1. CLICK 1: 🙂↔️ WARNING ('Dont hit me again pal') ── */
              <div
                className="absolute inset-0 flex items-center justify-between px-3.5 animate-fade-in"
                style={{
                  color: "#ffffff",
                  padding: "0 12px 0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "visible",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "visible" }}>
                  <div
                    id="tusky-mascot-click-target"
                    onClick={handleMascotClick}
                    style={{ display: "flex", alignItems: "center", overflow: "visible", position: "relative", zIndex: 30 }}
                    title="Click Tusky again"
                  >
                    <TuskyAnchor
                      isNotch
                      expression="warning"
                      mousePos={mousePos}
                      targetPos={targetPos}
                      status={status}
                      gulpProgress={gulpProgress}
                      onClick={handleMascotClick}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "rgba(250, 204, 21, 0.12)",
                      border: "1px solid rgba(250, 204, 21, 0.25)",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#fef08a", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                      Dont hit me again pal
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#facc15",
                      boxShadow: "0 0 8px #facc15",
                    }}
                  />
                </div>
              </div>
            ) : expression === "angry" ? (
              /* ── 2. CLICK 2: ANGRY ELEPHANT ('Stoooopp it') ── */
              <div
                className="absolute inset-0 flex items-center justify-between px-3.5 animate-fade-in"
                style={{
                  color: "#ffffff",
                  padding: "0 12px 0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "visible",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "visible" }}>
                  <div
                    id="tusky-mascot-click-target"
                    onClick={handleMascotClick}
                    style={{ display: "flex", alignItems: "center", overflow: "visible", position: "relative", zIndex: 30 }}
                    title="Click Tusky again"
                  >
                    <TuskyAnchor
                      isNotch
                      expression="angry"
                      mousePos={mousePos}
                      targetPos={targetPos}
                      status={status}
                      gulpProgress={gulpProgress}
                      onClick={handleMascotClick}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "rgba(248, 113, 113, 0.15)",
                      border: "1px solid rgba(248, 113, 113, 0.3)",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#fca5a5", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                      Stoooopp it
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#f87171",
                      boxShadow: "0 0 8px #f87171",
                    }}
                  />
                </div>
              </div>
            ) : (
              /* ── NORMAL IDLE NOTCH (184x40) ── */
              <div
                className="absolute inset-0 flex items-center justify-between px-3.5"
                style={{
                  color: "#ffffff",
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "visible",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "visible" }}>
                  <div
                    id="tusky-mascot-click-target"
                    onClick={handleMascotClick}
                    style={{ display: "flex", alignItems: "center", overflow: "visible", position: "relative", zIndex: 30 }}
                    title="Click Tusky"
                  >
                    <TuskyAnchor
                      isNotch
                      expression="idle"
                      mousePos={mousePos}
                      targetPos={targetPos}
                      status={status}
                      gulpProgress={gulpProgress}
                      isNudging={isNudging}
                      onClick={handleMascotClick}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: status === "ingesting" ? "#fef08a" : "#ffffff",
                    }}
                  >
                    {status === "ingesting" ? "Inhaling..." : "Tusky"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "JetBrains Mono, monospace",
                      color:
                        status === "ingesting" || status === "ready"
                          ? "#facc15"
                          : hasStash
                          ? "#34d399"
                          : "rgba(255, 255, 255, 0.55)",
                      letterSpacing: "0.04em",
                      fontWeight: status === "ingesting" || status === "ready" || hasStash ? 600 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status === "ingesting"
                      ? "● INGESTING"
                      : status === "ready"
                      ? "⌘C / Ctrl+C"
                      : hasStash
                      ? "⌘V / Ctrl+V"
                      : "⌘C / Ctrl+C"}
                  </span>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: badgeColor,
                      boxShadow: `0 0 8px ${badgeColor}`,
                      transition: "background-color 0.25s ease, box-shadow 0.25s ease",
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── EXPANDED VIEW: THE TRUNK STASH (468x146) ── */}
        {isExpanded && (
          <div
            className="absolute inset-0 flex items-center overflow-hidden animate-fade-in"
            style={{
              color: "#ffffff",
              padding: "16px 24px 15px 20px",
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            {/* ── Left: Unboxed Tusky Mascot (Free in negative space) ── */}
            <div
              id="tusky-mascot-click-target"
              onClick={handleMascotClick}
              className="tusky-clickable flex-shrink-0"
              style={{
                width: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 30,
                cursor: "pointer",
              }}
              title="Click Tusky"
            >
              <TuskyAnchor
                diameter={48}
                expression={expression}
                mousePos={mousePos}
                targetPos={targetPos}
                status={status}
                sneezeKey={sneezeCount}
                gulpProgress={gulpProgress}
                onClick={handleMascotClick}
              />
            </div>

            {/* ── Right: Creature Pocket (Voice Line + Held Snippets Tray + Quiet Hints) ── */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
              }}
            >
              {/* 1. Header: Tusky's Voice Line */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  paddingRight: "2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#ffffff",
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {swallowedSnippets.length === 0
                      ? "Stash is empty"
                      : swallowedSnippets.length === 1
                      ? "1 snippet in stash"
                      : `${swallowedSnippets.length} snippets in stash`}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {swallowedSnippets.length > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#34d399",
                        backgroundColor: "rgba(52, 211, 153, 0.14)",
                        border: "1px solid rgba(52, 211, 153, 0.28)",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {swallowedSnippets.length} held
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMode("notch");
                    }}
                    className="stash-close-fold-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.14)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      color: "rgba(255, 255, 255, 0.70)",
                      fontSize: "10px",
                      fontFamily: "JetBrains Mono, monospace",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                      lineHeight: "1.4",
                    }}
                    title="Close / Fold to Dynamic Island (Esc)"
                  >
                    close fold (esc)
                  </button>
                </div>
              </div>

              {/* 2. Held Snippets Tray (with increased 8px card gap and generous card padding) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {swallowedSnippets.length === 0 ? (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px dashed rgba(255, 255, 255, 0.12)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: "rgba(255, 255, 255, 0.45)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Select text on page & press Command + C / Ctrl + C to copy
                    </span>
                  </div>
                ) : (
                  swallowedSnippets.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="stash-snippet-row"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        border: "1px solid rgba(255, 255, 255, 0.09)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={() => onHoverSnippet?.(item.id)}
                      onMouseLeave={() => onHoverSnippet?.(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSneezeSnippet?.(item.id);
                        updateMode("notch");
                      }}
                      title="Click to return this snippet to the page"
                    >
                      <span
                        style={{
                          fontSize: "11.5px",
                          color: "rgba(255, 255, 255, 0.88)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        “{item.text}”
                      </span>
                      <span
                        className="stash-sneeze-badge"
                        style={{
                          fontSize: "9.5px",
                          fontFamily: "JetBrains Mono, monospace",
                          color: "rgba(255, 255, 255, 0.42)",
                          flexShrink: 0,
                        }}
                      >
                        return ↩
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* 3. Bottom Row: Quiet Monospace Hints */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontSize: "9.5px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "rgba(255, 255, 255, 0.38)",
                  letterSpacing: "0.02em",
                  paddingRight: "2px",
                }}
              >
                <span>Command + C / Ctrl + C copy • Command + V / Ctrl + V sneeze</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
