import { FC, useState, useEffect } from 'react';
import { ButtonsBar } from '../../ButtonsBar/ButtonsBar';
import styles from './InteractionBar.module.css';

type InteractionState = 'empty' | 'thinking' | 'interactive';

interface InteractionBarProps {
  state: InteractionState;
  onAccept?: () => void;
  onReject?: () => void;
}

export const InteractionBar: FC<InteractionBarProps> = ({ state, onAccept, onReject }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (state === 'thinking') {
      intervalId = setInterval(() => {
        setDots(prev => {
          switch (prev) {
            case '':
              return '.';
            case '.':
              return '..';
            case '..':
              return '...';
            default:
              return '';
          }
        });
      }, 500);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state]);

  if (state === 'empty') {
    return null;
  }

  if (state === 'thinking') {
    return <span className={styles.thinkingContainer}>{dots}</span>;
  }

  return (
    <div className={styles.buttonContainer}>
      <ButtonsBar
        width="100%"
        height={40}
        buttons={['accept', 'reject']}
        actions={[onAccept || (() => {}), onReject || (() => {})]}
      />
    </div>
  );
};
