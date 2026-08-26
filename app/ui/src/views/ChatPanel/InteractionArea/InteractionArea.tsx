import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import styles from './InteractionArea.module.css';
import { useChatService } from '../ChatServiceContext';
import { InteractionBar } from './InteractionBar';

interface InteractionAreaProps {
  userHasInteracted?: boolean;
  onHistory?: () => void;
}

export interface InteractionAreaRef {
  focus: () => void;
}

export const InteractionArea = forwardRef<InteractionAreaRef, InteractionAreaProps>(({ userHasInteracted = false, onHistory }, ref) => {
  const chatService = useChatService();
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [interactionState, setInteractionState] = useState<
    'empty' | 'thinking' | 'interactive' | 'retry'
  >('empty');
  const [isProvisional, setIsProvisional] = useState<boolean>(false);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textBoxRef.current) {
        textBoxRef.current.focus();
      }
    }
  }));

  // Check if cohort is provisional — only relevant in study context.
  useEffect(() => {
    if (chatService.getAppContext() !== 'study') return;

    const checkProvisionalState = () => {
      if (chatService.isAIThinking()) return;
      setIsProvisional(false);
      setInteractionState('empty');
    };

    checkProvisionalState();
    chatService.onMessagesUpdated(checkProvisionalState);
    return () => chatService.removeMessagesUpdatedListener(checkProvisionalState);
  }, []);

  // Listen for messages to track AI thinking state
  useEffect(() => {
    const handleMessagesUpdated = () => {
      setIsAIThinking(chatService.isAIThinking());
    };
    
    chatService.onMessagesUpdated(handleMessagesUpdated);
    return () => chatService.removeMessagesUpdatedListener(handleMessagesUpdated);
  }, []);

  useEffect(() => {
    const handleAICompletion = (success: boolean) => {
      setIsAIThinking(false);
      
      if (!success) {
        setInteractionState('retry');
      } else {
        if (chatService.getAppContext() === 'study') {
          // Study module handles provisional state via per-cohort accept/reject
          setInteractionState('empty');
        } else {
          setInteractionState('empty');
        }
      }
    };

    chatService.onAICompletion(handleAICompletion);

    return () => {
      chatService.removeAICompletionListener(handleAICompletion);
    };
  }, []);

  // Focus on mount/first render
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      if (textBoxRef.current) {
        textBoxRef.current.focus();
      }
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = textBoxRef.current?.innerText.trim();
      if (text) {
        handleSendMessage(text);
      }
    }
  };

  const handleSendMessage = (text?: string) => {
    const messageText = text || textBoxRef.current?.innerText.trim();
    if (!messageText) return;
    
    console.log('🎯 Setting state to THINKING');
    // Set state to thinking
    setInteractionState('thinking');
    setIsAIThinking(true);

    // Add user message
    chatService.addUserMessageWithText(messageText);

    // Clear the text box
    if (textBoxRef.current) {
      textBoxRef.current.innerText = '';
    }
  };

  const handleStopAI = () => {
    console.log('🛑 Stop button clicked');
    chatService.stopAI();
    setIsAIThinking(false);
    setInteractionState('empty');
  };

  const handleAccept = () => {
    // Handle accept action
    // Don't set state here - let checkProvisionalState handle it after the API call completes
    chatService.acceptAIResult();
  };

  const handleReject = () => {
    // Handle reject action
    // Don't set state here - let checkProvisionalState handle it after the API call completes
    chatService.rejectAIResult();
  };

  const handleRetry = () => {
    // Handle retry action
    setInteractionState('thinking');
    chatService.retryAIRequest();
  };

  const handleNewChat = () => {
    // Check if cohort is provisional - require accept/reject first
    if (isProvisional) {
      alert('Please accept or reject the current changes before starting a new chat.');
      return;
    }
    
    // Clear conversation history and messages
    chatService.clearMessages();
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
          onHistory={onHistory}
          onSend={() => handleSendMessage()}
          onStop={handleStopAI}
          isAIThinking={isAIThinking}
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
