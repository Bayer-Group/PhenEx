import React, { useState, useEffect, useRef } from 'react';
import styles from './ConstantsPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { ConstantsTable } from './ConstantsTable';

export const ConstantsPanel: React.FC = () => {

  const addConstant = () => {
        console.log("adding constant")
    };

  return (

    <SlideoverPanel 
      title="Constants"
    >
      <div className={styles.controls}>
        <button 
          onClick={addConstant} 
          className={styles.executeButton}
        >
          Add Constant
        </button>
      </div>
      <ConstantsTable />
    </SlideoverPanel>
  );
};
