import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import styles from './InteractionArea.module.css';
import { chatPanelDataService } from '../ChatPanelDataService';
import { InteractionBar } from './InteractionBar';

interface InteractionAreaProps {
  userHasInteracted?: boolean;
}

export interface InteractionAreaRef {
  focus: () => void;
}

export const InteractionArea = forwardRef<InteractionAreaRef, InteractionAreaProps>(({ userHasInteracted = false }, ref) => {
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [interactionState, setInteractionState] = useState<
    'empty' | 'thinking' | 'interactive' | 'retry'
  >('empty');

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textBoxRef.current) {
        textBoxRef.current.focus();
      }
    }
  }));

  useEffect(() => {
    const handleAICompletion = (success: boolean) => {
      if (success) {
        setInteractionState('interactive');
      } else {
        setInteractionState('retry');
      }
    };

    chatPanelDataService.onAICompletion(handleAICompletion);

    return () => {
      chatPanelDataService.removeAICompletionListener(handleAICompletion);
    };
  }, []);

  // Focus on mount/first render
  useEffect(() => {
    if (textBoxRef.current) {
      textBoxRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = textBoxRef.current?.innerText.trim();
      if (text) {
        // Set state to thinking
        setInteractionState('thinking');

        // Add user message
        chatPanelDataService.addUserMessageWithText(text);

        // Clear the text box
        if (textBoxRef.current) {
          textBoxRef.current.innerText = '';
        }
      }
    }
  };

  const handleAccept = () => {
    // Handle accept action
    setInteractionState('empty');
    chatPanelDataService.acceptAIResult();
  };

  const handleReject = () => {
    // Handle reject action
    setInteractionState('empty');
    chatPanelDataService.rejectAIResult();
  };

  const handleRetry = () => {
    // Handle reject action
    setInteractionState('thinking');
    chatPanelDataService.retryAIRequest();
  };

  return (
    <div className={`${styles.interactionArea} ${userHasInteracted ? styles.experienced : styles.firstTimeUser}`}>
      <div className={styles.topBar}>
        <InteractionBar
          state={interactionState}
          onAccept={handleAccept}
          onReject={handleReject}
          onRetry={handleRetry}
        />
      </div>
      <div className={styles.wrapper}>
        <div
          className={`${styles.textBox} ${userHasInteracted ? styles.textBoxExperienced : styles.textBoxFirstTime}`}
          contentEditable="true"
          ref={textBoxRef}
          onKeyDown={handleKeyDown}
        ></div>
      </div>
    </div>
  );
});

InteractionArea.displayName = 'InteractionArea';
