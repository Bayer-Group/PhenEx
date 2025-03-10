import React, { useRef, useState, useEffect } from 'react';
import styles from './InteractionArea.module.css';
import { chatPanelDataService } from '../ChatPanelDataService';
import { InteractionBar } from './InteractionBar';

interface InteractionAreaProps {}

export const InteractionArea: React.FC<InteractionAreaProps> = () => {
  const textBoxRef = useRef<HTMLDivElement>(null);
  const [interactionState, setInteractionState] = useState<'empty' | 'thinking' | 'interactive'>(
    'empty'
  );
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  // Clear timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [timerId]);

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

        // Set a timer to change to interactive state after 3 seconds
        const timer = setTimeout(() => {
          setInteractionState('interactive');
        }, 10000);

        // Store timer ID for cleanup
        setTimerId(timer);
      }
    }
  };

  const handleAccept = () => {
    // Handle accept action
    setInteractionState('empty');
    // Clear any existing timer
    if (timerId) {
      clearTimeout(timerId);
      setTimerId(null);
    }
  };

  const handleReject = () => {
    // Handle reject action
    setInteractionState('empty');
    // Clear any existing timer
    if (timerId) {
      clearTimeout(timerId);
      setTimerId(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <InteractionBar state={interactionState} onAccept={handleAccept} onReject={handleReject} />
      </div>
      <div
        className={styles.textBox}
        contentEditable="true"
        ref={textBoxRef}
        onKeyDown={handleKeyDown}
      ></div>
    </div>
  );
};
