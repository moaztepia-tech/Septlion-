'use client';

import {useEffect, useId, useRef, useState} from 'react';

// The seven vertices follow the reference --shape-h contour. This is the
// application frame, separate from the supplied, unmodified logo artwork.
function contour(width: number, height: number, inset: number) {
  const left = inset, right = width - inset, top = inset, bottom = height - inset;
  return `M ${width / 2} ${top} L ${right} ${top + 10} L ${right} ${bottom - 10} L ${right - 14} ${bottom} L ${left + 14} ${bottom} L ${left} ${bottom - 10} L ${left} ${top + 10} Z`;
}

export function ApplicationFrame() {
  const frame = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, '') + '-frame-metal';
  const [size, setSize] = useState({width: 580, height: 800});
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const update = () => {
      const {width, height} = element.getBoundingClientRect();
      setSize(previous => previous.width === width && previous.height === height ? previous : {width, height});
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <svg ref={frame} className="frame-svg customer-frame" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stopColor="var(--color-sky)"/><stop offset="22%" stopColor="var(--color-steel)"/><stop offset="50%" stopColor="var(--color-navy)"/><stop offset="78%" stopColor="var(--color-steel)"/><stop offset="100%" stopColor="var(--color-sky)"/>
    </linearGradient></defs>
    <path className="frame-edge" d={contour(size.width, size.height, 1.5)} fill="none" stroke={`url(#${gradientId})`} vectorEffect="non-scaling-stroke"/>
    <path className="frame-inner-edge" d={contour(size.width, size.height, 4.5)} fill="none" stroke={`url(#${gradientId})`} vectorEffect="non-scaling-stroke"/>
  </svg>;
}
