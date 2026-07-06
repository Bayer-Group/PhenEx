import { FC, useRef, useState, useEffect } from 'react';
import { CohortSelector } from './CohortSelector';
import { CohortActionBar } from './CohortActionBar';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import type { CohortGroup, LegendSelection, CohortDescriptions, ColorOverrides } from '../../types';
import styles from './FullCohortSelector.module.css';

interface FullCohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
}

export const FullCohortSelector: FC<FullCohortSelectorProps> = ({
  groups,
  selections,
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
  finalCohortSizes,
  colorOverrides,
  onSetColor,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(true);
  const [showFloatingActions, setShowFloatingActions] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    const target = headerActionsRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingActions(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.container}>
      <div ref={scrollRegionRef} className={styles.scrollRegion}>
        <div className={`${styles.actionBarRegion} ${showFloatingActions ? styles.actionBarRegionVisible : ''}`}>
          <CohortActionBar
            groups={groups}
            selections={selections}
            showAll={showAll}
            onToggleShowAll={() => setShowAll((v) => !v)}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </div>
        <div ref={scrollRef} className={styles.scrollContent}>
          <CohortSelector
            groups={groups}
            selections={selections}
            showAll={showAll}
            onToggleShowAll={() => setShowAll((v) => !v)}
            onReplace={onReplace}
            onAdd={onAdd}
            onRemove={onRemove}
            cohortDescriptions={cohortDescriptions}
            finalCohortSizes={finalCohortSizes}
            headerActionsRef={headerActionsRef}
            colorOverrides={colorOverrides}
            onSetColor={onSetColor}
          />
        </div>
          <div className={styles.scrollbarRegion}>
            <SimpleCustomScrollbar
              targetRef={scrollRef}
              orientation="vertical"
              marginTop={10}
              marginBottom={10}
              marginToEnd={5}
              classNameTrack={styles.scrollBarTrack}
              classNameThumb={styles.scrollBarThumb}
              showOnHover={true}
            />
          </div>
      </div>
    </div>
  );
};
