import React from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { InfoPanelAddButton } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelAddButton';
import { TypedConstantsTable } from './TypedConstantsTable';

const CONSTANT_TYPE = 'CategoricalFilter';
const DEFAULT_VALUE = {
  class_name: 'CategoricalFilter',
  allowed_values: [],
};

export const CategoricalFilterPanel: React.FC = () => {
  const addConstant = () => {
    CohortDataService.getInstance().constants_service.addConstantOfType(CONSTANT_TYPE, DEFAULT_VALUE);
  };

  const headerControls = (
    <InfoPanelAddButton tooltipText="Add categorical filter" onClick={addConstant} />
  );

  return (
    <SlideoverPanel
      title="Categorical filters"
      info={
        <span>
          Define categorical filter constants (e.g. inpatient, outpatient) used in phenotypes.
        </span>
      }
      headerControls={headerControls}
    >
      <TypedConstantsTable constantType={CONSTANT_TYPE} />
    </SlideoverPanel>
  );
};
