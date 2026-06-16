import { FC, useState, useEffect } from 'react';
import { ButtonsBar } from '../../../components/ButtonsAndTabs/ButtonsBar/ButtonsBar';
import styles from './InteractionBar.module.css';

type InteractionState = 'empty' | 'thinking' | 'interactive' | 'retry';

interface InteractionBarProps {
  state: InteractionState;
  isProvisional?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onRetry?: () => void;
  onNewChat?: () => void;
}

export const InteractionBar: FC<InteractionBarProps> = ({ state, isProvisional = false, onAccept, onReject, onRetry, onNewChat }) => {
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

  if (state === 'thinking') {
    return <span className={styles.thinkingContainer}>{dots}</span>;
  }

  // For all states, show appropriate buttons
  let buttons: string[] = [];
  let actions: (() => void)[] = [];

  console.log('🔘 InteractionBar: Rendering with state:', state, 'isProvisional:', isProvisional);

  if (state === 'interactive') {
    // Only show ACCEPT/REJECT if the cohort is provisional
    if (isProvisional) {
      console.log('✅ InteractionBar: Showing Accept/Reject buttons (provisional=true)');
      buttons = ['Accept', 'Reject', 'New Chat'];
      actions = [
        onAccept || (() => {}),
        onReject || (() => {}),
        onNewChat || (() => {})
      ];
    } else {
      console.log('❌ InteractionBar: NOT showing Accept/Reject (provisional=false)');
      buttons = ['New Chat'];
      actions = [onNewChat || (() => {})];
    }
  } else if (state === 'retry') {
    // Show RETRY NEW CHAT
    buttons = ['Retry', 'New Chat'];
    actions = [
      onRetry || (() => {}),
      onNewChat || (() => {})
    ];
  } else {
    // For 'empty' state, show only NEW CHAT
    buttons = ['New Chat'];
    actions = [onNewChat || (() => {})];
  }

  return (
    <div className={styles.buttonContainer}>
      <ButtonsBar
        width="100%"
        height={30}
        buttons={buttons}
        actions={actions}
      />
    </div>
  );
};
