import { FC } from 'react';
import styles from './ButtonsBar.module.css';

interface ButtonsBarProps {
  width: string | number;
  height?: string | number;
  buttons: string[];
  actions: (() => void)[];
}

export const ButtonsBar: FC<ButtonsBarProps> = ({ width, height, buttons, actions }) => {
  return (
    <div
      className={styles.buttonsContainer}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
    >
      {buttons.map((button, index) => (
        <button 
          key={index} 
          className={styles.button} 
          style={{
            backgroundColor: button.toLowerCase() === 'accept' ? 'var(--color_inclusion)' : 
                           button.toLowerCase() === 'reject' ? 'var(--color_exclusion)' : 
                           button === 'Retry' ? 'var(--color_inclusion)' : 'transparent',
            color: button.toLowerCase() === 'accept' || button.toLowerCase() === 'reject' || button === 'Retry' ? 'white' : 'var(--text-color-inactive)',
            border: button.toLowerCase() === 'accept' ? '1px solid var(--color_inclusion)' : 
                    button.toLowerCase() === 'reject' ? '1px solid var(--color_exclusion)' : 
                    button === 'Retry' ? '1px solid var(--color_inclusion)' : '1px solid var(--line-color)',
            zIndex: 100
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof actions[index] === 'function') {
              try {
                actions[index]();
              } catch (error) {
                console.error(`ButtonsBar: Error executing action ${index}:`, error);
              }
            }
          }}
        >
          {button}
        </button>
      ))}
    </div>
  );
};
