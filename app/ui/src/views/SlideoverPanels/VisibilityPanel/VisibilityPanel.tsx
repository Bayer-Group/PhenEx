import React, { useState, useEffect, useRef } from 'react';
// import styles from './ConstantsPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

// import { VisibilityTable } from './ConstantsTable';

export const VisibilityPanel: React.FC = () => {
  return (
    <SlideoverPanel title="Visibility">
      <div></div>
      {/* <ConstantsTable /> */}
    </SlideoverPanel>
  );
};
