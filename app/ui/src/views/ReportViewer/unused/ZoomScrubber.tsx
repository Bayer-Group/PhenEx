import { FC, useRef } from 'react';
import styles from './ZoomScrubber.module.css';

interface ZoomScrubberProps {
  percentage: number;
  onChange: (percentage: number) => void;
}

export const ZoomScrubber: FC<ZoomScrubberProps> = ({ percentage, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const update = (ev: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pad = 10; // matches CSS horizontal padding
      const usable = rect.width - pad * 2;
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left - pad) / usable) * 100));
      onChange(pct);
    };
    update(e.nativeEvent);
    const onMove = (ev: MouseEvent) => update(ev);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Compute thumb left so it stays within the padded content area
  const pad = 10;
  const trackWidth = 80; // matches CSS width
  const usable = trackWidth - pad * 2;
  const thumbLeft = pad + (percentage / 100) * usable;

  return (
    <div ref={trackRef} className={styles.scrubber} onMouseDown={handleMouseDown}>
      <div className={styles.thumb} style={{ left: `${thumbLeft}px` }} />
    </div>
  );
};
