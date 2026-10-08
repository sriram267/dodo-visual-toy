import React, { useEffect, useRef } from "react";

interface IslandParticlesProps {
  width: number;
  height: number;
  cornerRadius: number;
  status: "idle" | "ready" | "ingesting" | "satisfied" | "sneezing";
  isExpanded?: boolean;
}

// ── Coucou-Inspired Curated Palettes ──
// Sucking in (Ingest): Warm electric yellows and golden sparks
const INGEST_COLORS = [
  "#FEF08A", // Light yellow highlight
  "#FACC15", // Rich amber gold
  "#FDE047", // Vivid electric yellow
  "#F59E0B", // Deep warm gold
  "#FFFBEB", // Pure shimmer white-gold
];

// Sneezing: Vibrant emerald, neon mint, and lime spray
const SNEEZE_COLORS = [
  "#34D399", // Neon mint
  "#22C55E", // Emerald green
  "#4ADE80", // Vibrant bright green
  "#86EFAC", // Light mint sparkle
  "#10B981", // Deep jade
  "#ECFDF5", // Sparkling mist white-green
];

interface IngestParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  speed: number;
  size: number;
  alpha: number;
  color: string;
  isStreak: boolean;
  age: number;
  maxLife: number;
  jitterPhase: number;
  jitterFreq: number;
}

interface SneezeParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  isStreak: boolean;
  age: number;
  maxLife: number;
}

/**
 * Universal continuous pill/capsule clipping path (Coucou rr() geometry)
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
 * Procedural Island Particle Engine (Coucou & Apple Dynamic Island)
 * - Ingesting: Yellow particles stream from the perimeter inwards toward Tusky
 * - Sneezing: Green particles burst from Tusky outwards toward the edges
 * - Strict Capsule Boundary Clipping: 100% contained within the Dynamic Island
 * - High-DPI Retina Sharpness with 0% idle CPU overhead
 */
export const IslandParticles: React.FC<IslandParticlesProps> = ({
  width,
  height,
  cornerRadius,
  status,
  isExpanded = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ingestParticlesRef = useRef<IngestParticle[]>([]);
  const sneezeParticlesRef = useRef<SneezeParticle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const statusRef = useRef(status);
  statusRef.current = status;

  // Track sneeze burst trigger
  const prevStatusRef = useRef(status);

  useEffect(() => {
    // Sneeze impulse trigger: When transitioning into "sneezing", spawn explosive initial burst
    if (status === "sneezing") {
      const mascotX = isExpanded ? 44 : 32;
      const mascotY = height / 2;
      const burstCount = 65;

      const newSneezeParticles: SneezeParticle[] = [];
      for (let i = 0; i < burstCount; i++) {
        // Broad forward spray angle (fanning out across the island)
        const angle =
          (Math.random() - 0.5) * 2.4 + (Math.random() > 0.85 ? Math.PI : 0);
        const speed = 150 + Math.random() * 300;
        const color =
          SNEEZE_COLORS[Math.floor(Math.random() * SNEEZE_COLORS.length)];
        const isStreak = Math.random() > 0.35;

        newSneezeParticles.push({
          x: mascotX + (Math.random() - 0.5) * 6,
          y: mascotY + (Math.random() - 0.5) * 6,
          prevX: mascotX,
          prevY: mascotY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: isStreak ? 1.6 + Math.random() * 1.4 : 1.4 + Math.random() * 2.4,
          alpha: 0.95,
          color,
          isStreak,
          age: 0,
          maxLife: 0.65 + Math.random() * 0.55,
        });
      }
      sneezeParticlesRef.current = [
        ...sneezeParticlesRef.current,
        ...newSneezeParticles,
      ];
    }

    prevStatusRef.current = status;
  }, [status, isExpanded, height]);

  // Main Particle Physics & Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isRunning = true;

    const render = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = now;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = width;
      const h = height;

      // Ensure canvas pixel backing store matches container dimensions
      const targetPxW = Math.round(w * dpr);
      const targetPxH = Math.round(h * dpr);
      if (canvas.width !== targetPxW || canvas.height !== targetPxH) {
        canvas.width = targetPxW;
        canvas.height = targetPxH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // ── Strict Capsule Clipping Boundary ──
      clipCapsule(ctx, w, h, cornerRadius);
      ctx.clip();

      const mascotX = isExpanded ? 44 : 32;
      const mascotY = h / 2;

      // ─────────────────────────────────────────────────────────────
      // 1. INGEST PARTICLES (Yellow: Edges -> Mascot)
      // ─────────────────────────────────────────────────────────────
      if (statusRef.current === "ingesting") {
        // Continuous spawn rate while ingesting (~4 to 7 particles per frame)
        const spawnCount = 5;
        for (let i = 0; i < spawnCount; i++) {
          let spawnX = 0;
          let spawnY = 0;

          // Pick a random edge location along the perimeter
          const edge = Math.random();
          if (edge < 0.35) {
            // Top edge
            spawnX = Math.random() * w;
            spawnY = Math.random() * 3;
          } else if (edge < 0.70) {
            // Bottom edge
            spawnX = Math.random() * w;
            spawnY = h - Math.random() * 3;
          } else if (edge < 0.90) {
            // Right pill curve/edge
            spawnX = w - Math.random() * 5;
            spawnY = Math.random() * h;
          } else {
            // Far left edge (behind mascot)
            spawnX = Math.random() * 8;
            spawnY = Math.random() * h;
          }

          const color =
            INGEST_COLORS[Math.floor(Math.random() * INGEST_COLORS.length)];
          const isStreak = Math.random() > 0.3;

          ingestParticlesRef.current.push({
            x: spawnX,
            y: spawnY,
            prevX: spawnX,
            prevY: spawnY,
            speed: 130 + Math.random() * 190,
            size: isStreak ? 1.4 + Math.random() * 1.0 : 1.0 + Math.random() * 2.0,
            alpha: 0.1, // Fade in
            color,
            isStreak,
            age: 0,
            maxLife: 0.9 + Math.random() * 0.4,
            jitterPhase: Math.random() * Math.PI * 2,
            jitterFreq: 6 + Math.random() * 8,
          });
        }
      }

      // Update and draw Ingest Particles
      const nextIngest: IngestParticle[] = [];
      for (const p of ingestParticlesRef.current) {
        p.age += dt;
        p.prevX = p.x;
        p.prevY = p.y;

        const dx = mascotX - p.x;
        const dy = mascotY - p.y;
        const dist = Math.hypot(dx, dy);

        // Disappear if sucked into mascot's mouth / center
        if (dist < 7 || p.age >= p.maxLife) {
          continue;
        }

        // Acceleration toward mascot: vacuum suction speeds up as particles get closer
        const suctionMult = 1 + Math.max(0, 1 - dist / (w * 0.75)) * 1.8;
        const moveDist = p.speed * suctionMult * dt;

        const ux = dx / dist;
        const uy = dy / dist;

        // Subtle lateral sinusoidal jitter for organic fluid suction
        const perpX = -uy;
        const perpY = ux;
        const jitter =
          Math.sin(p.age * p.jitterFreq + p.jitterPhase) * (dist > 30 ? 1.2 : 0.4);

        p.x += ux * moveDist + perpX * jitter;
        p.y += uy * moveDist + perpY * jitter;

        // Fade in quickly, remain bright, then fade out upon arrival at mascot
        const lifeFraction = p.age / p.maxLife;
        let alpha = p.alpha;
        if (lifeFraction < 0.15) {
          alpha = lifeFraction / 0.15;
        } else if (dist < 28) {
          alpha = Math.max(0, dist / 28);
        } else {
          alpha = 0.92;
        }
        p.alpha = alpha;

        // Draw Ingest Particle
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

        if (p.isStreak) {
          // Directional Speed Streak pointing toward Tusky
          const streakLen = Math.min(16, Math.max(5, moveDist * 2.2));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 4;

          ctx.beginPath();
          ctx.moveTo(p.x - ux * streakLen, p.y - uy * streakLen);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          // Shimmering Golden Dust Dot / Sparkle
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 3;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        nextIngest.push(p);
      }
      ingestParticlesRef.current = nextIngest;

      // ─────────────────────────────────────────────────────────────
      // 2. SNEEZE PARTICLES (Green: Mascot -> Outward Edges)
      // ─────────────────────────────────────────────────────────────
      if (statusRef.current === "sneezing") {
        // Continuous secondary sneeze mist while sneeze is active
        const mistCount = 5;
        for (let i = 0; i < mistCount; i++) {
          const angle =
            (Math.random() - 0.5) * 2.4 + (Math.random() > 0.85 ? Math.PI : 0);
          const speed = 130 + Math.random() * 260;
          const color =
            SNEEZE_COLORS[Math.floor(Math.random() * SNEEZE_COLORS.length)];
          const isStreak = Math.random() > 0.35;

          sneezeParticlesRef.current.push({
            x: mascotX + (Math.random() - 0.5) * 6,
            y: mascotY + (Math.random() - 0.5) * 6,
            prevX: mascotX,
            prevY: mascotY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: isStreak ? 1.6 + Math.random() * 1.4 : 1.3 + Math.random() * 2.4,
            alpha: 0.95,
            color,
            isStreak,
            age: 0,
            maxLife: 0.6 + Math.random() * 0.5,
          });
        }
      }

      // Update and draw Sneeze Particles
      const nextSneeze: SneezeParticle[] = [];
      for (const p of sneezeParticlesRef.current) {
        p.age += dt;
        p.prevX = p.x;
        p.prevY = p.y;

        // Aerodynamic deceleration (air resistance)
        p.vx *= 0.95;
        p.vy *= 0.95;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.age >= p.maxLife) {
          continue;
        }

        // Fade out as life expires or as it reaches edges
        const lifeFraction = p.age / p.maxLife;
        p.alpha = Math.max(0, 1 - lifeFraction);

        // Draw Sneeze Particle
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

        if (p.isStreak) {
          // Outward blast streak oriented along velocity vector
          const vel = Math.hypot(p.vx, p.vy);
          const ux = vel > 0 ? p.vx / vel : 1;
          const uy = vel > 0 ? p.vy / vel : 0;
          const streakLen = Math.min(24, Math.max(5, vel * 0.07));

          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;

          ctx.beginPath();
          ctx.moveTo(p.x - ux * streakLen, p.y - uy * streakLen);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          // Glowing Green Mist Droplet / Sparkle
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 4;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        nextSneeze.push(p);
      }
      sneezeParticlesRef.current = nextSneeze;

      ctx.restore();

      // Continue animating if status is active OR there are still live in-flight particles
      if (
        statusRef.current === "ingesting" ||
        statusRef.current === "sneezing" ||
        ingestParticlesRef.current.length > 0 ||
        sneezeParticlesRef.current.length > 0
      ) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        // Idling: clear canvas completely to free memory and suspend loop
        ctx.clearRect(0, 0, w, h);
        animFrameRef.current = null;
      }
    };

    // Trigger or continue animation loop if active
    if (
      status === "ingesting" ||
      status === "sneezing" ||
      ingestParticlesRef.current.length > 0 ||
      sneezeParticlesRef.current.length > 0
    ) {
      lastTimeRef.current = performance.now();
      if (!animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    }

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [width, height, cornerRadius, status, isExpanded]);

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
