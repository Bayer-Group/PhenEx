import React from 'react';
import { useFontsLoaded } from '../../contexts/FontLoaderContext';
import styles from './FontLoadingWrapper.module.css';

interface FontLoadingWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const FontLoadingWrapper: React.FC<FontLoadingWrapperProps> = ({ 
  children, 
  className = '' 
}) => {
  const { fontsLoaded } = useFontsLoaded();

  return (
    <>
      {!fontsLoaded && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingDot}></div>
        </div>
      )}
      <div 
        className={`${styles.fontWrapper} ${fontsLoaded ? styles.fontsLoaded : styles.fontsLoading} ${className}`}
      >
        {children}
      </div>
    </>
  );
};