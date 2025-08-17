import React from 'react';
import styles from './SplashPage.module.css';
import phenexLogo from '../../../assets/bird_icon.png';

export const SplashPage = () => {
  return (
    <div className={styles.container}>
      <div className={`${styles.label} ${styles.topLeft}`}></div>
      <div className={styles.header}>
        <img src={phenexLogo} alt="PhenEx Logo" className={styles.logo} />
      </div>

      <div className={styles.content}>
        <div className={styles.text}>
          <p>
            <span className={styles.title}>PhenEx</span> separates observational study definition
            from SQL code implementation.
          </p>
          <p>
            Define your study using PhenEx phenotypes, and the code to extract analysis-ready
            datasets is <emph>automatically generated</emph>. Table1 and time to event analyses are
            also included.
          </p>
          <p>
            To get started, <emph>create a cohort</emph> or select an existing one in the left
            navigation area, or generate one with AI.
          </p>
        </div>
      </div>
      <div className={`${styles.label} ${styles.bottomRight}`}></div>
    </div>
  );
};
