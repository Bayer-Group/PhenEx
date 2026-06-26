import { FC } from 'react';
import { type CohortClassified } from '../../types';
import { RowModal } from './RowModal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRendererCompact } from '../RowRenderers/BarChartCellRendererCompact';
import { type BarChartSpacer } from '../RowRenderers/barChartShared';
import styles from './BooleanRowModal.module.css';

/** Pixels per spacer unit in the larger modal/presentation context. */
const PRESENTATION_SPACER_UNIT_PX = 14;

interface BooleanRowModalProps {
  name: string;
  cohortData: CohortClassified[];
  onClose: () => void;
  breadcrumbs?: string[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
}

export const BooleanRowModal: FC<BooleanRowModalProps> = ({
  name,
  cohortData,
  onClose,
  breadcrumbs,
  finalCohortSizes,
  spacers,
}) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filteredCohortData = useFilteredCohortData(cohortData, visible);

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs}>
      <div className={styles.container}>
        {/* <ModalLegend cohortData={cohortData} visible={visible} onToggle={toggle} /> */}
        <BarChartCellRendererCompact
          data={{ name, _meta: { cohortData: filteredCohortData, finalCohortSizes, spacers } }}
          isModal
          pctDecimals={1}
          spacerUnitPx={PRESENTATION_SPACER_UNIT_PX}
        />
      </div>
    </RowModal>
  );
};
