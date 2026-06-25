import { FC } from 'react';
import { type CohortClassified } from '../../types';
import { RowModal } from './RowModal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRendererPresentation } from '../RowRenderers/BarChartCellRendererPresentation';
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
        <BarChartCellRendererPresentation
          data={{ name, _meta: { cohortData: filteredCohortData, finalCohortSizes } }}
          isModal
          pctDecimals={1}
        />
      </div>
    </RowModal>
  );
};
