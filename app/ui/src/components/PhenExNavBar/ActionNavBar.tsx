import React from 'react';
import styles from './NavBar.module.css';
import birdIcon from '../../assets/bird_icon.png';
import playButton from '../../assets/icons/play_button.svg';

interface ActionNavBarProps {
  height: number;
}

export const ActionNavBar: React.FC<ActionNavBarProps> = ({ height }) => {
  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div className={styles.actionButtons}>
        <button className={styles.actionButton}>
          <img src={playButton} alt="Play" style={{ width: '30px', height: '30px' }} />
        </button>
        <span className={styles.issuesLabel}>issues</span>
        <button className={styles.actionButton}>
          <img src={birdIcon} alt="PhenEx" className={styles.birdIcon} />
        </button>
      </div>
    </div>
  );
};
