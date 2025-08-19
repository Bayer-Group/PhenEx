import React from 'react';
import styles from './InfoPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

export const InfoPanel: React.FC = () => {
  const infoContent = () => {
    return (
      <span>
        <i>Information panel for additional details and help</i>
        <ul>
          <li>
            This panel can be used to display <em>contextual information</em> and help content
          </li>
          <li>
            Content can be customized based on the current context or user selection
          </li>
        </ul>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Info" info={infoContent()}>
      <div className={styles.container}>
        <div>
          <p>This is a simple InfoPanel component.</p>
          <p>You can add any content here that provides information or help to users.</p>
        </div>
      </div>
    </SlideoverPanel>
  );
};
