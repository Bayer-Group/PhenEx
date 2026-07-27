import { RefObject, useEffect, useState } from 'react';

/** Screen-px of card that must scroll past the viewport top before the sticky
 *  header appears — roughly clears the in-card title so it doesn't overlap. */
const TITLE_CLEARANCE_PX = 100;

/**
 * Pins an absolute header to the pan/zoom viewport top while its card scrolls
 * upward. CSS `position: sticky` cannot work under a scaled/translated ancestor,
 * so we counter-translate in local (pre-scale) coordinates.
 *
 * Position updates run via MutationObserver on the transform node (no React
 * re-renders during pan). `isSticky` only toggles when stickiness changes.
 */
export function usePanZoomCardSticky(
  cardRef: RefObject<HTMLElement | null>,
  stickyRef: RefObject<HTMLElement | null>,
  enabled = true,
): boolean {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsSticky(false);
      return;
    }

    const card = cardRef.current;
    const sticky = stickyRef.current;
    if (!card || !sticky) return;

    const transformEl = findTransformedAncestor(card);
    const viewport = transformEl?.parentElement;
    if (!transformEl || !viewport) return;

    let wasSticky = false;

    const update = () => {
      const scale =
        parseFloat(getComputedStyle(card).getPropertyValue('--zoom-scale')) || 1;
      const cardRect = card.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();
      const stickyH = sticky.getBoundingClientRect().height;

      const maxOffsetScreen = Math.max(0, cardRect.height - stickyH);
      const offsetScreen = Math.min(
        Math.max(0, vpRect.top - cardRect.top),
        maxOffsetScreen,
      );
      // Wait until the in-card title has mostly scrolled away.
      const stuck = offsetScreen > TITLE_CLEARANCE_PX;

      if (stuck) {
        sticky.style.transform = `translateY(${offsetScreen / scale}px)`;
      } else {
        sticky.style.transform = '';
      }

      if (stuck !== wasSticky) {
        wasSticky = stuck;
        setIsSticky(stuck);
      }
    };

    const mo = new MutationObserver(update);
    mo.observe(transformEl, { attributes: true, attributeFilter: ['style'] });

    const ro = new ResizeObserver(update);
    ro.observe(card);
    ro.observe(viewport);
    ro.observe(sticky);

    update();
    return () => {
      mo.disconnect();
      ro.disconnect();
      sticky.style.transform = '';
    };
  }, [cardRef, stickyRef, enabled]);

  return isSticky;
}

function findTransformedAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const t = node.style.transform || getComputedStyle(node).transform;
    if (t && t !== 'none') return node;
    node = node.parentElement;
  }
  return null;
}
