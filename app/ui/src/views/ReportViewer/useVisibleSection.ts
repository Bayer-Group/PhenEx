import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Watches a pan/zoom content container and determines which section
 * (identified by ref elements) is currently most visible in the viewport.
 *
 * Sections are given as a flat list of { name, element } pairs.
 * Returns the name of the section whose top edge is closest to (but not past)
 * the viewport top, i.e., the "current" section.
 */

interface SectionEntry {
  name: string;
  element: HTMLElement;
}

export function useVisibleSection(
  viewportRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  getSections: () => SectionEntry[],
): string | null {
  const [active, setActive] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const compute = useCallback(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;

    const sections = getSections();
    if (!sections.length) return;

    // The content element has a CSS transform applied.
    // We use getBoundingClientRect on each section element to get its
    // actual rendered position relative to the viewport.
    const vpRect = vp.getBoundingClientRect();
    const vpTop = vpRect.top;
    const vpMid = vpTop + vpRect.height * 0.3; // 30% from top as "current" threshold

    let best: string | null = null;
    let bestDist = Infinity;

    for (const s of sections) {
      const rect = s.element.getBoundingClientRect();
      // Distance of section top from the viewport's "current" line
      const dist = vpMid - rect.top;
      // We want sections whose top is above the midpoint (dist > 0),
      // and pick the one closest to it (smallest positive dist)
      if (dist >= 0 && dist < bestDist) {
        bestDist = dist;
        best = s.name;
      }
    }

    // If nothing is above the midpoint, pick the first section
    if (best === null && sections.length > 0) {
      best = sections[0].name;
    }

    setActive((prev) => prev === best ? prev : best);
  }, [viewportRef, contentRef, getSections]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new MutationObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);
    });

    // Watch for style changes on content (transform changes from pan/zoom)
    observer.observe(content, { attributes: true, attributeFilter: ['style'] });

    // Initial computation
    compute();

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [contentRef, compute]);

  return active;
}
