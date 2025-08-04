import { FC, useState, useEffect } from 'react';
import { ButtonsBar } from '../../../components/ButtonsBar/ButtonsBar';
import styles from './InteractionBar.module.css';

type InteractionState = 'empty' | 'thinking' | 'interactive' | 'retry';

interface InteractionBarProps {
  state: InteractionState;
  onAccept?: () => void;
  onReject?: () => void;
  onRetry?: () => void;
}

export const InteractionBar: FC<InteractionBarProps> = ({ state, onAccept, onReject, onRetry }) => {
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

  if (state === 'retry') {
    return (
      <div className={styles.buttonContainer}>
        <ButtonsBar width="100%" buttons={['Retry']} actions={[onRetry || (() => {})]} />
      </div>
    );
  }

  return (
    <div className={styles.buttonContainer}>
      <ButtonsBar
        width="100%"
        height={30}
        buttons={['accept', 'reject']}
        actions={[onAccept || (() => {}), onReject || (() => {})]}
      />
    </div>
  );
};
