// SPDX-License-Identifier: MPL-2.0
import { useLayoutEffect, useRef, useState } from 'react';

type EdgeReference = { id: string; shortLabel: string; price: number; tone: 'ib' | 'overnight' };
const rowGap = 4;

/** Name-only labels in the left gutter. Displaced labels retain a short
 * leader to their exact edge; close or coincident edges remain separate. */
export function MapEdgeLabels({ references, topFor }: {
  references: EdgeReference[]; topFor: (price: number) => number;
}) {
  const layer = useRef<HTMLDivElement>(null), firstLabel = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ plot: 230, label: 19 });
  const identity = references.map(r => r.id).join(':');
  useLayoutEffect(() => {
    const canvas = layer.current, label = firstLabel.current;
    if (!canvas || !label) return;
    const measure = () => {
      const next = { plot: canvas.getBoundingClientRect().height, label: label.getBoundingClientRect().height };
      if (next.plot > 0 && next.label > 0) setSize(old =>
        old.plot === next.plot && old.label === next.label ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas); observer.observe(label);
    return () => observer.disconnect();
  }, [identity]);

  if (!references.length) return null;
  const points = references.map(reference => ({ ...reference, top: topFor(reference.price) }))
    .sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
  const labels: Array<typeof points[number] & { y: number }> = [];
  for (const point of points) {
    labels.push({ ...point, y: Math.max(size.label / 2, point.top * size.plot / 100,
      labels.length ? labels.at(-1)!.y + size.label + rowGap : 0) });
  }
  for (let i = labels.length - 1; i >= 0; i--) labels[i]!.y = Math.min(size.plot - size.label / 2,
    labels[i]!.y, i + 1 < labels.length ? labels[i + 1]!.y - size.label - rowGap : size.plot);

  return <div ref={layer} className="map-edge-label-layer" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {labels.map(label => <path key={label.id} className="map-edge-label-connector" data-tone={label.tone}
        d={`M 85 ${label.y / size.plot * 100} L 100 ${label.top}`} vectorEffect="non-scaling-stroke" />)}
    </svg>
    {labels.map((label, index) =>
      <span ref={index === 0 ? firstLabel : undefined} className="map-edge-label"
        key={label.id} data-reference-id={label.id} data-tone={label.tone}
        style={{ top: `${label.y / size.plot * 100}%` }}>
        {label.shortLabel}
      </span>
    )}
  </div>;
}
