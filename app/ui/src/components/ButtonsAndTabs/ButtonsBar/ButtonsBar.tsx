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
      {buttons.map((button, index) => {
        const buttonLower = button.toLowerCase();
        const isAccept = buttonLower === 'accept';
        const isReject = buttonLower === 'reject';
        const isRetry = button === 'Retry';
        const isNewChat = button === 'New Chat';
        const isHistory = button === 'History';
        const isBack = button === 'Back';
        
        // Determine styles based on button type
        let backgroundColor: string;
        let color: string;
        let border: string;
        
        if (isAccept) {
          backgroundColor = 'var(--color_inclusion)';
          color = 'white';
          border = '1px solid var(--color_inclusion)';
        } else if (isReject) {
          backgroundColor = 'var(--color_exclusion)';
          color = 'white';
          border = '1px solid var(--color_exclusion)';
        } else if (isRetry) {
          backgroundColor = 'var(--color_inclusion)';
          color = 'white';
          border = '1px solid var(--color_inclusion)';
        } else if (isNewChat || isHistory || isBack) {
          // Make New Chat, History, and Back buttons solid (non-transparent)
          backgroundColor = 'var(--button-color-inactive)';
          color = 'var(--text-color-inactive)';
          border = '1px solid var(--line-color)';
        } else {
          backgroundColor = 'transparent';
          color = 'var(--text-color-inactive)';
          border = '1px solid var(--line-color)';
        }
        
        return (
          <button 
            key={index} 
            className={styles.button} 
            style={{
              backgroundColor,
              color,
              border,
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
        );
      })}
    </div>
  );
};
