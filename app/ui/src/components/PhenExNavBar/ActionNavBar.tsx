import React from 'react';
import styles from './NavBar.module.css';
import birdIcon from '../../assets/bird_icon.png';

interface ActionNavBarProps {
  height: number;
}

export const ActionNavBar: React.FC<ActionNavBarProps> = ({ height }) => {
  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div className={styles.actionButtons}>
        <button className={styles.actionButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2l10 6-10 6V2z" />
          </svg>
        </button>
        <span className={styles.issuesLabel}>issues</span>
        <button className={styles.actionButton}>
          <img src={birdIcon} alt="PhenEx" className={styles.birdIcon} />
        </button>
      </div>
    </div>
  );
};
