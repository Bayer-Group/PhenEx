import { FC, useState, useEffect } from 'react';
import { ReportDataService } from './ReportDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import styles from './BaselineCharacteristics.module.css';
import typeStyles from '../../../styles/study_types.module.css';
import { PhenotypeType } from '../PhenotypeViewer/phenotype';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';

interface BaselineCharacteristicsProps {
  dataService: ReportDataService;
}

interface AttritionItem {
  phenotype: any;
  realPhenotype?: any; // The actual phenotype from cohort data
  reportData: any;
  percentage?: number;
  count?: number;
  delta?: string | number; // Delta value from report data
}

enum DisplayType {
  Count = 'count',
  Percentage = 'percentage',
}

export const BaselineCharacteristics: FC<BaselineCharacteristicsProps> = ({ dataService }) => {
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [attritionItems, setAttritionItems] = useState<AttritionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentDisplayType, setCurrentDisplayType] = useState<DisplayType>(
    DisplayType.Percentage
  );
  const graphTabs = Object.values(DisplayType).map(value => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  });


  const onGraphTabChange = (index: number) => {
    const viewTypes = Object.values(DisplayType);
    const selectedView = viewTypes[index];
    setCurrentDisplayType(selectedView);
  };
  useEffect(() => {
    updateAttritionData();
  }, [dataService.row_data]);

  useEffect(() => {
    const cohortViewerService = TwoPanelCohortViewerService.getInstance();
    const handleRightPanelChange = (viewType: any, extraData: any) => {
      if (viewType === 'phenotype' && extraData && extraData.id) {
        setSelectedId(extraData.id);
      } else {
        setSelectedId(null);
      }
    };
    cohortViewerService.addListener(handleRightPanelChange);
    
    const currentViewType = cohortViewerService.getCurrentViewType();
    const currentExtraData = cohortViewerService.getExtraData();
    handleRightPanelChange(currentViewType, currentExtraData);
    
    return () => {
      cohortViewerService.removeListener(handleRightPanelChange);
    };
  }, []);

  const updateAttritionData = () => {
    const items: AttritionItem[] = [];
    
    if (!dataService.row_data || dataService.row_data.length === 0) {
      setAttritionItems([]);
      return;
    }

    console.log('ReportDataService row_data:', dataService.row_data);

    // Process each row from the waterfall data directly
    dataService.row_data.forEach((row, index) => {
      // Skip the final_cohort row as it's just a summary
      if (row.Type === 'final_cohort') {
        return;
      }

      // Try to find the actual phenotype from cohort data
      let realPhenotype = null;
      const cohortData = cohortDataService.cohort_data;
      
      if (cohortData && row.Name) {
        // Search through all phenotypes for a name match
        const allPhenotypes = [
          ...(cohortData.phenotypes || []),
          ...(cohortData.entry_criterion ? [cohortData.entry_criterion] : []),
          ...(cohortData.inclusions || []),
          ...(cohortData.exclusions || []),
          ...(cohortData.characteristics || []),
          ...(cohortData.outcomes || [])
        ];
        
        realPhenotype = allPhenotypes.find(p => 
          p && p.name && p.name.toLowerCase().includes(row.Name.toLowerCase())
        );
        
        console.log(`Looking for phenotype with name "${row.Name}":`, realPhenotype);
      }

      // Create a mock phenotype object for display purposes
      const mockPhenotype = {
        id: realPhenotype?.id || `report-${index}`,
        name: row.Name || `${row.Type} criterion`,
        type: row.Type || 'inclusion', // Default to inclusion if no type
        index: index
      };

      const item: AttritionItem = {
        phenotype: mockPhenotype,
        realPhenotype: realPhenotype, // Store the real phenotype if found
        reportData: row,
        percentage: parseFloat(row['%']) || 0,
        count: parseInt(row.Remaining) || parseInt(row.N) || 0,
        delta: row.Delta || 0 // Extract delta from report data
      };
      
      items.push(item);
    });

    console.log('Processed attrition items:', items);
    setAttritionItems(items);
  };

  // Helper to get color class from type
  const getColorClass = (type: PhenotypeType) => {
    return `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  };

  // Render type label
  const renderTypeLabel = (item: AttritionItem) => {
    const type = item.phenotype.type as PhenotypeType;
    return (
      <div className={`${styles.phenotypeType}`}/*${getColorClass(type)}`}*/>
        {type}
        {renderIndex(item.phenotype)}
      </div>
    );
  };

  // Render index if present
  const renderIndex = (phenotype: any) => {
    return <span className={styles.index}>{phenotype && phenotype.type !== 'entry' && phenotype.index}</span>;
  };

  // Render delta if non-zero
  const renderDelta = (item: AttritionItem) => {
    const delta = item.delta;
    const deltaValue = typeof delta === 'string' ? parseFloat(delta) || 0 : delta || 0;
        
    // Only render if delta is non-zero
    if (deltaValue === 0 || delta === '' || delta === null || delta === undefined) {
      return null;
    }
    
    return (
        <span className={`${styles.deltaText} ${typeStyles[`$entry_text_color`]}`}>
          {/* <span className={styles.deltaFiller}>lose </span> */}
          {deltaValue > 0 ? '+' : ''}{deltaValue.toString()} 
          {/* <span className={styles.deltaFiller}>patients</span> */}
        </span>
    );
  };

  // Render bar visualization
  const renderBar = (item: AttritionItem) => {
    const percentage = item.percentage || 0;
    const type = item.realPhenotype.type as PhenotypeType;
    const colorClass = typeStyles[`${item.realPhenotype.type}_color_block`];
    
    // Use the actual percentage directly for width (not relative to max)
    // This way 100% = full width, 80% = 80% width, etc.
    const barWidth = Math.max(percentage, 0); // Ensure non-negative
    
    console.log(`Item: ${item.phenotype.name}, Percentage: ${percentage}%, Bar width: ${barWidth}%`);
    
    return (
      <div className={styles.barContainer}>
        <div className={styles.barArea}>
          <div 
            className={`${styles.bar} ${colorClass}`}
            style={{ 
              width: `${barWidth}%`,
            }}
          >
          </div>
            <span className={styles.barText}>
              {currentDisplayType === DisplayType.Percentage ? percentage.toFixed(1) : item.count}
              {currentDisplayType === DisplayType.Percentage ? '%' : ''}
            </span>
        </div>
        {/* <span className={`${styles.countText} ${typeStyles[`${item.realPhenotype.type}_text_color`]}`}>
          {item.count || 0}
        </span> */}
      </div>
    );
  };

  // Render bar visualization
  const renderSubBar = (item: AttritionItem, index: int) => {
    console.log(item, "RENDERING SUBBAR")
    const percentage = (item.reportData.N/attritionItems[0].reportData.N)*100 || 0;
    const type = item.phenotype.type as PhenotypeType;
    const colorClass = typeStyles[`${item.realPhenotype.type}_color_block`];
    
    // Use the actual percentage directly for width (not relative to max)
    // This way 100% = full width, 80% = 80% width, etc.
    const barWidth = Math.max(percentage, 0); // Ensure non-negative
    console.log("BAR WIDTH IS", barWidth, percentage)
    console.log(`Item: ${item.phenotype.name}, Percentage: ${percentage}%, Bar width: ${barWidth}%`);
    // if (index<2){
    //     return null;
    // }
    return (
      <div className={styles.subBarContainer}>
        <div className={styles.subBarArea}>
          <div 
            className={`${styles.subBar} ${colorClass}`}
            style={{ 
              width: `${barWidth}%`,
            }}
          >
          </div>
            <span className={styles.subBarText}>
              {currentDisplayType === DisplayType.Percentage ? percentage.toFixed(1) : item.reportData.N}
              {currentDisplayType === DisplayType.Percentage ? '%' : ''}
            </span>
        </div>

            {/* <span className={styles.countText}>
          {item.reportData.N || 0}
        </span> */}
      </div>
    );
  };

  // Render phenotype item
  const renderAttritionItem = (item: AttritionItem, index: number) => {
    const phenotypeType = item.realPhenotype.type as PhenotypeType;
    const isSelected = selectedId === item.phenotype.id;
    const typeHoverClass = typeStyles[`${phenotypeType}_list_item`] || '';
    const typeSelectedClass = isSelected ? typeStyles[`${phenotypeType}_list_item_selected`] : '';
    
    return (
      <div
        key={`${item.phenotype.id}-${index}`}
        className={`${styles.attritionItem} ${typeHoverClass} ${typeSelectedClass}`}
        onClick={event => {
          event.stopPropagation();
          setSelectedId(item.phenotype.id);
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          
          // Use the real phenotype if available, otherwise fall back to mock phenotype
          const phenotypeToDisplay = item.realPhenotype || item.phenotype;
          console.log('Displaying phenotype:', phenotypeToDisplay);
          
          cohortViewer.displayExtraContent('phenotype', phenotypeToDisplay);
        }}
      >
        <div className={styles.itemHeader}>
          <div className={styles.itemTitle}>
            {/* {renderTypeLabel(item)}
            <br></br> */}
            <span className={`${styles.phenotypeName} ${typeStyles[`${item.realPhenotype.type}_text_color`]}`}>
              {item.phenotype.name}
              {item.realPhenotype ? '' : ' (from report data)'}
            </span>
            {renderDelta(item)}
          </div>
        </div>
        <div className={styles.itemContent}>
          {renderBar(item)}
          {renderSubBar(item, index)}

        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
        <div className={styles.tabsContainer}>
          <Tabs
            tabs={graphTabs}
            onTabChange={onGraphTabChange}
            active_tab_index={Object.values(DisplayType).indexOf(currentDisplayType)}
          />
        </div>
        <div className={styles.itemsList}>
          {attritionItems.map((item, index) => renderAttritionItem(item, index))}
        </div>
        {attritionItems.length === 0 && (
          <div className={styles.emptyState}>
            <p>No attrition data available. Execute your cohort to see results.</p>
          </div>
        )}
    </div>
  );
};
