import React, { useState, useEffect, useRef } from 'react';
import styles from './ConstantsPanel.module.css';

import { ConstantsTable } from './ConstantsTable';
export const ConstantsPanel: React.FC = () => {

  const addConstant = () => {
        console.log("adding constant")
    };


  return (
    <div className={styles.container}>
      <div className={styles.title}>Constants</div>
      <div className={styles.controls}>
        <button 
          onClick={addConstant} 
          className={styles.executeButton}
        >
          Add Constant
        </button>
      </div>
      <div className={styles.content}>
        <ConstantsTable />
      </div>
    </div>
  );
};
