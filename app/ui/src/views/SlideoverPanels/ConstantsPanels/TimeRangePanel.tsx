import React from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { InfoPanelAddButton } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelAddButton';
import { TypedConstantsTable } from './TypedConstantsTable';

const CONSTANT_TYPE = 'DateFilter';
const DEFAULT_VALUE = {
  class_name: 'DateRangeFilter',
  min_date: null,
  max_date: null,
  type: 'date_range',
};

export const TimeRangePanel: React.FC = () => {
  const addConstant = () => {
    CohortDataService.getInstance().constants_service.addConstantOfType(CONSTANT_TYPE, DEFAULT_VALUE);
  };

  const headerControls = (
    <InfoPanelAddButton tooltipText="Add time range" onClick={addConstant} />
  );

  return (
    <SlideoverPanel
      title="Time ranges"
      info={
        <span>
          Define date range constants (e.g. index period, data period) used in phenotypes.
        </span>
      }
      headerControls={headerControls}
    >
      <TypedConstantsTable constantType={CONSTANT_TYPE} />
    </SlideoverPanel>
  );
};
