import React, { useState, useRef, useEffect } from 'react';
import styles from './PhenotypePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import typeStyles from '../../../styles/study_types.module.css';
import { PhenotypeViewer } from './PhenotypeViewer';
import { Phenotype, PhenotypeDataService } from './PhenotypeDataService';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenotypeComponents } from './PhenotypeComponents/PhenotypeComponents';
import { SmartBreadcrumbs } from '../../../components/SmartBreadcrumbs';
import { SmartTextField } from '../../../components/SmartTextField';
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
  const [hierarchicalIndex, setHierarchicalIndex] = useState('');
  const [description, setDescription] = useState('');

  const [currentView, setCurrentView] = useState<PhenotypePanelViewType>(
    PhenotypePanelViewType.Parameters
  );
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  // Subscribe to data service updates
  useEffect(() => {
    const updateFromDataService = () => {
      if (dataService.currentPhenotype) {
        setPhenotypeName(dataService.currentPhenotype.name);
        setHierarchicalIndex(dataService.currentPhenotype.hierarchical_index || '');
        setDescription(dataService.currentPhenotype.description || '');
      }
    };

    // Initialize
    updateFromDataService();

    // Listen for updates
    dataService.addListener(updateFromDataService);

    return () => {
      dataService.removeListener(updateFromDataService);
    };
  }, [dataService]);

  // Initialize phenotype data when data changes
  useEffect(() => {
    if (data) {
      setPhenotypeName(data.name);
      setDescription(data.description || '');
    }
  }, [data]);

  // Reset to Parameters tab when data changes
  useEffect(() => {
    if (data) {
      setCurrentView(PhenotypePanelViewType.Parameters);
      setActiveTabIndex(0);
    }
  }, [data]);

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
      <SlideoverPanel title="" info={() => <span>No data available</span>}>
        <div>No phenotype data available</div>
      </SlideoverPanel>
    );
  }

  const renderBreadcrumbs = () => {
    // Get ancestors if this is a component phenotype
    const ancestors = data.type === 'component' 
      ? dataService.cohortDataService.getAllAncestors(data)
      : [];
    
    // Get cohort and study names
    const cohortName = dataService.getCohortName();
    const studyName = dataService.cohortDataService.getStudyNameForCohort();
    
    // Build breadcrumb items: My Studies, Study, Cohort, ancestors, then current phenotype
    const breadcrumbItems = [
      {
        displayName: 'My Studies',
        onClick: () => {
          window.location.href = '/studies';
        },
      },
      ...(studyName ? [{
        displayName: studyName,
        onClick: () => {
          const studyId = dataService.cohortDataService.cohort_data?.study_id;
          if (studyId) {
            window.location.href = `/studies/${studyId}`;
          }
        },
      }] : []),
      {
        displayName: cohortName || 'Unnamed Cohort',
        onClick: () => {
          // Close the phenotype panel to return to cohort view
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.hideExtraContent();
        },
      },
      ...ancestors.map(ancestor => ({
        displayName: ancestor.name || ancestor.id || 'Unnamed',
        onClick: () => onClickAncestor(ancestor as Phenotype),
      })),
      {
        displayName: phenotypeName || data.name || 'Unnamed Phenotype',
        onClick: () => {},
      },
    ];

    const handleEditLastItem = async (newValue: string) => {
      setPhenotypeName(newValue);
      dataService.valueChanged('name', newValue);
    };

    return (
      <>
      <div className={`${styles.index} ${typeStyles[`${data.effective_type}_text_color`]}`}>{hierarchicalIndex || data.hierarchical_index}</div>
      <SmartBreadcrumbs 
        items={breadcrumbItems} 
        onEditLastItem={handleEditLastItem}
        classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer}
        classNameBreadcrumbItem={`${styles.breadcrumbItem} ${typeStyles[`${data.effective_type}_text_color`]}`}
        classNameBreadcrumbLastItem={`${styles.breadcrumbLastItem} ${typeStyles[`${data.effective_type}_text_color`]}`}
        compact={false}
      />
      </>
    );
  };

  const renderDescription = () => {
    const handleDescriptionSave = (newValue: string) => {
      setDescription(newValue);
      dataService.valueChanged('description', newValue);
    };

    return (
      <div className={styles.descriptionContainer}>
        <SmartTextField
          value={description}
          onSave={handleDescriptionSave}
          placeholder="Add description..."
          className={`${styles.description} ${typeStyles[`${data.effective_type}_text_color`]}`}
        />
      </div>
    );
  };

  return (
    <SlideoverPanel
      title=""
      info={infoContent()}
      // classNameHeader={typeStyles[`${data.effective_type}_color_block_dim`]}
      // classNameButton={typeStyles[`${data.effective_type}_color_block_text_and_border`]}
      classNameContainer={styles.slideoverContainer}
    >
  
        <div className={`${styles.wrapper}`}>
        <div className={`${styles.header}`}>
          {renderBreadcrumbs()}
          {renderDescription()}
          <div className={styles.viewerSection}>
            <PhenotypeViewer data={data} />
          </div>

        </div>
          <div className={styles.componentsSection}>
            <PhenotypeComponents data={data} />
          </div>
      </div>
    </SlideoverPanel>
  );
};
