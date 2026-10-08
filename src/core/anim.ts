// Coucou Spring Physics & Easing Helpers
// Direct port of Coucou's anim.ts & BotEngine.swift `enum Ease`
// Uses exact SwiftUI `.spring(response: 0.5, dampingFraction: 0.72)` physics

export const Ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => {
    const c1 = 1.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  lin: (t: number) => t,
  easeIn: (t: number) => t * t * t,
};

export type EaseFn = (t: number) => number;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);

/** cubic-bezier(0.45, 0, 0.2, 1) — Coucou's 340ms close curve */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const cx = (t: number) => (1 - t) ** 2 * 3 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t: number) => (1 - t) ** 2 * 3 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 12; i++) {
      const v = cx(t);
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return cy(t);
  };
}

export const closeCurve = cubicBezier(0.45, 0, 0.2, 1);

/**
 * SwiftUI-equivalent spring: ω₀ = 2π / response, ζ = dampingFraction.
 * Sub-stepped integration so animation remains rock-solid at 60/120fps.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  omega: number;
  zeta: number;

  constructor(value: number, response = 0.5, damping = 0.72) {
    this.value = value;
    this.target = value;
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  setTarget(target: number) {
    this.target = target;
  }

  snapTo(v: number) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  step(dt: number): boolean {
    const d = this.value - this.target;
    if (Math.abs(d) < 0.05 && Math.abs(this.velocity) < 0.05) {
      this.value = this.target;
      this.velocity = 0;
      return false; // settled
    }

    const sub = 4;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const acc = -2 * this.zeta * this.omega * this.velocity - this.omega * this.omega * (this.value - this.target);
      this.velocity += acc * h;
      this.value += this.velocity * h;
    }
    return true; // still moving
  }
}
