import { FC } from 'react';
import styles from './ButtonsBar.module.css';

interface ButtonsBarProps {
  width: string | number;
  height: string | number;
  buttons: string[];
  actions: (() => void)[];
}

export const ButtonsBar: FC<ButtonsBarProps> = ({ width, height, buttons, actions }) => {
  return (
    <div
      className={styles.buttonsContainer}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    >
      {buttons.map((button, index) => (
        <button
          key={index}
          className={styles.button}
          onClick={() => actions[index]()}
        >
          {button}
        </button>
      ))}
    </div>
  );
};