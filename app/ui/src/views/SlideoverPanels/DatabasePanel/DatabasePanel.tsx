import React, { useState, useEffect, useRef } from 'react';
import styles from './ConstantsPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { DatabaseFields } from './DatabaseFields';

export const DatabasePanel: React.FC = () => {
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

  return (
    <SlideoverPanel title="Database" info={infoContent()}>
      <DatabaseFields />
    </SlideoverPanel>
  );
};
