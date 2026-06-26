import { FC, useRef, useState, useEffect } from 'react';
import { CohortSelector } from './CohortSelector';
import { CohortActionBar } from './CohortActionBar';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import type { CohortGroup, LegendSelection, CohortDescriptions } from '../../types';
import styles from './FullCohortSelector.module.css';

interface FullCohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
}

export const FullCohortSelector: FC<FullCohortSelectorProps> = ({
  groups,
  selections,
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
  finalCohortSizes,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
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
          />
        </div>
          <div className={styles.scrollbarRegion}>
            <SimpleCustomScrollbar
              targetRef={scrollRef}
              orientation="vertical"
              marginTop={60}
              marginBottom={10}
              marginToEnd={10}
              classNameTrack={styles.scrollBarTrack}
              classNameThumb={styles.scrollBarThumb}
              showOnHover={true}
            />
          </div>
      </div>
    </div>
  );
};
