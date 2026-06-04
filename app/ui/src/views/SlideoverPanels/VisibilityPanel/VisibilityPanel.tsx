import React from 'react';
import styles from './VisibilityPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { VisibilityTable } from './VisibilityTable';

export const VisibilityPanel: React.FC = () => {
  const infoContent = () => {
    return (
      <span>
        <i>Determine what columns to show in the editing table</i> using this panel
        <ul>
          <li>
            <em>Move columns from 'hidden' to 'visible'</em> : The columns will be modified in
            phenotype table editors
          </li>
          <li>
            Always keep in mind that <em>not all parameters are accessible</em> through the
            phenotype table editor.
          </li>
          <li>
            Access all parameters of a phenotype by <em>clicking the edit button</em> on the
            phenotype name to open the Phenotype Editor.
          </li>
        </ul>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Visibility" info={infoContent()}>
      <div className={styles.container}>
        <VisibilityTable />
      </div>
    </SlideoverPanel>
  );
};
