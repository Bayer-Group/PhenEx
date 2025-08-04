import React, { useState, useEffect, useRef } from 'react';
import styles from './ConstantsPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

import { DatabaseFields } from './DatabaseFields';

export const DatabasePanel: React.FC = () => {
  return (
    <SlideoverPanel title="Database">
      <DatabaseFields />
    </SlideoverPanel>
  );
};
