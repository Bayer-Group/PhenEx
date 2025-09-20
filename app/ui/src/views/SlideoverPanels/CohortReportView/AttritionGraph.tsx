import { FC, useState, useEffect } from 'react';
import { ReportDataService } from './ReportDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
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
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [attritionItems, setAttritionItems] = useState<AttritionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    updateAttritionData();
  }, [dataService.row_data, cohortDataService.cohort_data]);

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
    const cohortData = cohortDataService.cohort_data;
    
    if (!cohortData || !dataService.row_data) {
      setAttritionItems([]);
      return;
    }

    // Get phenotypes in order: entry, inclusions, exclusions
    const phenotypesToProcess = [];
    
    // Add entry criterion
    if (cohortData.entry_criterion) {
      phenotypesToProcess.push(cohortData.entry_criterion);
    }
    
    // Add inclusions
    if (cohortData.inclusions) {
      phenotypesToProcess.push(...cohortData.inclusions);
    }
    
    // Add exclusions
    if (cohortData.exclusions) {
      phenotypesToProcess.push(...cohortData.exclusions);
    }

    // Match phenotypes with report data
    phenotypesToProcess.forEach(phenotype => {
      // Find matching report data by name
      const reportRow = dataService.row_data.find(row => 
        row.name === phenotype.name || 
        row.phenotype === phenotype.name ||
        row.criterion === phenotype.name
      );
      
      const item: AttritionItem = {
        phenotype,
        reportData: reportRow || {},
        percentage: reportRow?.['%'] || reportRow?.percentage || 0,
        count: reportRow?.count || reportRow?.n || 0
      };
      
      items.push(item);
    });

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
    
    return (
      <div className={attritionStyles.barContainer}>
        <div 
          className={`${attritionStyles.bar} ${colorClass}`}
          style={{ width: `${percentage}%` }}
        >
          <span className={attritionStyles.barText}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <span className={attritionStyles.countText}>
          ({item.count || 0})
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
    <div className={styles.attritionGraph}>
      <div className={attritionStyles.container}>
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
    </div>
  );
};
