import { FC } from 'react';
import { type CohortClassified } from '../../types';
import { RowModal } from './RowModal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRenderer } from '../RowRenderers/BarChartCellRenderer';
import styles from './BooleanRowModal.module.css';

interface BooleanRowModalProps {
  name: string;
  cohortData: CohortClassified[];
  onClose: () => void;
  breadcrumbs?: string[];
  finalCohortSizes?: Record<string, number | null>;
}

export const BooleanRowModal: FC<BooleanRowModalProps> = ({
  name,
  cohortData,
  onClose,
  breadcrumbs,
  finalCohortSizes,
}) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filteredCohortData = useFilteredCohortData(cohortData, visible);

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs}>
      <div className={styles.container}>
        {/* <ModalLegend cohortData={cohortData} visible={visible} onToggle={toggle} /> */}
        <BarChartCellRenderer
          data={{ name, _meta: { cohortData: filteredCohortData, finalCohortSizes } }}
          isModal
          mode="presentation"
          pctDecimals={1}
        />
      </div>
    </RowModal>
  );
};
