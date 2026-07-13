import { FC } from 'react';
import { ButtonsBar } from '../../../components/ButtonsAndTabs/ButtonsBar/ButtonsBar';
import styles from './InteractionBar.module.css';
import { chatPanelDataService } from '../ChatPanelDataService';

type InteractionState = 'empty' | 'thinking' | 'interactive' | 'retry';

interface InteractionBarProps {
  state: InteractionState;
  isProvisional?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onRetry?: () => void;
  onNewChat?: () => void;
  onHistory?: () => void;
  onSend?: () => void;
  onStop?: () => void;
  isAIThinking?: boolean;
}

export const InteractionBar: FC<InteractionBarProps> = ({ 
  state, 
  isProvisional = false, 
  onAccept, 
  onReject, 
  onRetry, 
  onNewChat, 
  onHistory,
  onSend,
  onStop,
  isAIThinking = false
}) => {
  console.log('🔘 InteractionBar render - state:', state, 'isProvisional:', isProvisional, 'isAIThinking:', isAIThinking);

  // For all states, show appropriate buttons
  let buttons: string[] = [];
  let actions: (() => void)[] = [];

  console.log('🔘 InteractionBar: Rendering with state:', state, 'isProvisional:', isProvisional, 'isAIThinking:', isAIThinking);

  if (isAIThinking) {
    // Show thinking dots and Stop button
    console.log('🔘 Rendering STOP button with dots:', dots);
    return (
      <div className={styles.buttonContainer}>
        <ButtonsBar
          width="auto"
          height={30}
          buttons={['Stop']}
          actions={[() => {
            console.log('🛑 Stop button clicked!');
            if (onStop) onStop();
          }]}
        />
      </div>
    );
  }

  if (state === 'interactive') {
    // Only show ACCEPT/REJECT if the cohort is provisional
    if (isProvisional) {
      console.log('✅ InteractionBar: Showing Accept/Reject buttons (provisional=true)');
      buttons = ['Accept', 'Reject', 'New Chat', 'History', 'Send'];
      actions = [
        onAccept || (() => {}),
        onReject || (() => {}),
        onNewChat || (() => {}),
        onHistory || (() => {}),
        onSend || (() => {})
      ];
    } else {
      console.log('❌ InteractionBar: NOT showing Accept/Reject (provisional=false)');
      buttons = ['New Chat', 'History', 'Send'];
      actions = [onNewChat || (() => {}), onHistory || (() => {}), onSend || (() => {})];
    }
  } else if (state === 'retry') {
    // Show RETRY NEW CHAT
    buttons = ['Retry', 'New Chat', 'History', 'Send'];
    actions = [
      onRetry || (() => {}),
      onNewChat || (() => {}),
      onHistory || (() => {}),
      onSend || (() => {})
    ];
  } else {
    // For 'empty' state, show only NEW CHAT HISTORY SEND
    buttons = ['New Chat', 'History', 'Send'];
    actions = [onNewChat || (() => {}), onHistory || (() => {}), onSend || (() => {})];
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
