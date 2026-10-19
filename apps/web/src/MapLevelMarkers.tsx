// SPDX-License-Identifier: MPL-2.0
import { useLayoutEffect, useRef, useState } from 'react';
import type { MapLevelReference } from './mapLevelReferences';

type Point = MapLevelReference & { top: number };
/** Nearby lines may share a marker label, but never become a combined engine level. */
export function arrangeLevelMarkers(points: Point[], height: number, labelHeight: number) {
  const gap = labelHeight + 4, groups: Point[][] = [];
  for (const point of [...points].sort((a, b) => a.top - b.top || a.code.localeCompare(b.code))) {
    const group = groups.at(-1);
    if (group && (point.top - group[0]!.top) * height / 100 < gap) group.push(point);
    else groups.push([point]);
  }
  // Leave a half-label at each end, even when references reach the plot boundary.
  while (groups.length > 1 && (groups.length - 1) * gap + labelHeight > height) {
    let nearest = 0, distance = Infinity;
    for (let i = 0; i < groups.length - 1; i++) {
      const separation = groups[i + 1]![0]!.top - groups[i]!.at(-1)!.top;
      if (separation < distance) { nearest = i; distance = separation; }
    }
    groups.splice(nearest, 2, [...groups[nearest]!, ...groups[nearest + 1]!]);
  }
  const positioned = groups.map(members => ({ members, y: members.reduce((sum, point) => sum + point.top * height / 100, 0) / members.length }));
  for (let i = 0; i < positioned.length; i++) positioned[i]!.y = Math.max(labelHeight / 2,
    positioned[i]!.y, i ? positioned[i - 1]!.y + gap : 0);
  for (let i = positioned.length - 1; i >= 0; i--) positioned[i]!.y = Math.min(height - labelHeight / 2,
    positioned[i]!.y, i + 1 < positioned.length ? positioned[i + 1]!.y - gap : height);
  return positioned;
}

export function MapLevelMarkers({ references, topFor }: { references: MapLevelReference[]; topFor: (price: number) => number }) {
  const layer = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ height: 230, label: 18 });
  const identity = references.map(reference => reference.id).join(':');
  useLayoutEffect(() => {
    if (!layer.current || !label.current) return;
    const measure = () => {
      const next = { height: layer.current!.getBoundingClientRect().height,
        label: Math.max(...Array.from(layer.current!.querySelectorAll('.map-level-marker')).map(node => node.getBoundingClientRect().height)) };
      if (next.height && next.label) setSize(old => old.height === next.height && old.label === next.label ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer.current);
    layer.current.querySelectorAll('.map-level-marker').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [identity, size.height]);
  const positions = arrangeLevelMarkers(references.map(reference => ({ ...reference, top: topFor((reference.low + reference.high) / 2) })), size.height, size.label);
  return <div ref={layer} className="map-level-marker-layer" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {positions.flatMap(group => group.members.map(member => <path key={member.id} data-role={member.role} data-quality={member.quality??'common'}
        d={`M 0 ${topFor(member.high)} V ${topFor(member.low)} M 0 ${member.top} L 12 ${group.y / size.height * 100}`}
        vectorEffect="non-scaling-stroke" />))}
    </svg>
    {positions.map((group, index) => {
      const numbers = group.members.map(member => Number(member.code.slice(1))).sort((a, b) => a - b);
      const contiguous = numbers.every((number, i) => !i || number === numbers[i - 1]! + 1);
      const text = numbers.length === 1 ? `L${numbers[0]}` : contiguous ? `L${numbers[0]}–${numbers.at(-1)}` : numbers.map(number => `L${number}`).join('·');
      const role = group.members.every(member => member.role === group.members[0]!.role) ? group.members[0]!.role : 'reference';
      const quality=group.members.every(member=>member.quality===group.members[0]!.quality)?group.members[0]!.quality??'common':undefined;
      return <span key={group.members.map(member => member.id).join(':')} ref={index === 0 ? label : undefined}
        className="map-level-marker" data-role={role} data-quality={quality} style={{ top: `${group.y / size.height * 100}%` }}>{quality?text:group.members.length>3?<>
          {text}<span className="map-level-quality-mix">{[...new Set(group.members.map(member=>member.quality??'common'))]
            .map(tier=><span key={tier} data-quality={tier}>●</span>)}</span></>:
          [...group.members].sort((a,b)=>Number(a.code.slice(1))-Number(b.code.slice(1))).map((member,i)=><span key={member.id}>
            {i>0&&'·'}<span data-quality={member.quality??'common'}>{member.code}</span></span>)}</span>;
    })}
  </div>;
}
