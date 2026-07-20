import { FC, useState, useRef, useEffect } from 'react';
import styles from './PhenotypeComponents.module.css';
import { PhenotypeDataService } from '../PhenotypeDataService';
import { CohortCardViewer } from '../../../CohortViewer/CohortCardViewer/CohortCardViewer';
import { SwitchButton } from '../../../../components/ButtonsAndTabs/SwitchButton/SwitchButton';
import { LevelSelect } from '../../../../components/ButtonsAndTabs/LevelSelect/LevelSelect';
import typeStyles from '../../../../styles/study_types.module.css';

interface PhenotypeComponentsProps {
  data?: any;
}

export const PhenotypeComponents: FC<PhenotypeComponentsProps> = ({ data }) => {
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => PhenotypeDataService.getInstance());
  const [tableData, setTableData] = useState(dataService.componentPhenotypeTableData);
  const [showSubchildren, setShowSubchildren] = useState(() => dataService.getShowSubchildren());
  const [componentLevel, setComponentLevel] = useState(() => dataService.getComponentLevel());
  const [maxLevel, setMaxLevel] = useState(() => dataService.getMaxComponentLevel());
  const [minLevel, setMinLevel] = useState(() => dataService.currentPhenotype?.level ?? 1);

  const handleShowSubchildrenChange = (value: boolean) => {
    setShowSubchildren(value);
    dataService.setShowSubchildren(value);
  };

  const handleComponentLevelChange = (value: number) => {
    setComponentLevel(value);
    dataService.setComponentLevel(value);
  };

  useEffect(() => {
    const listener = () => {
      setTableData(dataService.componentPhenotypeTableData);
      setMaxLevel(dataService.getMaxComponentLevel());
      setMinLevel(dataService.currentPhenotype?.level ?? 1);
    };
    dataService.addComponentPhenotypeListener(listener);

    return () => {
      dataService.removeComponentPhenotypeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (data) {
      dataService.setData(data);
    }
    setTableData(dataService.componentPhenotypeTableData);
    setMaxLevel(dataService.getMaxComponentLevel());
    setMinLevel(dataService.currentPhenotype?.level ?? 1);
  }, [data]);

  const onCellValueChanged = async (event: any) => {
    if (event.newValue !== event.oldValue) {
      // Component phenotypes are stored in the cohort data, not phenotype params.
      // Use CohortDataService to handle the change.
      dataService.cohortDataService.onCellValueChanged(event);
      dataService.saveChangesToPhenotype(false);
    }
  };

  const onRowDragEnd = async (newRowData: any[]) => {
    // Component phenotypes are stored in cohort data. Use the specialized method
    // for reordering components within their parent phenotype.
    const parentId = dataService.currentPhenotype?.id;
    if (parentId) {
      await dataService.cohortDataService.updateComponentOrder(parentId, newRowData);
    }
    // No manual refresh needed — the cohort data change listener handles it.
  };

  const clickedOnAddButton = () => {
    dataService.addNewComponentPhenotype();
  };

  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return null;
  }

  return (
    <div className={styles.phenotypeContainer}>
      <div className={styles.controls}>
        {/* <SwitchButton
          label=""
          value={showSubchildren}
          onValueChange={handleShowSubchildrenChange}
          dark
        /> */}
        <LevelSelect
          value={componentLevel}
          onChange={handleComponentLevelChange}
          minLevel={minLevel+1}
          maxLevel={maxLevel}
          disabled={!showSubchildren}
          title="Show subchildren up to this depth"
        />
      </div>
      <div className={styles.tableBox}>
        <CohortCardViewer
          ref={gridRef}
          data={tableData}
          currentlyViewing={'components'}
          cardMode
          sectionTitles={{ component: 'Components' }}
          sectionGroupBy="type"
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
        />
      </div>
    </div>
  );
};
