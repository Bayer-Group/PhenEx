import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import styles from './InteractionArea.module.css';
import { chatPanelDataService } from '../ChatPanelDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
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
  const [isProvisional, setIsProvisional] = useState<boolean>(false);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textBoxRef.current) {
        textBoxRef.current.focus();
      }
    }
  }));

  // Check if cohort is provisional and update state accordingly
  // This is the SINGLE SOURCE OF TRUTH for whether buttons should show
  useEffect(() => {
    const checkProvisionalState = () => {
      const cohortDataService = CohortDataService.getInstance();
      const cohortData = cohortDataService.cohort_data;
      const provisional = cohortData?.is_provisional === true;
      setIsProvisional(provisional);
      
      // Set interaction state based PURELY on provisional status
      if (provisional) {
        setInteractionState('interactive');
      } else {
        setInteractionState('empty');
      }
    };

    // Check initial state
    checkProvisionalState();
    
    // If there are provisional changes but no chat history, show a system message
    const cohortDataService = CohortDataService.getInstance();
    const hasProvisionalChanges = cohortDataService.cohort_data?.is_provisional === true;
    const currentMessages = chatPanelDataService.getMessages();
    // Only count user messages for "has chat history" - system/AI messages don't count
    const hasChatHistory = currentMessages.filter(m => m.isUser).length > 0;
    
    console.log('🔔 Initial provisional check:', {
      hasProvisionalChanges,
      totalMessages: currentMessages.length,
      userMessages: currentMessages.filter(m => m.isUser).length,
      hasChatHistory
    });
    
    if (hasProvisionalChanges && !hasChatHistory) {
      console.log('✅ Adding provisional changes warning message');
      chatPanelDataService.addSystemMessage(
        'You have some unreviewed changes. Should we keep going from here or undo these changes? You can Accept to keep them, Reject to undo them, or continue chatting to make more changes.'
      );
    }

    // Listen for cohort updates to re-check provisional state
    const handleMessagesUpdated = () => {
      checkProvisionalState();
    };

    chatPanelDataService.onMessagesUpdated(handleMessagesUpdated);
    return () => chatPanelDataService.removeMessagesUpdatedListener(handleMessagesUpdated);
  }, []);

  useEffect(() => {
    const handleAICompletion = (success: boolean) => {
      if (!success) {
        // Only handle failure case - show retry button
        setInteractionState('retry');
      }
      // Success case: do nothing here - let checkProvisionalState handle button visibility
      // This ensures buttons are ONLY shown when cohort is actually provisional
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
    // Don't set state here - let checkProvisionalState handle it after the API call completes
    chatPanelDataService.acceptAIResult();
  };

  const handleReject = () => {
    // Handle reject action
    // Don't set state here - let checkProvisionalState handle it after the API call completes
    chatPanelDataService.rejectAIResult();
  };

  const handleRetry = () => {
    // Handle retry action
    setInteractionState('thinking');
    chatPanelDataService.retryAIRequest();
  };

  const handleNewChat = () => {
    // Check if cohort is provisional - require accept/reject first
    if (isProvisional) {
      alert('Please accept or reject the current changes before starting a new chat.');
      return;
    }
    
    // Clear conversation history and messages
    chatPanelDataService.clearMessages();
    setInteractionState('empty');
  };

  return (
    <div className={`${styles.interactionArea} ${userHasInteracted ? styles.experienced : styles.firstTimeUser}`}>
      <div className={styles.topBar}>
        <InteractionBar
          state={interactionState}
          isProvisional={isProvisional}
          onAccept={handleAccept}
          onReject={handleReject}
          onRetry={handleRetry}
          onNewChat={handleNewChat}
        />
      </div>
      <div className={styles.transparentHeaderGradient} />
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
