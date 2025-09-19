import React, { useEffect, useState, useRef } from 'react';
import styles from './VerticalSplitView.module.css';

interface VerticalSplitViewProps {
  children: React.ReactNode[];
  userHasInteracted?: boolean;
}

export const VerticalSplitView: React.FC<VerticalSplitViewProps> = ({ 
  children, 
  userHasInteracted = false
}) => {
  const [enableTransitions, setEnableTransitions] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const previousUserHasInteracted = useRef(userHasInteracted);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Set ready state immediately to prevent flicker
      setIsReady(true);
      // Enable transitions after a delay to allow for future state changes
      const timer = setTimeout(() => {
        setEnableTransitions(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Enable transitions when userHasInteracted changes from false to true
    if (!previousUserHasInteracted.current && userHasInteracted) {
      setEnableTransitions(true);
    }
    previousUserHasInteracted.current = userHasInteracted;
  }, [userHasInteracted]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>{children[0]}</div>
      <div className={`${styles.bottom} ${userHasInteracted ? styles.experienced : styles.firstTimeUser} ${enableTransitions ? styles.withTransition : ''} ${isReady ? styles.ready : styles.loading}`}>
        {children[1]}
      </div>
    </div>
  );
};
