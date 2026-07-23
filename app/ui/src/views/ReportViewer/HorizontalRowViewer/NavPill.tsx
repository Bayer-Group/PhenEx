import { FC, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import styles from './HorizontalRowViewer.module.css';

interface NavPillProps {
  currentIndex: number;
  total: number;
  onNavigate: (index: number) => void;
}

export const NavPill: FC<NavPillProps> = ({ currentIndex, total, onNavigate }) => {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [hoveredNav, setHoveredNav] = useState<'prev' | 'next' | null>(null);

  return (
    <div className={styles.navPill}>
      <button
        ref={prevRef}
        className={styles.navArrow}
        disabled={currentIndex <= 0}
        onClick={() => { if (currentIndex > 0) onNavigate(currentIndex - 1); }}
        onMouseEnter={() => setHoveredNav('prev')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        <svg width="28" height="30" viewBox="0 0 25 28" fill="none">
          <path d="M17 25L10.34772 14.0494C10.15571 13.8507 10.16118 13.534 10.35992 13.3422L17 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </button>
      <button
        ref={nextRef}
        className={styles.navArrow}
        disabled={currentIndex >= total - 1}
        onClick={() => { if (currentIndex < total - 1) onNavigate(currentIndex + 1); }}
        onMouseEnter={() => setHoveredNav('next')}
        onMouseLeave={() => setHoveredNav(null)}
      >
        <svg width="28" height="30" viewBox="0 0 25 28" fill="none" style={{ transform: 'scaleX(-1)' }}>
          <path d="M17 25L10.34772 14.0494C10.15571 13.8507 10.16118 13.534 10.35992 13.3422L17 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </button>
      <PhenExNavBarTooltip isVisible={hoveredNav === 'prev'} anchorElement={prevRef.current} label="Previous Section" verticalPosition="above" horizontalAlignment="right" />
      <PhenExNavBarTooltip isVisible={hoveredNav === 'next'} anchorElement={nextRef.current} label="Next Section" verticalPosition="above" horizontalAlignment="right" />
    </div>
  );
};
