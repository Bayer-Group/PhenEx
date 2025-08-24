import React, { useState } from 'react';
import styles from './SlideoverPanel.module.css';
import { Button } from '../../../components/ButtonsAndTabs/Button/Button';

interface SlideoverPanelProps {
  title: string;
  info: string | React.ReactNode | undefined;
  children: React.ReactNode;
  classNameHeader?: string;
  classNameButton?: string;
  showTitle?: boolean;
}

export const SlideoverPanel: React.FC<SlideoverPanelProps> = ({ title, info = '', children, classNameHeader = '', classNameButton = '', showTitle = true }) => {
  const [isOpen, setIsOpen] = useState(true); // Initial state set to open

  const toggleInfobox = () => {
    setIsOpen(prevState => !prevState);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const renderHeader = () =>{
    return (
<div className={styles.title}>
          {title}
        </div>
    );
  }

  return (
    <div className={styles.container} onClick={onClick}>
      <div className={`${styles.header} ${classNameHeader}`}>
        {showTitle && renderHeader()}
        <Button title='Help' onClick={toggleInfobox} className={`${styles.infoButton} ${isOpen ? styles.open : styles.closed} ${classNameButton}`} />

        <div className={`${styles.infobox} ${isOpen ? styles.open : styles.closed}`}
          onClick={toggleInfobox}
        >
          {info}
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};