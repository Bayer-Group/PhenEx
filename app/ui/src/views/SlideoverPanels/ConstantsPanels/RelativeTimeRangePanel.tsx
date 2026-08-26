import React from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { InfoPanelAddButton } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelAddButton';
import { TypedConstantsTable } from './TypedConstantsTable';

const CONSTANT_TYPE = 'RelativeTimeRangeFilter';
const DEFAULT_VALUE = {
  class_name: 'RelativeTimeRangeFilter',
  when: 'before',
  type: 'relative_time_range',
};

export const RelativeTimeRangePanel: React.FC = () => {
  const addConstant = () => {
    CohortDataService.getInstance().constants_service.addConstantOfType(CONSTANT_TYPE, DEFAULT_VALUE);
  };

  const headerControls = (
    <InfoPanelAddButton tooltipText="Add relative time range" onClick={addConstant} />
  );

  return (
    <SlideoverPanel
      title="Relative time ranges"
      info={
        <span>
          Define relative time range constants (e.g. baseline period, follow-up period) used in phenotypes.
        </span>
      }
      headerControls={headerControls}
    >
      <TypedConstantsTable constantType={CONSTANT_TYPE} />
    </SlideoverPanel>
  );
};
