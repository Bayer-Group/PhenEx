/**
 * Dual-axis scrollbar driven by usePanZoom.
 *
 * Renders horizontal and vertical scrollbar tracks with draggable thumbs.
 * All positioning is done imperatively by the hook via refs — no React
 * re-renders during scroll.  The component handles thumb drag and track
 * click interactions, calling back into the hook via onScrollH / onScrollV.
 */
import { FC, useEffect, useCallback } from 'react';
import type { ScrollbarBinding } from '../../../hooks/usePanZoom';
import styles from './PanZoomScrollbar.module.css';

export const PanZoomScrollbar: FC<ScrollbarBinding> = ({
  hTrackRef,
  vTrackRef,
  hThumbRef,
  vThumbRef,
  onScrollH,
  onScrollV,
}) => {
  // ── Horizontal thumb drag ─────────────────────────────────────────────
  useEffect(() => {
    const thumb = hThumbRef.current;
    const track = hTrackRef.current;
    if (!thumb || !track) return;

    let active = false;
    let startX = 0;
    let startLeft = 0;

    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      active = true;
      startX = e.clientX;
      startLeft = thumb.offsetLeft;
      document.body.style.userSelect = 'none';
    };

    const onMove = (e: MouseEvent) => {
      if (!active) return;
      const delta = e.clientX - startX;
      const range = track.clientWidth - thumb.offsetWidth;
      if (range <= 0) return;
      const newLeft = Math.max(0, Math.min(range, startLeft + delta));
      onScrollH(newLeft / range);
    };

    const onUp = () => {
      if (active) {
        active = false;
        document.body.style.userSelect = '';
      }
    };

    thumb.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      thumb.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [hThumbRef, hTrackRef, onScrollH]);

  // ── Vertical thumb drag ───────────────────────────────────────────────
  useEffect(() => {
    const thumb = vThumbRef.current;
    const track = vTrackRef.current;
    if (!thumb || !track) return;

    let active = false;
    let startY = 0;
    let startTop = 0;

    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      active = true;
      startY = e.clientY;
      startTop = thumb.offsetTop;
      document.body.style.userSelect = 'none';
    };

    const onMove = (e: MouseEvent) => {
      if (!active) return;
      const delta = e.clientY - startY;
      const range = track.clientHeight - thumb.offsetHeight;
      if (range <= 0) return;
      const newTop = Math.max(0, Math.min(range, startTop + delta));
      onScrollV(newTop / range);
    };

    const onUp = () => {
      if (active) {
        active = false;
        document.body.style.userSelect = '';
      }
    };

    thumb.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      thumb.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [vThumbRef, vTrackRef, onScrollV]);

  // ── Track click (jump to position) ────────────────────────────────────
  const handleHTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const track = hTrackRef.current;
      const thumb = hThumbRef.current;
      if (!track || !thumb || e.target === thumb) return;
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const thumbW = thumb.offsetWidth;
      const range = track.clientWidth - thumbW;
      if (range <= 0) return;
      onScrollH(Math.max(0, Math.min(1, (clickX - thumbW / 2) / range)));
    },
    [hTrackRef, hThumbRef, onScrollH],
  );

  const handleVTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const track = vTrackRef.current;
      const thumb = vThumbRef.current;
      if (!track || !thumb || e.target === thumb) return;
      const rect = track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbH = thumb.offsetHeight;
      const range = track.clientHeight - thumbH;
      if (range <= 0) return;
      onScrollV(Math.max(0, Math.min(1, (clickY - thumbH / 2) / range)));
    },
    [vTrackRef, vThumbRef, onScrollV],
  );

  return (
    <>
      <div
        ref={hTrackRef}
        className={styles.hTrack}
        onClick={handleHTrackClick}
        data-no-pan
      >
        <div ref={hThumbRef} className={styles.hThumb} />
      </div>
      <div
        ref={vTrackRef}
        className={styles.vTrack}
        onClick={handleVTrackClick}
        data-no-pan
      >
        <div ref={vThumbRef} className={styles.vThumb} />
      </div>
    </>
  );
};
