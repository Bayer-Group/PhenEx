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

          <h1>Welcome to PhenEx</h1>
        </div>
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
        <p>
          To get started, create a cohort or select an existing one in the left navigation area, or
          ask AI to generate one for you.
        </p>
      </div>
      <div className={`${styles.label} ${styles.bottomRight}`}></div>
    </div>
  );
};
