import React from 'react';
import styles from './InfoPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortTextArea } from './CohortTextArea/CohortTextArea';

export const InfoPanel: React.FC = () => {
  const infoContent = () => {
    return (
      <span>
        <i>Information panel with rich text editor</i>
        <ul>
          <li>
            Use this panel to <em>create and edit notes</em> with rich text formatting
          </li>
          <li>
            The editor supports <em>bold, italic, lists, headers</em> and more formatting options
          </li>
          <li>
            Perfect for <em>documentation, notes, or detailed information</em> that needs formatting
          </li>
        </ul>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Info" info={infoContent()}>
      <div className={styles.container}>
        <div className={styles.editorWrapper}>
          <h3>Notes & Information</h3>
          <CohortTextArea />
        </div>
      </div>
    </SlideoverPanel>
  );
};
