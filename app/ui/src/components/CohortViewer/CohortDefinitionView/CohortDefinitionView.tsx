import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortDefinitionView.module.css';
import { CohortDataService } from '../CohortDataService';
import { TableData } from '../tableTypes';
import { CohortTable } from '../CohortTable/CohortTable';
import { Tabs } from '../../Tabs/Tabs';
import { ButtonsBarWithDropdowns } from '../../ButtonsBar/ButtonsBarWithDropdowns';
import { phenotypeAddableTypeValues } from '../../../types/phenotype';
import { AccordianTabbedInfoDisplayView } from './AccordianTabbedInfoDisplayView';

interface CohortDefinitionViewProps {
  data?: string;
  onAddPhenotype?: () => void;
}

enum CohortDefinitionViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
}

export const CohortDefinitionView: FC<CohortDefinitionViewProps> = ({ data }) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const gridRef = useRef<any>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [currentView, setCurrentView] = useState<CohortDefinitionViewType>(
    CohortDefinitionViewType.Cohort
  );

  const refreshGrid = () => {
    if (currentView === CohortDefinitionViewType.Cohort && gridRef.current?.api) {
      const api = gridRef.current.api;
      // Store current scroll position
      // const horizontalScroll = api.getHorizontalPixelRange();
      const firstRow = api.getFirstDisplayedRow();
      const lastRow = api.getLastDisplayedRow();

      // Update grid data
      api.setGridOption('rowData', dataService.table_data['rows']);

      // Restore scroll position after data update
      requestAnimationFrame(() => {
        api.ensureIndexVisible(firstRow, 'top');
        api.ensureIndexVisible(lastRow, 'bottom');

        // api.horizontalScroll().setScrollPosition({ left: horizontalScroll.left });
      });
    }
  };

  useEffect(() => {
    switch (currentView) {
      case CohortDefinitionViewType.Cohort:
        dataService.filterType(['entry', 'inclusion', 'exclusion']);
        break;
      case CohortDefinitionViewType.Baseline:
        dataService.filterType('baseline');
        break;
      case CohortDefinitionViewType.Outcomes:
        dataService.filterType('outcome');
        break;
    }
  }, [currentView, dataService]);

  useEffect(() => {
    // Add listener for data service updates
    const listener = () => {
      setTableData(dataService.table_data);
      refreshGrid();
    };
    dataService.addListener(listener);

    return () => {
      dataService.removeListener(listener);
    };
  }, [dataService]);

  useEffect(() => {
    if (currentView === CohortDefinitionViewType.Cohort) {
      refreshGrid();
    }
  }, [currentView]);

  const onCellValueChanged = async (event: any) => {
    console.log('CELL VALUE CHANGED', event.newValue, event.oldValue);
    if (event.newValue !== event.oldValue) {
      dataService.onCellValueChanged(event);
      setTableData(dataService.table_data);
    }
  };

  const clickedAddPhenotype = async (type: string) => {
    dataService.addPhenotype(type);
  };

  const executeCohort = async () => {
    await dataService.executeCohort();
  };

  const renderView = () => {
    switch (currentView) {
      case CohortDefinitionViewType.Cohort:
        return (
          <AccordianTabbedInfoDisplayView
            title="Cohort Definition"
            infoContent={
              <>
                <p>
                  Specify which patients you are interested in including in your study with{' '}
                  <strong>electronic phenotypes</strong> that define:
                </p>
                <ol>
                  <li>
                    a single <strong>entry</strong> criterion, which sets the{' '}
                    <strong>index date</strong> (study entry date)
                  </li>
                  <li>
                    <strong>inclusion</strong> criteria, which all patients must fulfill at index
                    date
                  </li>
                  <li>
                    <strong>exclusion</strong> criteria that patients may not exhibit at index date
                  </li>
                </ol>
                <p>
                  Each row in the following table is a single electronic phenotype (entry, inclusion
                  or exclusion criteria). Click{' '}
                  <span className={styles.inTextButton}>New Phenotype</span> above to add new
                  phenotypes! Then edit parameters within the table.
                </p>
                <p>
                  If you have a text description of your cohort, try asking our AI to generate the
                  cohort for you!
                </p>
              </>
            }
          />
        );
      case CohortDefinitionViewType.Baseline:
        return (
          <AccordianTabbedInfoDisplayView
            title="Baseline Characteristics"
            infoContent={
              <>
                <p>
                  Define how you want to characterize your population at index date. To do this
                  first define a baseline period; the default is one year running up to the index
                  date, inclusive, but modify as necessary.
                </p>
                <p>
                  Speed up your work by selecting one or all of our pre-defined phenotype libraries,
                  and add and adjust as necessary.
                </p>
              </>
            }
          />
        );
      case CohortDefinitionViewType.Outcomes:
        return (
          <AccordianTabbedInfoDisplayView
            title="Outcomes"
            infoContent={
              <>
                <p>
                  Define what events you are interested in observing as outcomes in the post index
                  period. Time to first event is a common analysis.
                </p>
                <p>
                  Speed up your work by selecting one or all of our pre-defined phenotype libraries,
                  and add and adjust as necessary.
                </p>
              </>
            }
          />
        );
      default:
        return null;
    }
  };

  const tabs = Object.values(CohortDefinitionViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortDefinitionViewType);
    setCurrentView(viewTypes[index]);
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={Object.values(CohortDefinitionViewType).indexOf(currentView)}
          />
          <ButtonsBarWithDropdowns
            width={200}
            buttons={['Execute', 'New Phenotype']}
            actions={[executeCohort, () => {}]}
            dropdown_items={[null, phenotypeAddableTypeValues]}
            onDropdownSelection={(buttonIndex, selectedItem) => {
              if (buttonIndex === 1) {
                clickedAddPhenotype(selectedItem);
              }
            }}
          />
        </div>
      </div>
      <div className={styles.bottomSection}>
        <div className={styles.infoBox}>{renderView()}</div>
        <div className={styles.tableBox}>
          <CohortTable
            data={dataService.table_data}
            onCellValueChanged={onCellValueChanged}
            ref={gridRef}
          />
        </div>
      </div>
    </div>
  );
};
