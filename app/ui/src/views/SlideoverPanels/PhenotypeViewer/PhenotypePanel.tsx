import React, { useState, useRef, useEffect } from 'react';
import styles from './PhenotypePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import typeStyles from '../../../styles/study_types.module.css';
import { PhenotypeViewer } from './PhenotypeViewer';
import { Phenotype, PhenotypeDataService } from './PhenotypeDataService';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenotypeComponents } from './PhenotypeComponents/PhenotypeComponents';
import { EditableTextField } from '../../../components/EditableTextField/EditableTextField';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../CohortViewer/CohortViewer';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

enum PhenotypePanelViewType {
  Parameters = 'parameters',
  ComponentPhenotypes = 'componentPhenotypes',
}

export const PhenotypePanel: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const dataService = useRef(PhenotypeDataService.getInstance()).current;
  const [phenotypeName, setPhenotypeName] = useState('');

  const [currentView, setCurrentView] = useState<PhenotypePanelViewType>(
    PhenotypePanelViewType.Parameters
  );
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  // Initialize phenotype name when data changes
  useEffect(() => {
    if (data) {
      setPhenotypeName(data.name);
    }
  }, [data]);

  const onSaveNameChanges = () => {
    if (data) {
      dataService.valueChanged({ parameter: 'name', value: phenotypeName }, phenotypeName);
    }
  };

  const onClickAncestor = (ancestor: Phenotype) => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, ancestor);
  };

  const tabs = Object.values(PhenotypePanelViewType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(PhenotypePanelViewType);
    const selectedView = viewTypes[index];
    setCurrentView(selectedView);
    setActiveTabIndex(index);
  };

  const infoContent = () => {
    return (
      <span className={styles.whiteText}>
        <i className={styles.whiteText}>Edit a single phenotype</i>
        <br></br>
        <ul>
          <li>
            All parameters available for a single phenotype are displayed and editable in this
            table.
          </li>
          <li>Click the Component phenotypes tab to add component phenotypes.</li>
          <li>Changes made here are reflected in the Cohort Editor table as well.</li>
        </ul>
      </span>
    );
  };

  if (!data) {
    return (
      <SlideoverPanel title="Edit Phenotype" info={() => <span>No data available</span>}>
        <div>No phenotype data available</div>
      </SlideoverPanel>
    );
  }

  const renderAncestors = () => {
    if (data.type != 'component'){
      return;
    }
    const ancestors = dataService.cohortDataService.getAllAncestors(data);
    return (
        <div className={styles.ancestorsLabel}>
          {ancestors.map((ancestor, index) => (
            <React.Fragment key={ancestor.id}>
              <span 
                className={`${styles.ancestorLabel} ${typeStyles[`${ancestor.type || ''}_color_block`] || ''}`}
                onClick={() => onClickAncestor(ancestor as Phenotype)}
                style={{ cursor: 'pointer' }}
              >
                {ancestor.name || ancestor.id}
              </span>
              {index < ancestors.length - 1 && (
                <span className={styles.ancestorDivider}>{'|'}</span>
              )}
            </React.Fragment>
          ))}
        </div>
    );
  }

  return (
    <SlideoverPanel
      title="Edit Phenotype"
      info={infoContent()}
      classNameHeader={typeStyles[`${data.type}_color_block`]}
      classNameButton={styles.whiteText}
      classNameContainer={typeStyles[`${data.type}_border_color`]}
    >
      <div className={styles.wrapper}>
        <div className={`${styles.header} ${typeStyles[`${data.type}_color_block`]}`}>
          <EditableTextField
            value={phenotypeName}
            placeholder="Enter phenotype name..."
            classNameInput={styles.phenotypeNameInput}
            onChange={newValue => {
              setPhenotypeName(newValue);
            }}
            onSaveChanges={onSaveNameChanges}
          />
          {renderAncestors()}
        </div>
        <div className={styles.mainContainer}>
          <div className={styles.controlsContainer}>
            <Tabs
              width={400}
              height={25}
              tabs={tabs}
              onTabChange={onTabChange}
              active_tab_index={activeTabIndex}
              accentColor={`var(--color_${data.type})`}
            />
          </div>
          <div className={styles.bottomSection}>
            {currentView === PhenotypePanelViewType.Parameters && data && (
              <PhenotypeViewer data={data} />
            )}
            {currentView === PhenotypePanelViewType.ComponentPhenotypes && (
              <PhenotypeComponents data={data} />
            )}
          </div>
        </div>
      </div>
    </SlideoverPanel>
  );
};
