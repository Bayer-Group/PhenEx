import { FC } from 'react';
import { type CohortClassified } from '../../types';
import { RowModal } from './RowModal';
import { ModalLegend, useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { CategoricalBarChartCellRenderer } from '../RowRenderers/CategoricalBarChartCellRenderer';
import styles from './CategoricalRowModal.module.css';

interface CategoricalRowModalProps {
  baseName: string;
  cohortData: CohortClassified[];
  onClose: () => void;
  breadcrumbs?: string[];
}

export const CategoricalRowModal: FC<CategoricalRowModalProps> = ({
  baseName,
  cohortData,
  onClose,
  breadcrumbs,
}) => {
  const { visible, toggle } = useCohortVisibility(cohortData.length);
  const filteredCohortData = useFilteredCohortData(cohortData, visible);

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs}>
      <div className={styles.container}>
        <ModalLegend cohortData={cohortData} visible={visible} onToggle={toggle} />
        <CategoricalBarChartCellRenderer
          baseName={baseName}
          cohortData={filteredCohortData}
          orientation="vertical"
        />
      </div>
    </RowModal>
  );
};
