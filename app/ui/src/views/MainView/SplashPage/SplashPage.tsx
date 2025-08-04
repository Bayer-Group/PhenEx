import React from 'react';
import styles from './SplashPage.module.css';
import phenexLogo from '../../../assets/bird_icon.png';

export const SplashPage = () => {
  return (
    <div className={styles.container}>
      <div className={`${styles.label} ${styles.topLeft}`}></div>
      <div className={styles.content}>
        <div className={styles.header}>
          <img src={phenexLogo} alt="PhenEx Logo" className={styles.logo} />

        </div>
        <div className={styles.text}>
          <p>
            <span className={styles.title}>PhenEx</span> allows you to define the medical content of an observation study in real world data.
          </p>
          <p>
            The code to extract this data is then <emph>automatically generated</emph>, giving you your analysis ready cohort, table 1, and basic outcome reporting.
          </p>
          <p>
            To get started, <emph>create a cohort</emph> or select an existing one in the left navigation area, or ask AI to generate one for you.
          </p>
      </div>
      </div>
      <div className={`${styles.label} ${styles.bottomRight}`}></div>
    </div>
  );
};
