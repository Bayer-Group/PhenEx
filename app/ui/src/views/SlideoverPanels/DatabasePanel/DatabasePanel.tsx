import React, { useState } from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { DatabaseFields } from './DatabaseFields';
import { DatabaseTabTypes } from './DatabaseFields';
import { InfoPanelEllipsis } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelEllipsis';

interface DatabasePanelProps {
  showTitle?: boolean;
}

export const DatabasePanel: React.FC<DatabasePanelProps> = ({ showTitle = true }) => {
  const [mode, setMode] = useState<DatabaseTabTypes>(DatabaseTabTypes.Default);

  const toggleMode = () => {
    setMode((m) =>
      m === DatabaseTabTypes.Default ? DatabaseTabTypes.Manual : DatabaseTabTypes.Default
    );
  };

  const infoContent = () => {
    return (
      <span>
        <i>Set up your database connection.</i> To setup your database in PhenEx :
        <ol>
          <li>
            <em>Select a mapper</em> : what format is your data in? Currently supported in PhenEx UI
            are OMOP mappers
          </li>
          <li>
            <em>Select a connector</em> : PhenEx supports multiple backends such as Snowflake or a
            local database. Select whether you are using Snowflake or a local database.
          </li>
          <li>
            <em>Define a source database</em> : enter where your source data is.
          </li>
          <li>
            <em>Define the destination database</em> : enter where PhenEx should write cohort
            outputs to.
          </li>
        </ol>
      </span>
    );
  };

  const headerControls = (
    <InfoPanelEllipsis
      tooltipText={mode === DatabaseTabTypes.Default ? 'Switch to manual entry' : 'Switch to default'}
      onClick={toggleMode}
    />
  );

  return (
    <SlideoverPanel
      title="Database"
      info={infoContent()}
      showTitle={showTitle}
      headerControls={headerControls}
    >
      <DatabaseFields mode={mode} />
    </SlideoverPanel>
  );
};
