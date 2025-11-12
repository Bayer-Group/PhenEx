import { FC, useState, useEffect, useRef } from 'react';
import { ReportDataService } from './ReportDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import attritionStyles from './AttritionGraph.module.css';
import typeStyles from '../../../styles/study_types.module.css';
import { PhenotypeType } from '../PhenotypeViewer/phenotype';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';

interface AttritionGraphProps {
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

export const AttritionGraph: FC<AttritionGraphProps> = ({ dataService }) => {
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [attritionItems, setAttritionItems] = useState<AttritionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentDisplayType, setCurrentDisplayType] = useState<DisplayType>(
    DisplayType.Percentage
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Render type label
  const renderTypeLabel = (item: AttritionItem) => {
    console.log("FOR TYEP LABEL", item.realPhenotype)
    const type = item.realPhenotype.type as PhenotypeType;
    return (
      <div className={`${attritionStyles.phenotypeType} ${typeStyles[`${type}_text_color`]}`}>
        {type}
        {renderIndex(item.realPhenotype)}
      </div>
    );
  };

  // Render index if present
  const renderIndex = (phenotype: any) => {
    return <span className={attritionStyles.index}>{phenotype && phenotype.type !== 'entry' && phenotype.index}</span>;
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
        <span className={`${attritionStyles.deltaText} ${typeStyles[`$entry_text_color`]}`}>
          {/* <span className={attritionStyles.deltaFiller}>lose </span> */}
          {deltaValue > 0 ? '+' : ''}{deltaValue.toString()} 
          {/* <span className={attritionStyles.deltaFiller}>patients</span> */}
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
      <div className={attritionStyles.barContainer}>
        <div className={attritionStyles.barArea}>
          <div 
            className={`${attritionStyles.bar} ${colorClass}`}
            style={{ 
              width: `${barWidth}%`,
            }}
          >
            <span className={attritionStyles.barText}>
              {currentDisplayType === DisplayType.Percentage ? percentage.toFixed(1) : item.count}
              {currentDisplayType === DisplayType.Percentage ? '%' : ''}
            </span>
          </div>

        </div>
        {/* <span className={`${attritionStyles.countText} ${typeStyles[`${item.realPhenotype.type}_text_color`]}`}>
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
    const barWidth = Math.max(percentage, 0); // Ensure non-negative
    return (
      <div className={attritionStyles.subBarContainer}>
        <div className={attritionStyles.subBarArea}>
          <div 
            className={`${attritionStyles.subBar} ${colorClass}`}
            style={{ 
              width: `${barWidth}%`,
            }}
          >
            <span className={attritionStyles.subBarText}>
              {currentDisplayType === DisplayType.Percentage ? percentage.toFixed(1) : item.reportData.N}
              {currentDisplayType === DisplayType.Percentage ? '%' : ''}
            </span>
              </div>

        </div>
      </div>
    );
  };

  // Render phenotype item
  const renderAttritionItem = (item: AttritionItem, index: number) => {
    if (!item.realPhenotype) {
      console.log("ERROR RENDERING ATTRITION ITEM", item)

      return null;
    }
    const phenotypeType = item.realPhenotype.type as PhenotypeType;
    const isSelected = selectedId === item.phenotype.id;
    const typeHoverClass = typeStyles[`${phenotypeType}_list_item`] || '';
    const typeSelectedClass = isSelected ? typeStyles[`${phenotypeType}_list_item_selected`] : '';
    
    return (
      <div
        key={`${item.phenotype.id}-${index}`}
        className={`${attritionStyles.attritionItem} ${typeHoverClass} ${typeSelectedClass}`}
        style={{
              marginBottom: index === attritionItems.length - 1 ? `${220 + 20}px` : undefined
            }}
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
        <div className={attritionStyles.itemHeader}>
          <div className={attritionStyles.itemTitle}>
            {renderTypeLabel(item)}
            <span className={`${attritionStyles.phenotypeName} ${typeStyles[`${item.realPhenotype.type}_text_color`]}`}>
              {item.phenotype.name}
              {item.realPhenotype ? '' : ' (from report data)'}
            </span>
            {renderDelta(item)}
          </div>
        </div>
        <div className={attritionStyles.itemContent}>
          {renderBar(item)}
          {renderSubBar(item, index)}

        </div>
      </div>
    );
  };

const renderFooter = () => {
    console.log(attritionItems);

    // Check if attritionItems exists and has at least one item
    const finalCohortSize = attritionItems && attritionItems.length > 0 
        ? attritionItems[attritionItems.length - 1].reportData.Remaining 
        : "N/A"; // Default value if attritionItems is empty or undefined
    const finalCohortPercentage = attritionItems && attritionItems.length > 0 
        ? attritionItems[attritionItems.length - 1].reportData['%'] 
        : "N/A"; // Default value if attritionItems is empty or undefined

        console.log("TRYING TO GET ATTRITION ITEMS", attritionItems)
    return (
        <div className={attritionStyles.footer}>
            Final cohort size: <span className={attritionStyles.finalCohortSize}>
                {finalCohortSize} ({finalCohortPercentage})
            </span>
        </div>
    );
};

  return (
    <div className={attritionStyles.container}>
        <div className={attritionStyles.tabsContainer}>
          <Tabs
            tabs={graphTabs}
            onTabChange={onGraphTabChange}
            active_tab_index={Object.values(DisplayType).indexOf(currentDisplayType)}
          />
        </div>
        {/* <div className ={attritionStyles.content}> */}
        <div className={attritionStyles.itemsList} ref={messagesContainerRef}>
          {attritionItems.map((item, index) => renderAttritionItem(item, index))}
          {attritionItems.length === 0 && (
            <div className={attritionStyles.emptyState}>
              <p>No attrition data available. Execute your cohort to see results.</p>
            </div>
          )}
        </div>

        {renderFooter()}
        <SimpleCustomScrollbar 
          targetRef={messagesContainerRef}
          orientation="vertical"
          marginTop={100}
          marginBottom={250}
        />
    </div>
  );
};
