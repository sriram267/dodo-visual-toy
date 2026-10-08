import { useState, useEffect, useRef, useCallback } from "react";
import { soundEngine } from "../core/soundEngine";

// ============================================================================
// TUNABLE ANIMATION PARAMETERS (Aerodynamic Streamline Suction Parameters)
// ============================================================================
export const FUNNEL_POWER = 1.0;       // Proportional convergence along streamlines (zero squished collisions)
export const DURATION = 950;           // Base travel duration per piece in milliseconds
export const STAGGER_SPREAD = 480;     // Max stagger spread for multi-line selections
export const STRETCH_AMOUNT = 0.8;     // Aerodynamic elongation along travel (subtle so text stays readable)
export const END_SCALE = 0.38;         // Final scale at trunk tip (kept clearly visible and legible)

export const SWALLOW_CONFIG = {
  FUNNEL_POWER,
  DURATION_MS: DURATION,
  STAGGER_SPREAD_MS: STAGGER_SPREAD,
  STRETCH_AMOUNT,
  END_SCALE,
  FADE_START: 0.94,        // Progress (0..1) where piece starts fading into nozzle (visible until entry)
  PULL_ACCELERATION: 1.4,  // Non-linear easing power (slow start, accelerating into trunk)
  GULP_DELAY_MS: 500,      // Synchronized gulp trigger as stream arrives at nozzle
  GULP_DURATION_MS: 500,   // Duration of trunk gulp bulge animation
};

export interface ActiveTextPiece {
  id: string;
  index: number;
  text: string;
  startRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  style: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color: string;
    letterSpacing: string;
  };
  center: { x: number; y: number };
  longOffset: number; // Longitudinal distance along funnel axis
  latOffset: number;  // Lateral perpendicular distance from axis
  lane: number;       // Normalized horizontal offset -1..1
  distToTrunk: number;// Euclidean distance to trunk tip
  delay: number;      // Stagger delay based on distance
  duration: number;   // Duration
}

// Backward-compatibility alias
export type ActiveTextChunk = ActiveTextPiece;

export interface SwallowedSnippet {
  id: string;
  text: string;
  timestamp: number;
  pieces: ActiveTextPiece[];
  rect: { left: number; top: number; width: number; height: number };
}

export interface UseSwallowTextReturn {
  activePieces: ActiveTextPiece[];
  activeChunks: ActiveTextPiece[]; // Backward-compatibility alias
  isSwallowing: boolean;
  status: "idle" | "ready" | "ingesting" | "satisfied" | "sneezing";
  gulpProgress: number; // 0 (idle), 0..1 (bulge traveling up trunk)
  isIslandNudged: boolean;
  targetCoords: { x: number; y: number } | null;
  ingestedChars: number;
  ingestedBytes: number;
  hasSelection: boolean;
  selectedPreview: string;
  triggerSwallow: () => void;
  // Sneeze & Trunk Stash additions:
  swallowedStack: SwallowedSnippet[];
  sneezeSnippet: (id?: string) => void;
  sneezeCount: number;
  hoveredSnippetId: string | null;
  setHoveredSnippetId: (id: string | null) => void;
  sneezeWindupText: string | null;
  drySniffleText: string | null;
  registerPieceNode: (id: string, node: HTMLDivElement | null) => void;
  registerChunkNode: (id: string, node: HTMLDivElement | null) => void; // Backward-compatibility alias
}

/**
 * Extracts per-word spans (or per-character if very short) from a DOM Range,
 * measuring exact pixel bounding boxes for seamless 1:1 overlay placement.
 */
function extractSelectionPieces(
  range: Range,
  compStyle: CSSStyleDeclaration | null
): Omit<ActiveTextPiece, "longOffset" | "latOffset" | "lane" | "distToTrunk" | "delay" | "duration">[] {
  const pieces: Omit<
    ActiveTextPiece,
    "longOffset" | "latOffset" | "lane" | "distToTrunk" | "delay" | "duration"
  >[] = [];

  const fullText = range.toString().trim();
  if (!fullText) return pieces;

  const style = {
    fontFamily: compStyle?.fontFamily || "-apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: compStyle?.fontSize || "14px",
    fontWeight: compStyle?.fontWeight || "400",
    lineHeight: compStyle?.lineHeight || "1.5",
    color: compStyle?.color || "#111318",
    letterSpacing: compStyle?.letterSpacing || "normal",
  };

  // Always split cleanly by whole words so words stay together as intact, readable units (no chaotic letter splitting)
  const splitRegex = /\S+/g;

  // Collect text nodes: handles both text node commonAncestor and element commonAncestor
  const textNodes: Node[] = [];
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    textNodes.push(range.commonAncestorContainer);
  } else {
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );
    let node: Node | null;
    while ((node = treeWalker.nextNode())) {
      textNodes.push(node);
    }
  }

  let pieceIndex = 0;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    const nodeStart = textNode === range.startContainer ? range.startOffset : 0;
    const nodeEnd = textNode === range.endContainer ? range.endOffset : text.length;

    let match: RegExpExecArray | null;
    splitRegex.lastIndex = 0;

    while ((match = splitRegex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      if (matchEnd <= nodeStart || matchStart >= nodeEnd) continue;

      const clampedStart = Math.max(matchStart, nodeStart);
      const clampedEnd = Math.min(matchEnd, nodeEnd);

      try {
        const subRange = document.createRange();
        subRange.setStart(textNode, clampedStart);
        subRange.setEnd(textNode, clampedEnd);

        const rects = Array.from(subRange.getClientRects()).filter(
          (r) => r.width > 0.5 && r.height > 0.5
        );

        for (const rect of rects) {
          const idx = pieceIndex++;
          pieces.push({
            id: `piece-${idx}-${Date.now()}`,
            index: idx,
            text: match[0],
            startRect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            },
            style,
            center: {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            },
          });
        }
      } catch {
        // Fallback gracefully on boundary error
      }
    }
  }

  // Fallback for single rect or complex DOM nodes where TreeWalker yields 0 rects
  if (pieces.length === 0) {
    const fallbackRect = range.getBoundingClientRect();
    if (fallbackRect.width > 0 && fallbackRect.height > 0) {
      pieces.push({
        id: `piece-fallback-${Date.now()}`,
        index: 0,
        text: fullText,
        startRect: {
          left: fallbackRect.left,
          top: fallbackRect.top,
          width: fallbackRect.width,
          height: fallbackRect.height,
        },
        style,
        center: {
          x: fallbackRect.left + fallbackRect.width / 2,
          y: fallbackRect.top + fallbackRect.height / 2,
        },
      });
    }
  }

  return pieces;
}

export type FunnelDirection = "swallow" | "sneeze";

export interface FunnelTransformResult {
  posX: number;
  posY: number;
  deltaX: number;
  deltaY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  tEased: number;
}

/**
 * Shared Mathematical Funnel Transform Engine.
 * Parameterized by direction: "swallow" (converging funnel) | "sneeze" (diverging reverse funnel).
 *
 * Kinematics:
 * - Direction === "sneeze":
 *     axisPoint = lerp(trunkTip, selCenter, t)
 *     longitudinalOffset = dParallel * t * uAxis
 *     lateralOffset = dPerp * t^FUNNEL_POWER * uPerp
 *     position = axisPoint + longitudinalOffset + lateralOffset
 *     scale = 0.10 -> 1.0 along the way
 *     rotation = travelAngle * (1 - t)^1.4 (aligned away from tip at start, easing to 0 on landing)
 *     stretch = 1 + STRETCH_AMOUNT * (1 - t)^1.3 (elongated at start, easing to 1.0 on landing)
 * - Direction === "swallow":
 *     axisPoint = lerp(selCenter, trunkTip, t)
 *     longitudinalOffset = dParallel * (1 - t) * uAxis
 *     lateralOffset = dPerp * (1 - t)^FUNNEL_POWER * uPerp
 *     position = axisPoint + longitudinalOffset + lateralOffset - liftArc
 *     scale = 1.0 -> END_SCALE (0.38)
 *     rotation = travelAngle * 0.25 * sin(t^1.15 * PI)
 */
export function evaluateFunnelTransform(
  piece: ActiveTextPiece,
  rawProgress: number,
  selCenter: { x: number; y: number },
  trunkTip: { x: number; y: number },
  direction: FunnelDirection,
  options?: {
    funnelPower?: number;
    stretchAmount?: number;
    startScale?: number;
    endScale?: number;
  }
): FunnelTransformResult {
  const p = Math.max(0, Math.min(1, rawProgress));
  const funnelPower = options?.funnelPower ?? FUNNEL_POWER;
  const stretchAmount = options?.stretchAmount ?? STRETCH_AMOUNT;

  // 1. Primary Axis vector from trunk tip to selection center
  const axisDx = selCenter.x - trunkTip.x;
  const axisDy = selCenter.y - trunkTip.y;
  const axisLen = Math.hypot(axisDx, axisDy) || 1;
  const uAxisX = axisDx / axisLen;
  const uAxisY = axisDy / axisLen;

  // 2. Perpendicular normal unit vector (strictly orthogonal)
  const uPerpX = -uAxisY;
  const uPerpY = uAxisX;

  // 3. Decompose piece's original page centroid relative to selection center
  const dx = piece.center.x - selCenter.x;
  const dy = piece.center.y - selCenter.y;
  const dParallel = dx * uAxisX + dy * uAxisY; // coordinate along axis
  const dPerp = dx * uPerpX + dy * uPerpY;     // coordinate perpendicular to axis

  if (direction === "sneeze") {
    // Easing: gentle start so cone visibly opens from the point, soft ease-out settling onto spots without bouncing
    // Smoothstep: 3p^2 - 2p^3
    const tEased = p * p * (3 - 2 * p);

    // Axis interpolation from trunk tip to selection center
    const axisX = trunkTip.x + (selCenter.x - trunkTip.x) * tEased;
    const axisY = trunkTip.y + (selCenter.y - trunkTip.y) * tEased;

    // Lateral spread widens gradually from zero into a cone: t^FUNNEL_POWER
    const lateralFactor = Math.pow(tEased, funnelPower);
    // Longitudinal spread opens smoothly along axis, maintaining vertical/line order
    const longitudinalFactor = tEased;

    const posX = axisX + dParallel * longitudinalFactor * uAxisX + dPerp * lateralFactor * uPerpX;
    const posY = axisY + dParallel * longitudinalFactor * uAxisY + dPerp * lateralFactor * uPerpY;
    const deltaX = posX - piece.center.x;
    const deltaY = posY - piece.center.y;

    // Scale: 0.10 at t=0 (single point mass) -> 1.0 at t=1 (full size)
    const startScale = options?.startScale ?? 0.10;
    const baseScale = startScale + (1.0 - startScale) * tEased;

    // Direction of travel away from the trunk tip:
    // Compute streamline deflection angle from vertical downward travel axis
    const travelDx = piece.center.x - trunkTip.x;
    const travelDy = Math.max(30, piece.center.y - trunkTip.y);
    // Deflection angle in degrees (negative for left flare, positive for right flare)
    const streamlineAngle = -(Math.atan2(travelDx, travelDy) * (180 / Math.PI));

    // Rotate to align with cone streamline ray at start, ease rotation to 0 as it arrives
    const rot = streamlineAngle * Math.pow(1 - tEased, 1.4);

    // Stretch along direction of travel at start, ease stretch to 1.0 as it arrives
    const currentStretch = 1 + stretchAmount * Math.pow(1 - tEased, 1.3);
    const scaleX = baseScale * currentStretch;
    const scaleY = baseScale / Math.sqrt(currentStretch);

    // Opacity: full visibility throughout burst; gentle settle at very end
    let opacity = 1;
    if (p > 0.94) {
      opacity = Math.max(0, (1 - p) / 0.06);
    }

    return {
      posX,
      posY,
      deltaX,
      deltaY,
      scaleX,
      scaleY,
      rotation: rot,
      opacity,
      tEased,
    };
  } else {
    // direction === "swallow"
    // Pull acceleration easing into the nozzle
    const tEased = Math.pow(p, SWALLOW_CONFIG.PULL_ACCELERATION);

    const axisX = selCenter.x + (trunkTip.x - selCenter.x) * tEased;
    const axisY = selCenter.y + (trunkTip.y - selCenter.y) * tEased;

    // Lateral spread narrows into trunk tip: (1 - t)^FUNNEL_POWER
    const lateralFactor = Math.pow(1 - tEased, funnelPower);
    const longitudinalFactor = 1 - tEased;

    // Aerodynamic upward lift arc
    const arcAmount = Math.min(26, Math.max(10, (piece.center.y - trunkTip.y) * 0.08));
    const arcY = Math.sin(Math.pow(tEased, 0.95) * Math.PI) * arcAmount;

    const posX = axisX + dParallel * longitudinalFactor * uAxisX + dPerp * lateralFactor * uPerpX;
    const posY = axisY + dParallel * longitudinalFactor * uAxisY + dPerp * lateralFactor * uPerpY - arcY;
    const deltaX = posX - piece.center.x;
    const deltaY = posY - piece.center.y;

    const endScale = options?.endScale ?? SWALLOW_CONFIG.END_SCALE;
    const baseScale = 1 - tEased * (1 - endScale);

    // Travel angle towards trunk tip
    const travelDx = trunkTip.x - piece.center.x;
    const travelDy = trunkTip.y - piece.center.y;
    let travelAngle = Math.atan2(travelDy, travelDx) * (180 / Math.PI);
    if (travelAngle > 90) travelAngle -= 180;
    if (travelAngle < -90) travelAngle += 180;

    const spinEnvelope = Math.sin(Math.pow(tEased, 1.15) * Math.PI);
    const rot = travelAngle * 0.25 * spinEnvelope;

    const currentStretch = 1 + stretchAmount * 0.6 * spinEnvelope;
    const scaleX = baseScale * currentStretch;
    const scaleY = baseScale / Math.sqrt(currentStretch);

    let opacity = 1;
    if (tEased >= SWALLOW_CONFIG.FADE_START) {
      opacity = Math.max(0, (1 - tEased) / (1 - SWALLOW_CONFIG.FADE_START));
    }

    return {
      posX,
      posY,
      deltaX,
      deltaY,
      scaleX,
      scaleY,
      rotation: rot,
      opacity,
      tEased,
    };
  }
}

/**
 * Hook to manage the Funnel Suction of selected text into Tusky's trunk tip.
 *
 * Mathematical Funnel Specification:
 * - Single funnel axis: lerp(selectionCenter, trunkTip, t)
 * - Lateral offset: lane * (selectionWidth / 2) * (1 - t)^FUNNEL_POWER
 * - Converges exactly to zero spread at trunk tip
 * - Staggers by distance: closest pieces to trunk launch first
 * - Rotates and stretches along travel direction
 * - Vanishes by clipping/fading at the tip nozzle (zero pops)
 * - Zero visible funnel walls, beams, or glows: the text itself forms the funnel.
 */
export function useSwallowText(): UseSwallowTextReturn {
  const [activePieces, setActivePieces] = useState<ActiveTextPiece[]>([]);
  const [status, setStatus] = useState<"idle" | "ready" | "ingesting" | "satisfied" | "sneezing">("idle");
  const [gulpProgress, setGulpProgress] = useState(0);
  const [isIslandNudged, setIsIslandNudged] = useState(false);
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState("");
  const [ingestedChars, setIngestedChars] = useState(0);
  const [ingestedBytes, setIngestedBytes] = useState(0);

  // ── Trunk Stash Stack & Sneeze States ──
  const [swallowedStack, setSwallowedStack] = useState<SwallowedSnippet[]>([]);
  const [hoveredSnippetId, setHoveredSnippetId] = useState<string | null>(null);
  const [sneezeWindupText, setSneezeWindupText] = useState<string | null>(null);
  const [drySniffleText, setDrySniffleText] = useState<string | null>(null);
  const [sneezeCount, setSneezeCount] = useState<number>(0);

  const sneezeClosingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drySniffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSneezeTriggerTimeRef = useRef<number>(0);
  const swallowedStackRef = useRef<SwallowedSnippet[]>([]);
  useEffect(() => {
    swallowedStackRef.current = swallowedStack;
  }, [swallowedStack]);

  // Map of active DOM elements for 60fps transform-only animation
  const pieceNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const runIdRef = useRef<number>(0);

  // Live destination anchor at Tusky's trunk tip
  const getTrunkTipScreenPos = useCallback((): { x: number; y: number } => {
    const tipEl =
      document.querySelector("#tusky-trunk-tip-anchor") ||
      document.querySelector("[data-tusky-tip='true']");
    if (tipEl) {
      const rect = tipEl.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
    // Fallback to notch tip
    return {
      x: window.innerWidth / 2 - 35,
      y: 28,
    };
  }, []);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Monitor DOM selection with 60ms debounce for rock-solid READY state without flickering
  useEffect(() => {
    const handleSelectionChange = () => {
      // If currently swallowing, don't interrupt mid-flight
      if (statusRef.current === "ingesting") return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (statusRef.current === "ingesting") return;

        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setHasSelection(false);
          setSelectedPreview("");
          setTargetCoords(null);
          setStatus("idle");
          return;
        }

        const text = sel.toString().trim();
        if (!text) {
          setHasSelection(false);
          setSelectedPreview("");
          setTargetCoords(null);
          setStatus("idle");
          return;
        }

        // Validate selection container: ignore selections inside the dynamic island, mascot, or inputs
        try {
          const range = sel.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const el = (
            container.nodeType === Node.ELEMENT_NODE
              ? container
              : container.parentElement
          ) as HTMLElement | null;

          if (el) {
            // Ignore selections inside the island or mascot
            if (
              el.closest(".island-wrapper") ||
              el.closest("[data-island='true']") ||
              el.closest("#tusky-anchor-wrapper")
            ) {
              setHasSelection(false);
              setSelectedPreview("");
              setTargetCoords(null);
              setStatus("idle");
              return;
            }

            // Ignore inputs / textareas / contenteditable EXCEPT tusky scratchpad
            const isScratchpad = el.closest(".tusky-scratchpad");
            if (!isScratchpad && el.closest("input, textarea, [contenteditable='true']")) {
              setHasSelection(false);
              setSelectedPreview("");
              setTargetCoords(null);
              setStatus("idle");
              return;
            }
          }

          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setHasSelection(true);
            setSelectedPreview(text.slice(0, 32));
            setTargetCoords({
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
            setStatus("ready");
          }
        } catch {
          // Range collapsed or unmeasurable
          setHasSelection(false);
          setSelectedPreview("");
          setTargetCoords(null);
          setStatus("idle");
        }
      }, 60);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [status]);

  // Main Swallow Trigger
  const triggerSwallow = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    const fullText = sel.toString().trim();
    const range = sel.getRangeAt(0);

    // 1. Extract common ancestor computed styles
    const container = range.commonAncestorContainer;
    const element = (container.nodeType === Node.ELEMENT_NODE
      ? container
      : container.parentElement) as HTMLElement | null;
    const compStyle = element ? window.getComputedStyle(element) : null;

    // 2. Split into per-word / per-character pieces positioned over exact coordinates
    const rawPieces = extractSelectionPieces(range, compStyle);
    if (rawPieces.length === 0) return;

    // 3. Selection Bounding Box & Centroid
    const selRect = range.getBoundingClientRect();
    const selCenter = {
      x: selRect.left + selRect.width / 2,
      y: selRect.top + selRect.height / 2,
    };
    const trunkTip = getTrunkTipScreenPos();

    // 4. Compute relative offsets from selection centroid and distance to trunk
    const pieces: ActiveTextPiece[] = rawPieces.map((p) => {
      const distToTrunk = Math.hypot(trunkTip.x - p.center.x, trunkTip.y - p.center.y);
      const lane = Math.max(-1, Math.min(1, (p.center.x - trunkTip.x) / (window.innerWidth / 3)));

      return {
        ...p,
        longOffset: p.center.x - selCenter.x,
        latOffset: p.center.y - selCenter.y,
        lane,
        distToTrunk,
        delay: 0,
        duration: SWALLOW_CONFIG.DURATION_MS,
      };
    });

    // 5. Cascade Stagger along Streamlines:
    // Closest words to the trunk take off first, followed progressively by trailing words.
    // This creates the natural, fluid liquid stream / funnel tapering into the nozzle.
    const distances = pieces.map((p) => p.distToTrunk);
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    const distRange = Math.max(1, maxDist - minDist);

    pieces.forEach((p, idx) => {
      const distRatio = (p.distToTrunk - minDist) / distRange;
      p.delay = distRange > 30 ? distRatio * 180 : idx * 18;
    });

    // Clear any previous sneeze closing line immediately on swallow
    if (sneezeClosingTimeoutRef.current) {
      clearTimeout(sneezeClosingTimeoutRef.current);
      sneezeClosingTimeoutRef.current = null;
    }
    setDrySniffleText(null);

    // Cancel any previous run gracefully
    runIdRef.current++;
    const currentRunId = runIdRef.current;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Telemetry updates
    setIngestedChars((prev) => prev + fullText.length);
    setIngestedBytes((prev) => prev + new Blob([fullText]).size);

    // Push into Trunk Stash Stack (LIFO: most recent first)
    const newSnippet: SwallowedSnippet = {
      id: `snack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: fullText,
      timestamp: Date.now(),
      pieces,
      rect: {
        left: selRect.left,
        top: selRect.top,
        width: selRect.width,
        height: selRect.height,
      },
    };
    setSwallowedStack((prev) => [newSnippet, ...prev]);

    setStatus("ingesting");
    setIsIslandNudged(true);
    setActivePieces(pieces);

    // 100% Procedural aerodynamic vacuum whoosh (pink noise + sweeping resonant bandpass)
    soundEngine.playVacuumWhoosh(SWALLOW_CONFIG.DURATION_MS);

    if (prefersReducedMotion) {
      setTimeout(() => {
        if (runIdRef.current === currentRunId) {
          setActivePieces([]);
          setIsIslandNudged(false);
          setStatus("satisfied");
          setTimeout(() => setStatus("idle"), 500);
        }
      }, 250);
      return;
    }

    // ── 60FPS COMPOSITOR FUNNEL ANIMATION LOOP ──
    const launchTime = performance.now();
    const maxDelay = Math.max(...pieces.map((p) => p.delay));
    const totalFlightTime = maxDelay + SWALLOW_CONFIG.DURATION_MS;
    let gulpSoundPlayed = false;

    const loop = (now: number) => {
      if (runIdRef.current !== currentRunId) return;

      const elapsed = now - launchTime;
      let allFinished = true;

      // Live trunk tip destination (recomputed dynamically for resize / island shifts)
      const target = getTrunkTipScreenPos();

      // Trigger Gulp bulge and bubble gulp sound as stream begins arriving at the tip
      if (elapsed > SWALLOW_CONFIG.GULP_DELAY_MS) {
        if (!gulpSoundPlayed) {
          gulpSoundPlayed = true;
          soundEngine.playBubbleGulp();
        }
        const gulpTime = elapsed - SWALLOW_CONFIG.GULP_DELAY_MS;
        const gp = Math.min(1, gulpTime / SWALLOW_CONFIG.GULP_DURATION_MS);
        setGulpProgress(gp);
      } else {
        setGulpProgress(0);
      }

      pieces.forEach((piece) => {
        const pieceElapsed = elapsed - piece.delay;
        const node = pieceNodesRef.current.get(piece.id);

        if (!node) return;

        if (pieceElapsed <= 0) {
          // Waiting for stagger: stays exactly at original page coordinates
          allFinished = false;
          node.style.transform = `translate3d(0, 0, 0) rotate(0deg) scale(1, 1)`;
          node.style.opacity = "1";
          node.style.display = "inline-flex";
          return;
        }

        const rawProgress = Math.min(1, pieceElapsed / piece.duration);
        if (rawProgress < 1) {
          allFinished = false;
        } else {
          // Finished: vanish into the nozzle, zero pops
          node.style.opacity = "0";
          node.style.display = "none";
          return;
        }

        // Shared funnel evaluation for swallow
        const transform = evaluateFunnelTransform(piece, rawProgress, selCenter, target, "swallow");

        // Apply hardware-accelerated transform & opacity ONLY (60fps, gradual shrink + funnel flow)
        node.style.transform = `translate3d(${transform.deltaX.toFixed(2)}px, ${transform.deltaY.toFixed(2)}px, 0) scale(${transform.scaleX.toFixed(3)}, ${transform.scaleY.toFixed(3)}) rotate(${transform.rotation.toFixed(2)}deg)`;
        node.style.opacity = transform.opacity.toFixed(3);
        node.style.display = "inline-flex";
      });

      if (elapsed < totalFlightTime + 80 && !allFinished) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        // Complete flight: unmount all overlay elements cleanly from DOM
        setActivePieces([]);
        pieceNodesRef.current.clear();
        setIsIslandNudged(false);
        setGulpProgress(0);
        setStatus("satisfied");

        setHasSelection(false);
        setSelectedPreview("");

        setTimeout(() => {
          if (runIdRef.current === currentRunId) {
            setStatus("idle");
          }
        }, 400);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [getTrunkTipScreenPos]);

  // ── Sneeze Reverse-Swallow Implementation (Inhale Wind-up + Exact Reverse Funnel Blow-out) ──
  const sneezeSnippet = useCallback(
    (snippetId?: string) => {
      const now = performance.now();
      if (now - lastSneezeTriggerTimeRef.current < 60) return;
      lastSneezeTriggerTimeRef.current = now;

      // Clear any pending timeouts immediately
      if (sneezeClosingTimeoutRef.current) {
        clearTimeout(sneezeClosingTimeoutRef.current);
        sneezeClosingTimeoutRef.current = null;
      }
      if (drySniffleTimeoutRef.current) {
        clearTimeout(drySniffleTimeoutRef.current);
        drySniffleTimeoutRef.current = null;
      }

      // Immediately clear existing sniffle banners
      setDrySniffleText(null);

      if (swallowedStack.length === 0) {
        soundEngine.playDrySniffle();
        setDrySniffleText("Nothing to sneeze yet");
        drySniffleTimeoutRef.current = setTimeout(() => setDrySniffleText(null), 1600);
        return;
      }

      const targetSnippet = snippetId
        ? swallowedStack.find((s) => s.id === snippetId) || swallowedStack[0]
        : swallowedStack[0];

      // Remove popped item from stash
      setSwallowedStack((prev) => prev.filter((s) => s.id !== targetSnippet.id));

      runIdRef.current++;
      const currentRunId = runIdRef.current;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const trunkTip = getTrunkTipScreenPos();
      const sneezeRunId = Date.now();
      const sneezePieces: ActiveTextPiece[] = targetSnippet.pieces.map((p, idx) => ({
        ...p,
        id: `sneeze-${p.id}-${sneezeRunId}-${idx}`,
        distToTrunk: Math.hypot(trunkTip.x - p.center.x, trunkTip.y - p.center.y),
      }));

      // Selection centroid target
      const selCenter =
        targetSnippet.rect && targetSnippet.rect.width > 0
          ? {
              x: targetSnippet.rect.left + targetSnippet.rect.width / 2,
              y: targetSnippet.rect.top + targetSnippet.rect.height / 2,
            }
          : {
              x:
                targetSnippet.pieces.reduce((acc, p) => acc + p.center.x, 0) /
                Math.max(1, targetSnippet.pieces.length),
              y:
                targetSnippet.pieces.reduce((acc, p) => acc + p.center.y, 0) /
                Math.max(1, targetSnippet.pieces.length),
            };

      // Stagger: exact reverse of swallow — farthest words leave FIRST, nearest leave LAST
      const distances = sneezePieces.map((p) => p.distToTrunk);
      const minDist = Math.min(...distances);
      const maxDist = Math.max(...distances);
      const distRange = Math.max(1, maxDist - minDist);
      const SNEEZE_STAGGER_SPREAD = 140; // Total stagger spread matching swallow

      sneezePieces.forEach((p, idx) => {
        const distRatio =
          distRange > 20
            ? (maxDist - p.distToTrunk) / distRange
            : (sneezePieces.length - 1 - idx) / Math.max(1, sneezePieces.length - 1);
        p.delay = distRatio * SNEEZE_STAGGER_SPREAD;
      });

      // Increment sneeze count to trigger fresh CSS keyframe animation cycle in TuskyAnchor
      setSneezeCount((c) => c + 1);

      // Phase 1: Inhale Wind-up (Tusky expands backend and middle part; island shows "Ah... ah...")
      setStatus("sneezing");
      setIsIslandNudged(true);
      setSneezeWindupText("Ah... ah...");
      setActivePieces(sneezePieces);

      const launchTime = performance.now();
      const WINDUP_MS = 380;       // Inhale wind-up duration before explosive sneeze
      const WORD_FLIGHT_MS = 600;  // Flight time per word down the reverse funnel
      const totalSneezeTime = WINDUP_MS + SNEEZE_STAGGER_SPREAD + WORD_FLIGHT_MS;
      let blastSoundPlayed = false;

      // Play rising inhale breath noise
      soundEngine.playSneezeWindup(WINDUP_MS);

      const loop = (now: number) => {
        if (runIdRef.current !== currentRunId) return;
        const elapsed = now - launchTime;
        let allFinished = true;

        // Keep sneeze active with recoil burst indicator during explosive flight
        if (elapsed >= WINDUP_MS) {
          if (!blastSoundPlayed) {
            blastSoundPlayed = true;
            soundEngine.playSneezeBlast();
          }
          setSneezeWindupText("Acchooo! 💨");
        }

        // Live trunk tip
        const currentTip = getTrunkTipScreenPos();

        sneezePieces.forEach((piece) => {
          const node = pieceNodesRef.current.get(piece.id);
          if (!node) return;

          // Before burst begins (wind-up phase):
          if (elapsed < WINDUP_MS) {
            allFinished = false;
            // Pre-position at trunk tip at scale 0.1, kept hidden until burst starts
            const initTransform = evaluateFunnelTransform(piece, 0, selCenter, currentTip, "sneeze");
            node.style.transform = `translate3d(${initTransform.deltaX.toFixed(2)}px, ${initTransform.deltaY.toFixed(2)}px, 0) scale(${initTransform.scaleX.toFixed(3)}, ${initTransform.scaleY.toFixed(3)}) rotate(${initTransform.rotation.toFixed(2)}deg)`;
            node.style.opacity = "0";
            node.style.display = "none";
            return;
          }

          const burstElapsed = elapsed - WINDUP_MS;
          const pieceElapsed = burstElapsed - piece.delay;

          if (pieceElapsed <= 0) {
            // Burst has begun (t = 0 for this piece), waiting for its stagger launch:
            // Located EXACTLY at trunk tip anchor, scale 0.1, so the whole mass forms a single point!
            allFinished = false;
            const apexTransform = evaluateFunnelTransform(piece, 0, selCenter, currentTip, "sneeze");
            node.style.transform = `translate3d(${apexTransform.deltaX.toFixed(2)}px, ${apexTransform.deltaY.toFixed(2)}px, 0) scale(${apexTransform.scaleX.toFixed(3)}, ${apexTransform.scaleY.toFixed(3)}) rotate(${apexTransform.rotation.toFixed(2)}deg)`;
            node.style.opacity = "1";
            node.style.display = "inline-flex";
            return;
          }

          const rawProgress = Math.min(1, pieceElapsed / WORD_FLIGHT_MS);
          if (rawProgress < 1) {
            allFinished = false;
          } else {
            // Touchdown complete onto page
            node.style.opacity = "0";
            node.style.display = "none";
            return;
          }

          // Evaluate reverse funnel transform
          const transform = evaluateFunnelTransform(piece, rawProgress, selCenter, currentTip, "sneeze");
          node.style.transform = `translate3d(${transform.deltaX.toFixed(2)}px, ${transform.deltaY.toFixed(2)}px, 0) scale(${transform.scaleX.toFixed(3)}, ${transform.scaleY.toFixed(3)}) rotate(${transform.rotation.toFixed(2)}deg)`;
          node.style.opacity = transform.opacity.toFixed(3);
          node.style.display = "inline-flex";
        });

        if (elapsed < totalSneezeTime + 60 && !allFinished) {
          animFrameRef.current = requestAnimationFrame(loop);
        } else {
          setActivePieces([]);
          pieceNodesRef.current.clear();
          setIsIslandNudged(false);

          // Hold the single yellow "Acchooo! 💨" banner briefly, then settle directly back to idle
          sneezeClosingTimeoutRef.current = setTimeout(() => {
            if (runIdRef.current === currentRunId) {
              setSneezeWindupText(null);
              setStatus("idle");
            }
          }, 700);
        }
      };

      animFrameRef.current = requestAnimationFrame(loop);
    },
    [swallowedStack, getTrunkTipScreenPos]
  );

  // Hook into native copy & paste events and keyboard shortcuts
  useEffect(() => {
    const handleCopy = () => {
      triggerSwallow();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isScratchpad = target && typeof target.closest === "function" && target.closest(".tusky-scratchpad");
      if (!isScratchpad && target && typeof target.closest === "function" && target.closest("input, textarea, [contenteditable='true']")) return;
      if (swallowedStackRef.current.length > 0) {
        e.preventDefault();
        sneezeSnippet();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isScratchpad = target && typeof target.closest === "function" && target.closest(".tusky-scratchpad");
      if (!isScratchpad && target && typeof target.closest === "function" && target.closest("input, textarea, [contenteditable='true']")) return;

      // ⌘V / Ctrl+V: sneeze back (paste event doesn't fire reliably outside inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        if (swallowedStackRef.current.length > 0) {
          e.preventDefault();
          sneezeSnippet();
        }
      }
      // Note: ⌘C is handled by the document "copy" event listener above,
      // which also fires on mobile long-press → system copy menu.
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [triggerSwallow, sneezeSnippet]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sneezeClosingTimeoutRef.current) clearTimeout(sneezeClosingTimeoutRef.current);
      if (drySniffleTimeoutRef.current) clearTimeout(drySniffleTimeoutRef.current);
    };
  }, []);

  const registerPieceNode = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      pieceNodesRef.current.set(id, node);
    } else {
      pieceNodesRef.current.delete(id);
    }
  }, []);

  // Expose test & frame capture harness for zero-hallucination visual verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__tuskyDebug = {
        triggerSwallow,
        sneezeSnippet,
        getTrunkTip: getTrunkTipScreenPos,
        getSwallowedStack: () => swallowedStack,
        renderFreezeFrame: (tBurst: number, snippetIndex = 0) => {
          if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
          }
          const snippet = swallowedStack[snippetIndex];
          if (!snippet) return false;
          const selCenter =
            snippet.rect && snippet.rect.width > 0
              ? {
                  x: snippet.rect.left + snippet.rect.width / 2,
                  y: snippet.rect.top + snippet.rect.height / 2,
                }
              : {
                  x:
                    snippet.pieces.reduce((acc, p) => acc + p.center.x, 0) /
                    Math.max(1, snippet.pieces.length),
                  y:
                    snippet.pieces.reduce((acc, p) => acc + p.center.y, 0) /
                    Math.max(1, snippet.pieces.length),
                };

          const SNEEZE_STAGGER_SPREAD = 140;
          const WORD_FLIGHT_MS = 600;
          const totalTime = SNEEZE_STAGGER_SPREAD + WORD_FLIGHT_MS;
          const burstElapsed = tBurst * totalTime;

          setStatus("sneezing");
          setActivePieces(snippet.pieces);

          setTimeout(() => {
            const liveTip = getTrunkTipScreenPos();
            snippet.pieces.forEach((piece) => {
              const node = pieceNodesRef.current.get(piece.id);
              if (!node) return;

              const pieceElapsed = burstElapsed - piece.delay;
              if (pieceElapsed <= 0) {
                const apexTransform = evaluateFunnelTransform(piece, 0, selCenter, liveTip, "sneeze");
                node.style.transform = `translate3d(${apexTransform.deltaX.toFixed(2)}px, ${apexTransform.deltaY.toFixed(2)}px, 0) scale(${apexTransform.scaleX.toFixed(3)}, ${apexTransform.scaleY.toFixed(3)}) rotate(${apexTransform.rotation.toFixed(2)}deg)`;
                node.style.opacity = "1";
                node.style.display = "inline-flex";
                return;
              }

              const rawProgress = Math.min(1, pieceElapsed / WORD_FLIGHT_MS);
              const transform = evaluateFunnelTransform(piece, rawProgress, selCenter, liveTip, "sneeze");
              node.style.transform = `translate3d(${transform.deltaX.toFixed(2)}px, ${transform.deltaY.toFixed(2)}px, 0) scale(${transform.scaleX.toFixed(3)}, ${transform.scaleY.toFixed(3)}) rotate(${transform.rotation.toFixed(2)}deg)`;
              node.style.opacity = "1";
              node.style.display = "inline-flex";
            });
          }, 40);
          return true;
        },
      };
    }
  }, [swallowedStack, getTrunkTipScreenPos, triggerSwallow, sneezeSnippet]);

  return {
    activePieces,
    activeChunks: activePieces, // Backward compatibility alias
    isSwallowing: status === "ingesting" || status === "sneezing",
    status,
    gulpProgress,
    isIslandNudged,
    targetCoords,
    ingestedChars,
    ingestedBytes,
    hasSelection,
    selectedPreview,
    triggerSwallow,
    swallowedStack,
    sneezeSnippet,
    sneezeCount,
    hoveredSnippetId,
    setHoveredSnippetId,
    sneezeWindupText,
    drySniffleText,
    registerPieceNode,
    registerChunkNode: registerPieceNode, // Backward compatibility alias
  };
}
