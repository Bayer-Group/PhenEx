import React from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { DatabaseFields } from './DatabaseFields';

interface DatabasePanelProps {
  showTitle?: boolean;
  contentMode?: 'cohort' | 'study';
}

export const DatabasePanel: React.FC<DatabasePanelProps> = ({ showTitle = true, contentMode = 'study' }) => {
  const infoContent = () => {
    return (
      <span>
        <i>Set up your database connection.</i>
        <ol>
          <li>
            <em>Select a database</em> : choose from the pre-configured source datasets.
          </li>
          <li>
            <em>Select a schema</em> : pick the data version within that database.
          </li>
        </ol>
      </span>
    );
  };

  return (
    <SlideoverPanel
      title="Database"
      info={infoContent()}
      showTitle={showTitle}
    >
      <DatabaseFields contentMode={contentMode} />
    </SlideoverPanel>
  );
};
