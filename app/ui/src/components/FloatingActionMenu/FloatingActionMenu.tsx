import { FC } from 'react';
import styles from './FloatingActionMenu.module.css';

interface FloatingActionMenuProps {
  buttonTitles: string[];
  buttonActions: (() => void)[];
}

export const FloatingActionMenu: FC<FloatingActionMenuProps> = ({ buttonTitles, buttonActions }) => {
  return (
    <div className={styles.floatingMenu}>
      {buttonTitles.map((title, index) => (
        <button
          key={`${title}-${index}`}
          className={styles.menuButton}
          onClick={() => buttonActions[index]()}
        >
          {title}
        </button>
      ))}
    </div>
  );
};