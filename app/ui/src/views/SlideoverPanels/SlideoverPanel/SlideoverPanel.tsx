import React, { useState } from 'react';
import styles from './SlideoverPanel.module.css';
import { Button } from '../../../components/Button/Button';

interface SlideoverPanelProps {
  title: string;
  info: string | undefined;
  children: React.ReactNode;
}

export const SlideoverPanel: React.FC<SlideoverPanelProps> = ({ title, info = '', children }) => {
  const [isOpen, setIsOpen] = useState(true); // Initial state set to open

  const toggleInfobox = () => {
    setIsOpen(prevState => !prevState);
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        {title}
        <Button title='Help' onClick={toggleInfobox} className={styles.infoButton} />

      </div>
      <div className={`${styles.infobox} ${isOpen ? styles.open : styles.closed}`}
        onClick={toggleInfobox}
      >
        {info}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};