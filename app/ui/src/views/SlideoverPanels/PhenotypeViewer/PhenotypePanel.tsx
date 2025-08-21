import React, { useState } from 'react';
import styles from './PhenotypePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import typeStyles from '../../../styles/study_types.module.css'
import { PhenotypeViewer } from './PhenotypeViewer';
import { Phenotype } from './PhenotypeDataService';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs'
import { PhenotypeComponents } from './PhenotypeComponents/PhenotypeComponents';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

enum PhenotypePanelViewType {
  Parameters = 'parameters',
  ComponentPhenotypes = 'componentPhenotypes',
}


export const PhenotypePanel: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const [currentView, setCurrentView] = useState<PhenotypePanelViewType>(PhenotypePanelViewType.Parameters);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

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
      <span className = {styles.whiteText}>
        <i className = {styles.whiteText}>Edit a single phenotype</i>
        <br></br>
        Currently editing : <strong>{data.name}</strong>
        <br></br>
        <ul>
          <li>{data.name} is currently a <strong>{data?.class_name}</strong>.</li>
          <li>
            All parameters available for <strong>{data?.class_name}</strong> are displayed and editable in this table.
          </li>
          <li>Add component phenotypes if necessary</li>
        </ul>
      </span>
    );
  };
  
  console.log("PHENOTYPE PANEL", currentView, "data:", data)
  
  if (!data) {
    return (
      <SlideoverPanel title="Phenotype Editor" info={() => <span>No data available</span>}>
        <div>No phenotype data available</div>
      </SlideoverPanel>
    );
  }
  
  return (
    <SlideoverPanel title="Phenotype Editor" info={infoContent()} classNameHeader={typeStyles[`${data.type}_color_block`]} classNameButton={styles.whiteText}>
      <div className={styles.mainContainer}>
        <div className={styles.controlsContainer}>
          <Tabs
            width={400}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={activeTabIndex}
          />
        </div>
        <div className={styles.bottomSection}>
          {currentView === PhenotypePanelViewType.Parameters && data && <PhenotypeViewer data={data} />}
          {currentView === PhenotypePanelViewType.ComponentPhenotypes && <PhenotypeComponents data={data} />}
        </div>
      </div>
    </SlideoverPanel>
  );
};
