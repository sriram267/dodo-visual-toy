import React, { useEffect, useState, useRef } from "react";
import { BOT_DIAMETER } from "../core/layout";

// ============================================================================
// TUNABLE MASCOT PARAMETERS (Ready State, Spring Physics & Sway)
// ============================================================================
export const READY_BODY_SCALE = 1.25;      // Body scale in READY state (grows ~1.25x)
export const READY_TRUNK_SCALE = 1.15;     // Extra trunk scale on top of body (1.15x)
export const SPRING_STIFFNESS = 180;       // Spring stiffness for IDLE -> READY transition
export const SPRING_DAMPING = 14;          // Spring damping for overshoot feel
export const TRUNK_DELAY = 70;             // Delay in ms before trunk unrolls downward (60-80ms)
export const SWAY_AMPLITUDE = 2.5;         // Subtle idle sway amplitude in degrees (+/- 2.5°)

export type TuskyExpression = "idle" | "warning" | "angry" | "dizzy";

export interface TuskyAnchorProps {
  diameter?: number;
  isNotch?: boolean;
  mousePos?: { x: number; y: number };
  targetPos?: { x: number; y: number } | null;
  status?: "idle" | "ready" | "ingesting" | "satisfied" | "sneezing";
  gulpProgress?: number; // 0..1 progress of gulp traveling up the trunk
  expression?: TuskyExpression;
  sneezeKey?: number;
  isNudging?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Articulated Elephant Mascot Rig (Tusky)
 * - Sculptural Ivory & Lavender Anatomy
 * - Real destination anchor at trunk tip for getBoundingClientRect()
 * - Fully Synchronized Cursor Tracking: Eyes, Mascot Head, and Trunk move in unison
 * - READY State: Perched on island's bottom lip, scaled 1.25x, trunk hanging downward outside bounds
 * - Subtle alive looping sway with horizontal bias toward text selection
 * - Physical Gulp Bulge traveling up trunk into body
 * - 60fps spring physics with overshoot on enter, soft ease on exit
 * - Full prefers-reduced-motion compliance
 * - Interactive Expression States: Warning 🙂↔️, Angry Elephant \ /, Dizzy Spirals @ @
 */
export const TuskyAnchor: React.FC<TuskyAnchorProps> = ({
  diameter,
  isNotch = false,
  mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  targetPos = null,
  status = "idle",
  gulpProgress = 0,
  expression = "idle",
  sneezeKey = 0,
  isNudging = false,
  onClick,
}) => {
  // Direct DOM refs for 120fps/60fps silky smooth hardware transforms
  const earsRef = useRef<SVGGElement | null>(null);
  const earLeftRef = useRef<SVGGElement | null>(null);
  const earRightRef = useRef<SVGGElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const eyesRef = useRef<SVGGElement | null>(null);
  const idleTrunkRef = useRef<SVGGElement | null>(null);
  const hangingTrunkRef = useRef<SVGGElement | null>(null);

  // Tracking Target and Current Lerp Physics Refs (zero React re-renders on mousemove)
  const trackingTargetRef = useRef({
    headX: 0,
    headY: 0,
    headRot: 0,
    eyeX: 0,
    eyeY: 0,
    trunkRot: 0,
    trunkX: 0,
    trunkY: 0,
  });

  const trackingCurrentRef = useRef({
    headX: 0,
    headY: 0,
    headRot: 0,
    eyeX: 0,
    eyeY: 0,
    trunkRot: 0,
    trunkX: 0,
    trunkY: 0,
  });

  // Spring State for Body Scale & Perch
  const [bodyProg, setBodyProg] = useState(0);   // 0 = idle, 1 = ready
  const [trunkProg, setTrunkProg] = useState(0); // 0 = curled, 1 = hanging downward

  // Spring integration refs
  const bodySpringRef = useRef({ pos: 0, vel: 0, target: 0 });
  const trunkSpringRef = useRef({ pos: 0, vel: 0, target: 0 });
  const trunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. Spring Target Management (IDLE <-> READY / INGESTING)
  useEffect(() => {
    const isTargetReady = status === "ready" || status === "ingesting" || status === "sneezing";

    if (prefersReducedMotion) {
      setBodyProg(isTargetReady ? 1 : 0);
      setTrunkProg(isTargetReady ? 1 : 0);
      return;
    }

    if (isTargetReady) {
      bodySpringRef.current.target = 1;

      if (trunkTimerRef.current) clearTimeout(trunkTimerRef.current);
      trunkTimerRef.current = setTimeout(() => {
        trunkSpringRef.current.target = 1;
      }, TRUNK_DELAY);
    } else {
      if (trunkTimerRef.current) clearTimeout(trunkTimerRef.current);
      trunkSpringRef.current.target = 0;
      bodySpringRef.current.target = 0;
    }

    return () => {
      if (trunkTimerRef.current) clearTimeout(trunkTimerRef.current);
    };
  }, [status, prefersReducedMotion]);

  // 2. Synchronized Cursor & Selection Tracking Targets (Computes targets with zero re-renders)
  useEffect(() => {
    // If an expression is active, center tracking so expressive keyframe animations display cleanly
    if (expression && expression !== "idle") {
      trackingTargetRef.current = {
        headRot: 0,
        headX: 0,
        headY: 0,
        eyeX: 0,
        eyeY: 0,
        trunkRot: 0,
        trunkX: 0,
        trunkY: 0,
      };
      return;
    }

    // Center coordinates of Tusky on screen
    const botScreenX = isNotch ? window.innerWidth / 2 - 60 : window.innerWidth / 2 - 252;
    const botScreenY = isNotch ? 30 : 90;

    const cursorDx = mousePos.x - botScreenX;
    const cursorDy = mousePos.y - botScreenY;

    if (status === "ingesting" && targetPos) {
      // INGESTING: Trunk curls & aims toward selected text origin
      const textDx = targetPos.x - botScreenX;
      const textDy = targetPos.y - botScreenY;
      const textAngleRad = Math.atan2(textDx, Math.max(40, textDy));
      const textAngleDeg = (textAngleRad * 180) / Math.PI;
      const ingestAngle = -Math.max(-26, Math.min(26, textAngleDeg * 0.8));

      trackingTargetRef.current = {
        headRot: -Math.max(-5, Math.min(5, (textDx / 300) * 4.0)),
        headX: Math.tanh(textDx / 350) * 1.2,
        headY: Math.tanh(textDy / 350) * 0.8,
        eyeX: Math.tanh(textDx / 200) * 2.2,
        eyeY: Math.tanh(textDy / 200) * 1.8,
        trunkRot: ingestAngle,
        trunkX: Math.tanh(textDx / 300) * 1.5,
        trunkY: Math.tanh(textDy / 300) * 1.2,
      };
    } else if (status === "ready" && targetPos) {
      // READY WITH SELECTION: Trunk aims directly at selected text!
      const selDx = targetPos.x - botScreenX;
      const selDy = targetPos.y - botScreenY;
      const selAngleRad = Math.atan2(selDx, Math.max(50, selDy));
      const selAngleDeg = (selAngleRad * 180) / Math.PI;
      const readyAimAngle = -Math.max(-25, Math.min(25, selAngleDeg * 0.75));

      trackingTargetRef.current = {
        headRot: -Math.max(-5, Math.min(5, (selDx / 300) * 4.0)),
        headX: Math.tanh(selDx / 350) * 1.2,
        headY: Math.tanh(selDy / 350) * 0.8,
        eyeX: Math.tanh(selDx / 200) * 2.2,
        eyeY: Math.tanh(selDy / 200) * 1.8,
        trunkRot: readyAimAngle,
        trunkX: Math.tanh(selDx / 300) * 1.6,
        trunkY: Math.tanh(selDy / 300) * 1.4,
      };
    } else {
      // IDLE: Eyes, Head, Ears, and Trunk smoothly track mouse cursor
      const lookX = Math.tanh(cursorDx / 220) * 2.0;
      const lookY = Math.tanh(cursorDy / 220) * 1.6;
      const hRot = -Math.max(-5, Math.min(5, (cursorDx / 300) * 4.5));
      const hX = Math.tanh(cursorDx / 350) * 1.4;
      const hY = Math.tanh(cursorDy / 350) * 1.0;

      const rawAngleRad = Math.atan2(cursorDx, Math.max(50, cursorDy));
      const cursorAngleDeg = (rawAngleRad * 180) / Math.PI;
      const idleAngle = -Math.max(-18, Math.min(18, cursorAngleDeg * 0.5));
      const tX = Math.tanh(cursorDx / 350) * 1.3;
      const tY = Math.tanh(cursorDy / 300) * 1.5;

      trackingTargetRef.current = {
        headRot: hRot,
        headX: hX,
        headY: hY,
        eyeX: lookX,
        eyeY: lookY,
        trunkRot: idleAngle,
        trunkX: tX,
        trunkY: tY,
      };
    }
  }, [mousePos, targetPos, status, isNotch, expression]);

  // 3. 60fps/120fps Super Smooth Physics Loop (Continuous Hardware Transforms)
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      // Spring physics: Body & Trunk Progress
      const k = SPRING_STIFFNESS;
      const c = status === "idle" ? SPRING_DAMPING * 1.3 : SPRING_DAMPING;

      const b = bodySpringRef.current;
      const bForce = -k * (b.pos - b.target) - c * b.vel;
      b.vel += bForce * dt;
      b.pos += b.vel * dt;
      setBodyProg(b.pos);

      const t = trunkSpringRef.current;
      const tForce = -k * (t.pos - t.target) - c * t.vel;
      t.vel += tForce * dt;
      t.pos += t.vel * dt;
      setTrunkProg(t.pos);

      // Subtle looping sway (alive, ~2.2 rad/s)
      const sway = Math.sin((time / 1000) * 2.2) * SWAY_AMPLITUDE;

      // ── Continuous Hardware Interpolation (Zero Stagger / Zero Shudder) ──
      const cur = trackingCurrentRef.current;
      const tgt = trackingTargetRef.current;
      // Exponential smoothing factor: 1 - exp(-lambda * dt), lambda = 22 for snappy yet buttery softness
      const factor = prefersReducedMotion ? 1 : Math.min(1, 1 - Math.exp(-22 * dt));

      cur.headX += (tgt.headX - cur.headX) * factor;
      cur.headY += (tgt.headY - cur.headY) * factor;
      cur.headRot += (tgt.headRot - cur.headRot) * factor;

      cur.eyeX += (tgt.eyeX - cur.eyeX) * factor;
      cur.eyeY += (tgt.eyeY - cur.eyeY) * factor;

      cur.trunkRot += (tgt.trunkRot - cur.trunkRot) * factor;
      cur.trunkX += (tgt.trunkX - cur.trunkX) * factor;
      cur.trunkY += (tgt.trunkY - cur.trunkY) * factor;

      // Hardware Transform Updates
      const headTransform = `translate3d(${cur.headX.toFixed(2)}px, ${cur.headY.toFixed(2)}px, 0) rotate(${cur.headRot.toFixed(2)}deg)`;

      // Ears move seamlessly with the head!
      if (earsRef.current) {
        earsRef.current.style.transform = headTransform;
      }

      // Individual ear natural flex and ready perk
      if (earLeftRef.current) {
        const readyEarRot = status === "ready" ? 3.5 : status === "ingesting" ? -3.5 : 0;
        const flex = -cur.headX * 0.75; // subtle organic ear follow-through
        earLeftRef.current.style.transform = `rotate(${(readyEarRot + flex).toFixed(2)}deg)`;
      }
      if (earRightRef.current) {
        const readyEarRot = status === "ready" ? -3.5 : status === "ingesting" ? 3.5 : 0;
        const flex = -cur.headX * 0.75;
        earRightRef.current.style.transform = `rotate(${(readyEarRot + flex).toFixed(2)}deg)`;
      }

      // Head Cranium
      if (headRef.current) {
        headRef.current.style.transform = headTransform;
      }

      // Pachyderm Eyes (Gaze follows head + eye offset)
      if (eyesRef.current) {
        eyesRef.current.style.transform = `translate3d(${(cur.headX + cur.eyeX).toFixed(2)}px, ${(cur.headY + cur.eyeY).toFixed(2)}px, 0) rotate(${cur.headRot.toFixed(2)}deg)`;
      }

      // Idle Trunk follows head + idle pose + sway
      if (idleTrunkRef.current) {
        const totalTrunkAngle = cur.trunkRot + (status === "ready" ? sway : 0);
        idleTrunkRef.current.style.transform = `translate3d(${(cur.headX + cur.trunkX).toFixed(2)}px, ${(cur.headY + cur.trunkY).toFixed(2)}px, 0) rotate(${totalTrunkAngle.toFixed(2)}deg)`;
      }

      // Ready Hanging Trunk follows head + downward pose + sway + scale
      if (hangingTrunkRef.current) {
        const totalTrunkAngle = cur.trunkRot + (status === "ready" ? sway : 0);
        const currentTrunkScale = 1 + t.pos * (READY_TRUNK_SCALE - 1);
        hangingTrunkRef.current.style.transform = `translate3d(${(cur.headX + cur.trunkX).toFixed(2)}px, ${(cur.headY + cur.trunkY * 1.3).toFixed(2)}px, 0) rotate(${totalTrunkAngle.toFixed(2)}deg) scale(${currentTrunkScale.toFixed(3)})`;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status, prefersReducedMotion]);

  const baseSize = diameter ?? (isNotch ? 34 : BOT_DIAMETER);
  const isIngesting = status === "ingesting";
  const isSatisfied = status === "satisfied";

  // Perched on bottom lip: visually balanced vertical offset
  // In idle notch, base SVG cranium has optical headroom (-5 viewBox vs y=10.5 head top),
  // causing Tusky to sit ~2.5px lower than geometric center. We compensate so he is visually centered.
  const idleNotchOffset = isNotch ? -2.5 : 0;
  const bodyOffsetY = (isNotch ? bodyProg * 8.5 : bodyProg * 5) + idleNotchOffset * (1 - bodyProg);
  const currentBodyScale = 1 + bodyProg * (READY_BODY_SCALE - 1);

  // Traveling gulp bulge along trunk curve
  const hasGulp = gulpProgress > 0 && gulpProgress < 1;
  const lumpY = 70 - gulpProgress * 48; // travels from 70 up to 22
  const lumpX = 33;

  return (
    <div
      id="tusky-anchor-container"
      className={`relative flex items-center justify-center select-none ${
        onClick ? "tusky-clickable" : ""
      }`}
      onClick={onClick}
      style={{
        width: `${baseSize}px`,
        height: `${baseSize}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformOrigin: "bottom center",
        transform: `translate3d(0, ${bodyOffsetY.toFixed(2)}px, 0) scale(${currentBodyScale.toFixed(3)})`,
        willChange: "transform",
        overflow: "visible",
        pointerEvents: onClick ? "auto" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* ── Inner Animation Wrapper (Free of inline transform clobbering) ── */}
      <div
        key={status === "sneezing" ? `sneeze-${sneezeKey}` : expression}
        className={`w-full h-full flex items-center justify-center ${
          expression === "warning"
            ? "tusky-anim-shake"
            : expression === "angry"
            ? "tusky-anim-angry"
            : expression === "dizzy"
            ? "tusky-anim-wobble"
            : status === "sneezing"
            ? "tusky-anim-sneeze"
            : ""
        }`}
        style={{
          transformOrigin: "bottom center",
          overflow: "visible",
          willChange: "transform",
        }}
      >
        <svg
          width={baseSize}
          height={baseSize}
          viewBox="0 -5 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full transition-transform duration-300 ${
            isNotch ? "drop-shadow-sm" : "drop-shadow-md"
          } ${isSatisfied ? "scale-105" : ""}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* ── Soft Porcelain Gray-Lavender Face Highlight ── */}
            <radialGradient id="tusky-face-grad" cx="50%" cy="24%" r="68%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="55%" stopColor="#e2e8f4" />
              <stop offset="100%" stopColor="#cbd5e6" />
            </radialGradient>

            {/* ── Elephant Torso & Backend Shading Gradient ── */}
            <radialGradient id="tusky-body-grad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </radialGradient>

            {/* ── Angry Face Gradient (Warmed/Reddened with fury) ── */}
            <radialGradient id="tusky-angry-face-grad" cx="50%" cy="24%" r="68%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#fca5a5" />
            </radialGradient>

            {/* ── Darker Fan Ear Tone (Contrasts behind head & island) ── */}
            <linearGradient id="ear-grad-left" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e6" />
              <stop offset="60%" stopColor="#a2afc6" />
              <stop offset="100%" stopColor="#8795ad" />
            </linearGradient>

            <linearGradient id="ear-grad-right" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e6" />
              <stop offset="60%" stopColor="#a2afc6" />
              <stop offset="100%" stopColor="#8795ad" />
            </linearGradient>

            {/* ── Inner Fan Ear Fold ── */}
            <linearGradient id="ear-inner-tone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b4a8c8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#9484ab" stopOpacity="0.4" />
            </linearGradient>

            {/* ── Polished Ivory Tusks ── */}
            <linearGradient id="ivory-tusk-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#fef9c3" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>

          {/* ── 0. Elephant Torso & Backend (Middle Part & Hindquarters expand during sneeze) ── */}
          <g
            id="tusky-body-backend"
            key={status === "sneezing" ? `backend-${sneezeKey}` : "backend"}
            className={status === "sneezing" ? "tusky-anim-backend-expand" : ""}
            style={{
              transformOrigin: "32px 36px",
              willChange: "transform",
            }}
          >
            {/* Rounded pachyderm torso / backend sitting comfortably under/behind head */}
            <path
              d="M 16 30 C 13 36, 14 46, 21 50 C 26 53, 38 53, 43 50 C 50 46, 51 36, 48 30 C 44 32, 20 32, 16 30 Z"
              fill="url(#tusky-body-grad)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="0.8"
            />
            {/* Subtle flank / belly crease highlight */}
            <path
              d="M 23 44 C 27 46, 37 46, 41 44"
              stroke="#94a3b8"
              strokeWidth="0.6"
              strokeLinecap="round"
              fill="none"
              opacity="0.4"
            />
          </g>

        {/* ── 1. Elephant Fan Ears Behind Head (Seamlessly moves with head!) ── */}
        <g
          id="tusky-ears"
          ref={earsRef}
          style={{
            transformOrigin: "32px 24px",
            willChange: "transform",
          }}
        >
          {/* Left Fan Ear */}
          <g
            id="tusky-ear-left"
            ref={earLeftRef}
            className="origin-top-left"
            style={{
              transformOrigin: "21px 22px",
              willChange: "transform",
            }}
          >
            <path
              d="M 21 18 C 13 14, 6 17, 5 22 C 3.5 28, 4 35, 7.5 40 C 10.5 43.5, 16 42.5, 21 35 Z"
              fill="url(#ear-grad-left)"
              stroke="#7e8c9f"
              strokeWidth="0.6"
            />
            <path
              d="M 19 21 C 13 18, 8 21, 7 26 C 6 31, 8 36, 12 38 C 15 39, 18 36, 19 31 Z"
              fill="url(#ear-inner-tone)"
            />
            <path
              d="M 17 25 C 13 27, 10 32, 11 36"
              stroke="#7e8c9f"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity="0.35"
              fill="none"
            />
          </g>

          {/* Right Fan Ear */}
          <g
            id="tusky-ear-right"
            ref={earRightRef}
            className="origin-top-right"
            style={{
              transformOrigin: "43px 22px",
              willChange: "transform",
            }}
          >
            <path
              d="M 43 18 C 51 14, 58 17, 59 22 C 60.5 28, 60 35, 56.5 40 C 53.5 43.5, 48 42.5, 43 35 Z"
              fill="url(#ear-grad-right)"
              stroke="#7e8c9f"
              strokeWidth="0.6"
            />
            <path
              d="M 45 21 C 51 18, 56 21, 57 26 C 58 31, 56 36, 52 38 C 49 39, 46 36, 45 31 Z"
              fill="url(#ear-inner-tone)"
            />
            <path
              d="M 47 25 C 51 27, 54 32, 53 36"
              stroke="#7e8c9f"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity="0.35"
              fill="none"
            />
          </g>
        </g>

        {/* ── 2. Wide Rounded Dome Head Group (Synchronized Cursor Tilt & Turn) ── */}
        <g
          id="tusky-head"
          ref={headRef}
          style={{
            transformOrigin: "32px 24px",
            willChange: "transform",
          }}
        >
          {/* Wide Rounded Dome Cranium (NO pointed chin or snout) */}
          <path
            d="M 19 26 C 18 17, 24 10.5, 32 10.5 C 40 10.5, 46 17, 45 26 C 45.5 33, 42 36.5, 37 36.5 L 27 36.5 C 22 36.5, 18.5 33, 19 26 Z"
            fill={expression === "angry" ? "url(#tusky-angry-face-grad)" : "url(#tusky-face-grad)"}
            stroke={expression === "angry" ? "#f87171" : "rgba(255, 255, 255, 0.95)"}
            strokeWidth="0.85"
          />

          {/* Forehead contour twin domes / angry furrowed brow */}
          {expression === "angry" ? (
            <>
              <path d="M 27 21 L 30 22.5" stroke="#ef4444" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M 37 21 L 34 22.5" stroke="#ef4444" strokeWidth="1.1" strokeLinecap="round" />
            </>
          ) : (
            <path
              d="M 28 13 Q 32 14.5, 36 13"
              stroke="#a0aec0"
              strokeWidth="0.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.3"
            />
          )}

          {/* Cheek Blushes: Dizzy = prominent pink ovals (Image 2), otherwise soft lavender */}
          {expression === "dizzy" ? (
            <>
              <ellipse cx="18" cy="27" rx="3.5" ry="2" fill="#f472b6" opacity="0.75" />
              <ellipse cx="46" cy="27" rx="3.5" ry="2" fill="#f472b6" opacity="0.75" />
            </>
          ) : (
            <>
              <ellipse
                cx="21"
                cy="31.5"
                rx={status === "ready" ? "2.6" : isIngesting ? "2.8" : "2.2"}
                ry={status === "ready" ? "1.6" : isIngesting ? "1.8" : "1.3"}
                fill="#d8b4fe"
                opacity={status === "ready" ? 0.6 : isSatisfied ? 0.7 : isIngesting ? 0.6 : 0.4}
                className="transition-all duration-200"
              />
              <ellipse
                cx="43"
                cy="31.5"
                rx={status === "ready" ? "2.6" : isIngesting ? "2.8" : "2.2"}
                ry={status === "ready" ? "1.6" : isIngesting ? "1.8" : "1.3"}
                fill="#d8b4fe"
                opacity={status === "ready" ? 0.6 : isSatisfied ? 0.7 : isIngesting ? 0.6 : 0.4}
                className="transition-all duration-200"
              />
            </>
          )}

          {/* Gentle Smile arc under trunk in Warning 🙂 state */}
          {expression === "warning" && (
            <path
              d="M 29.5 34 Q 32 36, 34.5 34"
              stroke="#0f172a"
              strokeWidth="1.1"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Defining Ivory Tusks flanking trunk base */}
          <path
            d="M 25.5 31.5 C 23.5 33, 21.5 36.5, 20.5 40.5 C 20.2 41.5, 21.2 42, 21.8 41.2 C 23.5 38.5, 25.8 35.5, 27.5 33 Z"
            fill="url(#ivory-tusk-grad)"
            stroke="#d1d5db"
            strokeWidth="0.45"
          />
          <path
            d="M 38.5 31.5 C 40.5 33, 42.5 36.5, 43.5 40.5 C 43.8 41.5, 42.8 42, 42.2 41.2 C 40.5 38.5, 38.2 35.5, 36.5 33 Z"
            fill="url(#ivory-tusk-grad)"
            stroke="#d1d5db"
            strokeWidth="0.45"
          />
        </g>

        {/* ── 3A. IDLE Curled Trunk (Thick at base, tapering, curving gently down & out) ── */}
        <g
          id="tusky-idle-trunk"
          ref={idleTrunkRef}
          style={{
            opacity: Math.max(0, 1 - trunkProg * 2),
            transformOrigin: "32px 21px",
            pointerEvents: "none",
            display: trunkProg >= 0.95 ? "none" : "block",
            willChange: "transform",
          }}
        >
          <g
            key={status === "sneezing" ? `idle-trunk-${sneezeKey}` : isNudging ? "idle-trunk-nudge" : "idle-trunk"}
            className={status === "sneezing" ? "tusky-anim-trunk-swell" : isNudging ? "tusky-anim-idle-wiggle" : ""}
            style={{
              transformOrigin: "32px 21px",
              willChange: "transform",
            }}
          >
            <path
              d="M 27 21 C 27 28, 27.8 35, 29.5 41 C 31 46, 35 48.5, 39.5 46.5 C 42.5 45, 42.5 41.5, 39.5 40.5 C 37 39.5, 35 42, 34 39 C 33 34, 34.5 27, 37 21 Z"
              fill="url(#tusky-face-grad)"
              stroke="rgba(255, 255, 255, 0.95)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            {/* Horizontal pachyderm wrinkle creases */}
            <path d="M 28 25 C 30.5 24.5, 33.5 24.5, 36 25" stroke="#94a3b8" strokeWidth="0.7" strokeLinecap="round" fill="none" />
            <path d="M 28.5 29.5 C 30.5 29, 33 29, 35 29.5" stroke="#94a3b8" strokeWidth="0.7" strokeLinecap="round" fill="none" />
            <path d="M 29.5 34.5 C 31.2 34, 33 34, 34.5 34.5" stroke="#94a3b8" strokeWidth="0.65" strokeLinecap="round" fill="none" />
            <path d="M 31 39.5 C 32.2 39, 33.5 39, 34.5 39.5" stroke="#94a3b8" strokeWidth="0.6" strokeLinecap="round" fill="none" />

            {/* Curled tip nostril rim */}
            <ellipse
              cx="40.5"
              cy="43.5"
              rx="1.5"
              ry="1.2"
              fill="#cbd5e6"
              stroke="#94a3b8"
              strokeWidth="0.45"
            />
          </g>
          {/* Idle Anchor Fallback */}
          {trunkProg < 0.5 && (
            <circle
              id="tusky-trunk-tip-anchor"
              data-tusky-tip="true"
              cx="40.5"
              cy="43.5"
              r="2.5"
              fill="rgba(0,0,0,0.01)"
              pointerEvents="none"
            />
          )}
        </g>

        {/* ── 3B. READY / HANGING DOWNWARD TRUNK (Hangs below island, points & reaches towards content) ── */}
        <g
          id="tusky-hanging-trunk"
          ref={hangingTrunkRef}
          style={{
            opacity: Math.min(1, trunkProg * 1.6),
            transformOrigin: "32px 21px",
            display: trunkProg <= 0.05 ? "none" : "block",
            pointerEvents: "none",
            willChange: "transform",
          }}
        >
          {/* Inner swell group for sneeze inhalation (trunk swells & gets bigger) */}
          <g
            key={status === "sneezing" ? `hanging-trunk-${sneezeKey}` : "hanging-trunk"}
            className={status === "sneezing" ? "tusky-anim-trunk-swell" : ""}
            style={{
              transformOrigin: "32px 21px",
              willChange: "transform",
            }}
          >
            {/* Downward hanging trunk path tapering smoothly to nozzle */}
            <path
              d="M 27 21 C 27 32, 28 44, 29.5 55 C 30.5 62, 31 67, 31.5 70 C 31.8 71.5, 34.2 71.5, 34.5 70 C 35 67, 35.5 62, 36.5 55 C 38 44, 37 32, 37 21 Z"
              fill="url(#tusky-face-grad)"
              stroke="rgba(255, 255, 255, 0.95)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            {/* Volumetric shadow along hanging spine */}
            <path
              d="M 31 25 C 31.5 38, 32 54, 32.8 66"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.35"
            />
            {/* Horizontal wrinkle rings */}
            <path d="M 28 26 C 30.5 25.5, 33.5 25.5, 36 26" stroke="#94a3b8" strokeWidth="0.65" strokeLinecap="round" opacity="0.5" fill="none" />
            <path d="M 29 35 C 31 34.5, 33 34.5, 35 35" stroke="#94a3b8" strokeWidth="0.65" strokeLinecap="round" opacity="0.5" fill="none" />
            <path d="M 30 45 C 31.5 44.5, 32.5 44.5, 34 45" stroke="#94a3b8" strokeWidth="0.6" strokeLinecap="round" opacity="0.45" fill="none" />
            <path d="M 30.8 55 C 32 54.5, 33 54.5, 34.2 55" stroke="#94a3b8" strokeWidth="0.55" strokeLinecap="round" opacity="0.45" fill="none" />
            <path d="M 31.5 64 C 32.5 63.5, 33.2 63.5, 33.8 64" stroke="#94a3b8" strokeWidth="0.5" strokeLinecap="round" opacity="0.4" fill="none" />

            {/* Open Downward Nozzle Tip (Pointing at page content) */}
            <ellipse
              cx="33"
              cy="70"
              rx="1.6"
              ry="1.1"
              fill="#cbd5e6"
              stroke="#94a3b8"
              strokeWidth="0.5"
            />
          </g>

          {/* Gulp Bulge traveling up hanging trunk */}
          {hasGulp && (
            <ellipse
              cx={lumpX}
              cy={lumpY}
              rx="3.5"
              ry="2.4"
              fill="url(#tusky-face-grad)"
              stroke="#cbd5e6"
              strokeWidth="0.8"
              opacity="0.95"
            />
          )}

          {/* Live Physical Destination Anchor in READY position */}
          {trunkProg >= 0.5 && (
            <circle
              id="tusky-trunk-tip-anchor"
              data-tusky-tip="true"
              cx="33"
              cy="70"
              r="2.5"
              fill="rgba(0,0,0,0.01)"
              pointerEvents="none"
            />
          )}
        </g>

        {/* ── 4. Expressive Pachyderm Eyes ── */}
        {expression === "warning" ? (
          /* Warning 🙂 Eyes: Smiling Curved Crescents */
          <g
            id="tusky-eyes-warning"
            ref={eyesRef}
            className="transition-all duration-200"
            style={{
              transformOrigin: "32px 24px",
            }}
          >
            <path
              d="M 21.8 24.5 Q 23.5 21.8, 25.2 24.5"
              stroke="#0f172a"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 38.8 24.5 Q 40.5 21.8, 42.2 24.5"
              stroke="#0f172a"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ) : expression === "angry" ? (
          /* Angry Elephant Eyes: Heavy slanted eye bars \ / matching Image 1 */
          <g
            id="tusky-eyes-angry"
            ref={eyesRef}
            className="transition-all duration-200"
            style={{
              transformOrigin: "32px 24px",
            }}
          >
            <line x1="21" y1="23" x2="26" y2="26" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="43" y1="23" x2="38" y2="26" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        ) : expression === "dizzy" ? (
          /* Dizzy Spiral Eyes @ @ matching Image 2 */
          <g
            id="tusky-eyes-dizzy"
            ref={eyesRef}
            style={{
              transformOrigin: "32px 24px",
            }}
          >
            <g transform="translate(23.5, 24.5)">
              <path
                d="M 0 0 C 0.8 -0.8, 1.6 0, 1.4 0.9 C 1.2 2, -0.6 2.2, -1.5 1.2 C -2.6 -0.1, -1.8 -2.4, 0.4 -2.8 C 2.8 -3.1, 4 -0.6, 3.2 2"
                stroke="#0f172a"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
                className="tusky-anim-spin"
              />
            </g>
            <g transform="translate(40.5, 24.5)">
              <path
                d="M 0 0 C 0.8 -0.8, 1.6 0, 1.4 0.9 C 1.2 2, -0.6 2.2, -1.5 1.2 C -2.6 -0.1, -1.8 -2.4, 0.4 -2.8 C 2.8 -3.1, 4 -0.6, 3.2 2"
                stroke="#0f172a"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
                className="tusky-anim-spin"
              />
            </g>
          </g>
        ) : isSatisfied ? (
          /* Satisfied Happy Gulp Crescents (^ ^) */
          <g
            ref={eyesRef}
            className="transition-all duration-200"
            style={{
              transformOrigin: "32px 24px",
            }}
          >
            <path
              d="M 21.8 24.5 Q 23.5 22.2, 25.2 24.5"
              stroke="#0f172a"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 38.8 24.5 Q 40.5 22.2, 42.2 24.5"
              stroke="#0f172a"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ) : (
          /* Active Pachyderm Eyes: Small, set wide, synchronized Gaze & Head Tracking */
          <g
            id="tusky-eyes"
            ref={eyesRef}
            style={{
              transformOrigin: "32px 24px",
              willChange: "transform",
            }}
          >
            {/* Left Eye */}
            <ellipse cx="23.5" cy="24.5" rx="1.5" ry="1.9" fill="#0f172a" />
            <circle cx="24.1" cy="23.8" r="0.55" fill="#ffffff" />
            <path d="M 21.8 22.8 Q 23.5 21.8, 25.2 22.8" stroke="#94a3b8" strokeWidth="0.5" strokeLinecap="round" fill="none" opacity="0.6" />

            {/* Right Eye */}
            <ellipse cx="40.5" cy="24.5" rx="1.5" ry="1.9" fill="#0f172a" />
            <circle cx="41.1" cy="23.8" r="0.55" fill="#ffffff" />
            <path d="M 38.8 22.8 Q 40.5 21.8, 42.2 22.8" stroke="#94a3b8" strokeWidth="0.5" strokeLinecap="round" fill="none" opacity="0.6" />
          </g>
        )}
      </svg>
      </div>
    </div>
  );
};
