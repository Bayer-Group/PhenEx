import { FC, forwardRef, type ReactNode } from 'react';
import styles from './SectionCard.module.css';

interface SectionCardProps {
  title?: string;
  children: ReactNode;
}

export const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(
  ({ title, children }, ref) => (
    <div ref={ref} className={styles.card}>
      {title && <div className={styles.title}>{title}</div>}
      {children}
    </div>
  ),
);

SectionCard.displayName = 'SectionCard';
