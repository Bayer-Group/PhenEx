import React from 'react';
import styles from './NavBar.module.css';

interface ViewNavBarProps {
  height: number;
}

export const ViewNavBar: React.FC<ViewNavBarProps> = ({ height }) => {
  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div className={styles.viewContent}>
        {/* View navigation content will go here */}
        View
      </div>
    </div>
  );
};
