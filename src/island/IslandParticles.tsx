import React, { useEffect, useRef } from "react";

interface IslandParticlesProps {
  width: number;
  height: number;
  cornerRadius: number;
  status: "idle" | "ready" | "ingesting" | "satisfied" | "sneezing";
  isExpanded?: boolean;
  sneezeCount?: number;
  sneezeWindupText?: string | null;
}

// ── Curated Color Palettes ──
// Ingesting (sucking in text): Warm electric yellows & golds
const INGEST_COLORS = ["#FACC15", "#FEF08A", "#FDE047"];

// Sneezing (reverse outward blow): Fresh vibrant emerald & mint greens
const SNEEZE_COLORS = ["#34D399", "#22C55E", "#4ADE80", "#10B981"];

interface IngestParticle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  curveAmount: number;
  startTime: number;
  duration: number;
  radius: number;
  color: string;
}

interface SneezeParticle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  curveAmount: number;
  startTime: number;
  duration: number;
  radius: number;
  color: string;
}

/**
 * Universal continuous pill/capsule clipping path
 */
function clipCapsule(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(w, 0, w, h, radius);
  ctx.arcTo(w, h, 0, h, radius);
  ctx.arcTo(0, h, 0, 0, radius);
  ctx.arcTo(0, 0, w, 0, radius);
  ctx.closePath();
}

/**
 * Subtle Procedural Island Particle Engine
 * - Ingesting: 16 round yellow dots stream inward from the capsule edges to Tusky.
 *   Starts at 75% opacity and smoothly dims to 0 at Tusky.
 * - Sneezing: 16 round green dots burst outward from Tusky across the island toward the edges.
 *   Starts at 75% opacity and smoothly dims to 0 as they disperse.
 * - Snappy, lightweight, pure canvas, zero dependencies, zero lingering.
 */
export const IslandParticles: React.FC<IslandParticlesProps> = ({
  width,
  height,
  cornerRadius,
  status,
  isExpanded = false,
  sneezeCount = 0,
  sneezeWindupText = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ingestParticlesRef = useRef<IngestParticle[]>([]);
  const sneezeParticlesRef = useRef<SneezeParticle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const sneezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sneezeTriggeredRef = useRef(false);

  // Keep references to latest geometry so the RAF loop doesn't restart on every spring frame
  const widthRef = useRef(width);
  widthRef.current = width;

  const heightRef = useRef(height);
  heightRef.current = height;

  const cornerRadiusRef = useRef(cornerRadius);
  cornerRadiusRef.current = cornerRadius;

  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const prevStatusRef = useRef(status);
  const prevSneezeCountRef = useRef(sneezeCount);

  // ── Spawn Helpers ──
  const spawnIngest = (now: number) => {
    const w = widthRef.current;
    const h = heightRef.current;
    const r = cornerRadiusRef.current;
    const capR = Math.max(0, Math.min(r, h / 2, w / 2));
    const mascotX = isExpandedRef.current ? 44 : 30;
    const mascotY = h / 2;

    const count = 16;
    const particles: IngestParticle[] = [];

    for (let i = 0; i < count; i++) {
      let startX = 0;
      let startY = 0;

      // Distribute along edges
      const edge = Math.random();
      if (edge < 0.35) {
        // Top edge
        startX = capR + Math.random() * Math.max(10, w - 2 * capR);
        startY = 2;
      } else if (edge < 0.70) {
        // Bottom edge
        startX = capR + Math.random() * Math.max(10, w - 2 * capR);
        startY = h - 2;
      } else if (edge < 0.90) {
        // Right cap
        const ang = (Math.random() - 0.5) * Math.PI;
        startX = w - capR + Math.cos(ang) * (capR - 2);
        startY = h / 2 + Math.sin(ang) * (capR - 2);
      } else {
        // Left cap (behind mascot)
        const ang = Math.PI / 2 + Math.random() * Math.PI;
        startX = capR + Math.cos(ang) * (capR - 2);
        startY = h / 2 + Math.sin(ang) * (capR - 2);
      }

      const duration = 460 + Math.random() * 80; // 460-540ms fast flight
      const stagger = i * 20; // 0-300ms gentle stagger
      const curveAmount = (Math.random() - 0.5) * 8; // subtle curvature
      const radius = 1.7 + Math.random() * 0.5; // subtle 1.7-2.2px round dot
      const color = INGEST_COLORS[Math.floor(Math.random() * INGEST_COLORS.length)];

      particles.push({
        startX,
        startY,
        targetX: mascotX,
        targetY: mascotY,
        curveAmount,
        startTime: now + stagger,
        duration,
        radius,
        color,
      });
    }

    ingestParticlesRef.current = particles;
  };

  const spawnSneeze = (now: number) => {
    const w = widthRef.current;
    const h = heightRef.current;
    const mascotX = isExpandedRef.current ? 44 : 30;
    const mascotY = h / 2;

    const count = 16;
    const particles: SneezeParticle[] = [];

    for (let i = 0; i < count; i++) {
      const startX = mascotX + (Math.random() - 0.5) * 4;
      const startY = mascotY + (Math.random() - 0.5) * 4;

      // Fan outward across the capsule length to the right
      // Target positions distributed across the rightward interior of the island
      const maxAvailableX = Math.max(mascotX + 40, w - 16);
      const targetDistX = 35 + Math.random() * (maxAvailableX - mascotX);
      const targetX = Math.min(w - 12, startX + targetDistX);

      // Target Y stays comfortably inside the capsule height (e.g. 5px to h-5px)
      const verticalPadding = 6;
      const targetY =
        verticalPadding + Math.random() * Math.max(10, h - 2 * verticalPadding);

      const duration = 440 + Math.random() * 70; // 440-510ms fast burst
      const stagger = Math.random() * 35; // crisp instant explosion
      const curveAmount = (Math.random() - 0.5) * 6; // gentle organic drift
      const radius = 1.8 + Math.random() * 0.5; // subtle 1.8-2.3px round dot
      const color = SNEEZE_COLORS[Math.floor(Math.random() * SNEEZE_COLORS.length)];

      particles.push({
        startX,
        startY,
        targetX,
        targetY,
        curveAmount,
        startTime: now + stagger,
        duration,
        radius,
        color,
      });
    }

    sneezeParticlesRef.current = particles;
  };

  // ── Animation Loop ──
  const startLoop = () => {
    if (animFrameRef.current !== null) return;

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animFrameRef.current = null;
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animFrameRef.current = null;
        return;
      }

      const w = widthRef.current;
      const h = heightRef.current;
      const r = cornerRadiusRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetPxW = Math.round(w * dpr);
      const targetPxH = Math.round(h * dpr);
      if (canvas.width !== targetPxW || canvas.height !== targetPxH) {
        canvas.width = targetPxW;
        canvas.height = targetPxH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      clipCapsule(ctx, w, h, r);
      ctx.clip();

      // 1. Ingest Particles (Yellow, edges -> mascot)
      let activeIngest = 0;
      const nextIngest: IngestParticle[] = [];
      for (const p of ingestParticlesRef.current) {
        const tRaw = (now - p.startTime) / p.duration;
        if (tRaw < 0) {
          nextIngest.push(p);
          activeIngest++;
          continue;
        }
        if (tRaw >= 1) {
          continue; // arrived at Tusky, fully dimmed
        }

        activeIngest++;
        const progress = Math.pow(tRaw, 1.3);
        const dx = p.targetX - p.startX;
        const dy = p.targetY - p.startY;
        const currX = p.startX + dx * progress;
        const currY = p.startY + dy * progress;

        const dist = Math.hypot(dx, dy);
        const perpX = -dy / (dist || 1);
        const perpY = dx / (dist || 1);
        const arc = Math.sin(tRaw * Math.PI) * p.curveAmount;
        const x = currX + perpX * arc;
        const y = currY + perpY * arc;

        // Opacity: starts at 75% (0.75) from the edges, slowly dims to 0 at mascot
        const opacity = Math.max(0, 0.75 * (1 - tRaw));

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        nextIngest.push(p);
      }
      ingestParticlesRef.current = nextIngest;

      // 2. Sneeze Particles (Green, mascot -> outward edges)
      let activeSneeze = 0;
      const nextSneeze: SneezeParticle[] = [];
      for (const p of sneezeParticlesRef.current) {
        const tRaw = (now - p.startTime) / p.duration;
        if (tRaw < 0) {
          nextSneeze.push(p);
          activeSneeze++;
          continue;
        }
        if (tRaw >= 1) {
          continue; // reached outer edge, fully dimmed
        }

        activeSneeze++;
        // Decelerating outward burst
        const progress = 1 - Math.pow(1 - tRaw, 2.0);
        const dx = p.targetX - p.startX;
        const dy = p.targetY - p.startY;
        const currX = p.startX + dx * progress;
        const currY = p.startY + dy * progress;

        const dist = Math.hypot(dx, dy);
        const perpX = -dy / (dist || 1);
        const perpY = dx / (dist || 1);
        const arc = Math.sin(tRaw * Math.PI) * p.curveAmount;
        const x = currX + perpX * arc;
        const y = currY + perpY * arc;

        // Opacity: starts at 75% (0.75) at mascot, slowly dims to 0 at outer bounds
        const opacity = Math.max(0, 0.75 * (1 - tRaw));

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        nextSneeze.push(p);
      }
      sneezeParticlesRef.current = nextSneeze;

      ctx.restore();

      if (activeIngest > 0 || activeSneeze > 0) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  };

  // ── Trigger Listeners ──
  useEffect(() => {
    // 1. Ingest Trigger
    if (status === "ingesting" && prevStatusRef.current !== "ingesting") {
      spawnIngest(performance.now());
      startLoop();
    }

    // 2. Sneeze Reset on New Sneeze Count
    if (sneezeCount !== prevSneezeCountRef.current) {
      sneezeTriggeredRef.current = false;
      if (sneezeTimerRef.current) {
        clearTimeout(sneezeTimerRef.current);
        sneezeTimerRef.current = null;
      }
    }

    // 3. Sneeze Trigger
    if (status === "sneezing") {
      if (!sneezeTriggeredRef.current) {
        if (sneezeWindupText === "Acchooo! 💨") {
          // Windup completed, burst immediately
          sneezeTriggeredRef.current = true;
          if (sneezeTimerRef.current) {
            clearTimeout(sneezeTimerRef.current);
            sneezeTimerRef.current = null;
          }
          spawnSneeze(performance.now());
          startLoop();
        } else if (!sneezeTimerRef.current) {
          // Windup in progress, schedule recoil burst at 350ms
          sneezeTimerRef.current = setTimeout(() => {
            sneezeTriggeredRef.current = true;
            sneezeTimerRef.current = null;
            spawnSneeze(performance.now());
            startLoop();
          }, 350);
        }
      }
    } else {
      sneezeTriggeredRef.current = false;
      if (sneezeTimerRef.current) {
        clearTimeout(sneezeTimerRef.current);
        sneezeTimerRef.current = null;
      }
    }

    prevStatusRef.current = status;
    prevSneezeCountRef.current = sneezeCount;
  }, [status, sneezeCount, sneezeWindupText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (sneezeTimerRef.current !== null) {
        clearTimeout(sneezeTimerRef.current);
        sneezeTimerRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${cornerRadius}px`,
        zIndex: 15,
        overflow: "hidden",
      }}
    />
  );
};
