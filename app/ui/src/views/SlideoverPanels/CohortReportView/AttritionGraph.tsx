import { FC, useState, useEffect } from 'react';
import { ReportDataService } from './ReportDataService';
import styles from './CohortReportView.module.css';
import attritionStyles from './AttritionGraph.module.css';
import typeStyles from '../../../styles/study_types.module.css';
import { PhenotypeType } from '../PhenotypeViewer/phenotype';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';

interface AttritionGraphProps {
  dataService: ReportDataService;
}

interface AttritionItem {
  phenotype: any;
  reportData: any;
  percentage?: number;
  count?: number;
}

export const AttritionGraph: FC<AttritionGraphProps> = ({ dataService }) => {
  const [attritionItems, setAttritionItems] = useState<AttritionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

      // Create a mock phenotype object for display purposes
      // We'll use the data from the report rather than trying to match with cohort phenotypes
      const mockPhenotype = {
        id: `report-${index}`,
        name: row.Name || `${row.Type} criterion`,
        type: row.Type || 'inclusion', // Default to inclusion if no type
        index: index
      };

      const item: AttritionItem = {
        phenotype: mockPhenotype,
        reportData: row,
        percentage: parseFloat(row['%']) || 0,
        count: parseInt(row.Remaining) || parseInt(row.N) || 0
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
      <div className={`${attritionStyles.phenotypeType} ${getColorClass(type)}`}>
        {type}
        {renderIndex(item.phenotype)}
      </div>
    );
  };

  // Render index if present
  const renderIndex = (phenotype: any) => {
    return <span className={attritionStyles.index}>{phenotype && phenotype.type !== 'entry' && phenotype.index}</span>;
  };

  // Render bar visualization
  const renderBar = (item: AttritionItem) => {
    const percentage = item.percentage || 0;
    const type = item.phenotype.type as PhenotypeType;
    const colorClass = getColorClass(type);
    
    // Calculate relative width: first bar should be 100% width, others relative to first
    const maxPercentage = attritionItems.length > 0 ? Math.max(...attritionItems.map(i => i.percentage || 0)) : 100;
    const relativeWidth = maxPercentage > 0 ? (percentage / maxPercentage) * 100 : 0;
    
    console.log(`Item: ${item.phenotype.name}, Percentage: ${percentage}%, Max: ${maxPercentage}%, Relative width: ${relativeWidth}%`);
    console.log('All items percentages:', attritionItems.map(i => i.percentage));
    
    return (
      <div className={attritionStyles.barContainer}>
        <div 
          className={`${attritionStyles.bar} ${colorClass}`}
          style={{ 
            width: `${relativeWidth}%`,
          }}
        >
          <span className={attritionStyles.barText}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <span className={attritionStyles.countText}>
          ({item.count || 0}) - {relativeWidth.toFixed(1)}%
        </span>
      </div>
    );
  };

  // Render phenotype item
  const renderAttritionItem = (item: AttritionItem, index: number) => {
    const phenotypeType = item.phenotype.type as PhenotypeType;
    const isSelected = selectedId === item.phenotype.id;
    const typeHoverClass = typeStyles[`${phenotypeType}_list_item`] || '';
    const typeSelectedClass = isSelected ? typeStyles[`${phenotypeType}_list_item_selected`] : '';
    
    return (
      <div
        key={`${item.phenotype.id}-${index}`}
        className={`${attritionStyles.attritionItem} ${typeHoverClass} ${typeSelectedClass}`}
        onClick={event => {
          event.stopPropagation();
          setSelectedId(item.phenotype.id);
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('phenotype', item.phenotype);
        }}
      >
        <div className={attritionStyles.itemHeader}>
          <div className={attritionStyles.itemTitle}>
            {renderTypeLabel(item)}
            <span className={attritionStyles.phenotypeName}>
              {item.phenotype.name}
            </span>
          </div>
        </div>
        <div className={attritionStyles.itemContent}>
          {renderBar(item)}
        </div>
      </div>
    );
  };

  return (
    <div className={attritionStyles.attritionGraph}>
        <div className={attritionStyles.header}>
          <h3>Attrition Flow</h3>
        </div>
        <div className={attritionStyles.itemsList}>
          {attritionItems.map((item, index) => renderAttritionItem(item, index))}
        </div>
        {attritionItems.length === 0 && (
          <div className={attritionStyles.emptyState}>
            <p>No attrition data available. Execute your cohort to see results.</p>
          </div>
        )}
    </div>
  );
};
