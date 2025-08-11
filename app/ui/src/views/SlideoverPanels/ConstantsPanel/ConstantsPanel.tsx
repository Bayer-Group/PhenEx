import React, { useState, useEffect, useRef } from 'react';
import styles from './ConstantsPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { ConstantsTable } from './ConstantsTable';

export const ConstantsPanel: React.FC = () => {
  const addConstant = () => {
    console.log('adding constant');
  };

  const infoContent = () => {
    return (
      <span>
        <i>Define constants used throughout your cohort</i> using this panel.
        <ul>
          <li>Constants are variables that you define, with some provided by default by PhenEx. These defaults can be edited here.</li>
          <li>Create a constant if you find yourself defining the same variable more than once</li>
          <li>Using constants, any changes you make here apply to any phenotype using the constant</li>
          <li>Use for things like 'baseline period', defining what 'inpatient' means, etc.</li>
        </ul>
        To use constants in PhenEx :
        <ol>
          <li><em>Create a constant</em> : <i>click</i> <code>Add Constant</code> below.</li>
          <li><em>Select type</em> : In the constants editor below, select what type of constant you want to define i.e. whether it is a date filter or categorical filter.</li>
          <li><em>Edit constants in the table</em> : click on the value column to open an editor; edit parameters there.</li>
          <li><em>Use the constants</em> : constants are available in the phenotype editing area.</li>
        </ol>  
      </span>
    )
  }

  return (
    <SlideoverPanel 
      title="Constants"
      info={infoContent()}
      >
      <div className={styles.controls}>
        <button onClick={addConstant} className={styles.executeButton}>
          Add Constant
        </button>
      </div>
      <ConstantsTable />
    </SlideoverPanel>
  );
};
