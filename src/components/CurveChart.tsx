import { useEffect, useId, useRef, useState } from "react";
import { automaticity, CurveFit } from "../lib/curve";
import { SRBAI_MAX, SRBAI_MIN } from "../lib/srbai";

const H = 260;
const PAD = { left: 32, right: 12, top: 16, bottom: 40 };

/** Width of an element in CSS pixels, so the chart draws at 1:1 and its text stays at the type scale. */
function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * SRBAI check-ins as dots, the fitted A(t) = a - b·e^(-ct) as a line, and the plateau day as a rule.
 * Plain SVG, as the spec asks; Lime has no chart component, so every color here is a Lime token.
 */
export default function CurveChart({ points, fit }: { points: { t: number; y: number }[]; fit: CurveFit | null }) {
  const id = useId();
  const [ref, W] = useWidth<HTMLDivElement>();
  const lastT = Math.max(0, ...points.map((p) => p.t));
  const maxT = Math.max(28, lastT, fit?.plateauDay ?? 0) * 1.1;
  const x = (t: number) => PAD.left + (t / maxT) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((SRBAI_MAX - v) / (SRBAI_MAX - SRBAI_MIN)) * (H - PAD.top - PAD.bottom);
  const clamp = (v: number) => Math.min(SRBAI_MAX, Math.max(SRBAI_MIN, v));

  const curve = fit
    ? Array.from({ length: 101 }, (_, i) => {
        const t = (i / 100) * maxT;
        return `${i ? "L" : "M"}${x(t).toFixed(1)},${y(clamp(automaticity(fit, t))).toFixed(1)}`;
      }).join("")
    : null;
  // A tick every two weeks, thinned so labels keep at least 40px apart.
  const pxPerDay = (W - PAD.left - PAD.right) / maxT;
  const step = 14 * Math.max(1, Math.ceil(40 / (14 * pxPerDay)));
  const xTicks = Array.from({ length: Math.floor(maxT / step) + 1 }, (_, i) => i * step);
  const plateauX = fit?.plateauDay != null ? x(fit.plateauDay) : null;

  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
          <title id={`${id}-t`}>Automaticity over time</title>
          <desc id={`${id}-d`}>
            {points.length} SRBAI check-ins on a 1 to 7 scale against days since the habit started
            {fit ? `, with the fitted curve levelling off near ${fit.a.toFixed(1)}` : ""}.
          </desc>
          {[1, 2, 3, 4, 5, 6, 7].map((v) => (
            <g key={v}>
              <line className="stroke-line" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="caption fill-fg-3" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="caption fill-fg-3" x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle">
              {t}
            </text>
          ))}
          <text className="caption fill-fg-3" x={W - PAD.right} y={H - 4} textAnchor="end">
            Days since start
          </text>
          {plateauX !== null && (
            <g>
              <line className="stroke-fg-3" strokeDasharray="4 4" x1={plateauX} x2={plateauX} y1={PAD.top} y2={H - PAD.bottom} />
              {/* Label on whichever side of the rule has room. */}
              <text
                className="caption fill-fg-2"
                x={plateauX + (plateauX > W * 0.6 ? -6 : 6)}
                y={PAD.top + 12}
                textAnchor={plateauX > W * 0.6 ? "end" : "start"}
              >
                95% of plateau
              </text>
            </g>
          )}
          {curve && <path className="fill-none stroke-accent-line" strokeWidth={2} strokeLinecap="round" d={curve} />}
          {points.map((p, i) => (
            <circle key={i} className="fill-fg stroke-page" strokeWidth={2} cx={x(p.t)} cy={y(p.y)} r={5}>
              <title>{`Day ${Math.round(p.t)}: ${p.y.toFixed(2)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <figcaption className="caption flex flex-wrap gap-4 text-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-fg" aria-hidden="true" /> SRBAI check-in
        </span>
        {fit && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-accent-line" aria-hidden="true" /> Fitted curve
          </span>
        )}
      </figcaption>
    </figure>
  );
}
