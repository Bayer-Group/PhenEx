/**
 * Context for sharing the current pan-zoom scale to descendant components.
 *
 * Both `usePanZoom` and `useViewZoom` set a `--pz-scale` CSS custom property
 * on their content element.  For **CSS-only** consumers this is sufficient:
 *
 *   font-size: calc(14px / var(--pz-scale, 1));
 *
 * For **JS** consumers (e.g. computing layout, inverse-scaling a portal)
 * wrap the zoomed subtree with `<PanZoomScaleProvider value={scale}>` and
 * call `usePanZoomScale()` in any descendant.
 */

import { createContext, useContext } from 'react';

const PanZoomScaleContext = createContext(1);

export const PanZoomScaleProvider = PanZoomScaleContext.Provider;

/** Read the current zoom scale from the nearest PanZoomScaleProvider. */
export function usePanZoomScale(): number {
  return useContext(PanZoomScaleContext);
}
