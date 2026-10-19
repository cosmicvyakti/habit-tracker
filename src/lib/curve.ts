/**
 * Asymptotic automaticity curve A(t) = a - b·e^(-ct), with t in days. Source: Lally et al. 2010,
 * who fit this form to each participant's automaticity scores and took the plateau as the
 * day the curve reaches 95% of its asymptote `a`.
 */
export interface CurveFit {
  a: number;
  b: number;
  c: number;
  /** Day the curve reaches 95% of `a`, or null when the data doesn't pin it down. */
  plateauDay: number | null;
  /** Share of the scores' variance the curve explains, 0 to 1. */
  r2: number;
}

export const MIN_POINTS = 3;
// Before the app trusts a fit enough to draw it or name a plateau. The thresholds are the app's own; the rule follows
// Lally et al. 2010, who reported no plateau for participants whose curves fitted poorly.
export const TRUST_MIN_POINTS = 5;
export const TRUST_MIN_SPAN_DAYS = 42;
const TRUST_MIN_R2 = 0.7;
const PLATEAU_SHARE = 0.95;
// Rates outside this range mean the curve has no visible bend in a habit's lifetime.
const C_MIN = 1e-3;
const C_MAX = 1;
const GRID = 200;

export function automaticity(fit: Pick<CurveFit, "a" | "b" | "c">, t: number): number {
  return fit.a - fit.b * Math.exp(-fit.c * t);
}

/** Least-squares a and b for a fixed rate c. */
function solveLinear(points: { t: number; y: number }[], c: number) {
  const n = points.length;
  const xs = points.map((p) => Math.exp(-c * p.t));
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  xs.forEach((x, i) => {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (points[i].y - my);
  });
  if (sxx < 1e-12) return null;
  const slope = sxy / sxx;
  const a = my - slope * mx;
  const b = -slope;
  const sse = points.reduce((s, p, i) => s + (p.y - (a - b * xs[i])) ** 2, 0);
  return { a, b, sse };
}

/** Fit the curve to (day, score) points. Returns null with fewer than 3 points or no spread in time. */
export function fitAutomaticity(points: { t: number; y: number }[]): CurveFit | null {
  if (points.length < MIN_POINTS) return null;
  const sse = (logC: number) => solveLinear(points, Math.exp(logC))?.sse ?? Infinity;

  const lo = Math.log(C_MIN);
  const step = (Math.log(C_MAX) - lo) / (GRID - 1);
  let best = 0;
  for (let i = 1; i < GRID; i++) if (sse(lo + i * step) < sse(lo + best * step)) best = i;
  if (!Number.isFinite(sse(lo + best * step))) return null;

  // Golden-section search between the grid neighbours of the best point.
  let left = lo + Math.max(0, best - 1) * step;
  let right = lo + Math.min(GRID - 1, best + 1) * step;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const m1 = right - g * (right - left);
    const m2 = left + g * (right - left);
    if (sse(m1) < sse(m2)) right = m2;
    else left = m1;
  }
  const c = Math.exp((left + right) / 2);
  const { a, b, sse: residual } = solveLinear(points, c)!;
  const mean = points.reduce((s, p) => s + p.y, 0) / points.length;
  const total = points.reduce((s, p) => s + (p.y - mean) ** 2, 0);
  const r2 = total === 0 ? 1 : 1 - residual / total;

  const atBound = best === 0 || best === GRID - 1;
  const rising = a > 0 && b > 0;
  const plateauDay =
    atBound || !rising ? null : Math.max(0, Math.log(b / ((1 - PLATEAU_SHARE) * a)) / c);
  return { a, b, c, plateauDay, r2 };
}

export type Trust = "few-points" | "short-span" | "poor-fit" | "trusted";

/** Whether a fit has enough check-ins, over enough time, fitting well enough to show. */
export function trustFit(fit: CurveFit | null, points: { t: number }[]): Trust {
  if (points.length < TRUST_MIN_POINTS || !fit) return "few-points";
  const ts = points.map((p) => p.t);
  if (Math.max(...ts) - Math.min(...ts) < TRUST_MIN_SPAN_DAYS) return "short-span";
  return fit.r2 < TRUST_MIN_R2 ? "poor-fit" : "trusted";
}
