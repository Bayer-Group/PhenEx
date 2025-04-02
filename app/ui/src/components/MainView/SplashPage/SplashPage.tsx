import React from 'react';
import styles from './SplashPage.module.css';
import phenexLogo from '../../../assets/phenx_feather.png';

export const SplashPage = () => {
  return (
    <div className={styles.container}>
      <div className={`${styles.label} ${styles.topLeft}`}>Select a cohort</div>
      <img src={phenexLogo} alt="PhenEx Logo" className={styles.logo} />
      <div className={styles.content}>

        <h1>Welcome to PhenEx</h1>
        <p>
          PhenEx allows you to define the medical content of an observational study using Real World
          Data.
        </p>
        <p>
          Which patients are you interested in observing? How do you want to characterize them? What
          outcomes are you interested in observing?
        </p>
        <p>
          Once defined, PhenEx automatically creates your analysis dataset with tested, reliable
          code.
        </p>
      </div>
      <div className={`${styles.label} ${styles.bottomRight}`}>Ask AI</div>
    </div>
  );
};
