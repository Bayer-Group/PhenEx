import React, { useState, useRef, useEffect } from 'react';
import { MessagesDisplay } from './MessagesDisplay/MessagesDisplay';
import { HeightAdjustableContainer } from '../../components/HeightAdjustableContainer/HeightAdjustableContainer';
import styles from './ChatPanel.module.css'
import { InteractionArea, InteractionAreaRef } from './InteractionArea/InteractionArea';
import { chatPanelDataService } from './ChatPanelDataService';

interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = () => {
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [bottomContainerHeight, setBottomContainerHeight] = useState(200);
  const interactionAreaRef = useRef<InteractionAreaRef>(null);

  const handleHeightChange = (height: number) => {
    setBottomContainerHeight(height);
  };

  useEffect(() => {
    // Check initial state - only user messages count for interaction
    const userMessageCount = chatPanelDataService.getUserMessageCount();
    setUserHasInteracted(userMessageCount > 0);

    // Listen for message updates to track when user first interacts
    const handleMessagesUpdated = () => {
      const currentUserMessageCount = chatPanelDataService.getUserMessageCount();
      if (currentUserMessageCount > 0) {
        setUserHasInteracted(true);
      }
    };

    chatPanelDataService.onMessagesUpdated(handleMessagesUpdated);
    return () => chatPanelDataService.removeMessagesUpdatedListener(handleMessagesUpdated);
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MessagesDisplay bottomMargin={bottomContainerHeight} />
      <div className={styles.heightAdjustableContainer}>
        <HeightAdjustableContainer
          initialHeight={200}
          minHeight={200}
          maxHeight={400}
          onHeightChange={handleHeightChange}
        >
          <InteractionArea ref={interactionAreaRef} userHasInteracted={userHasInteracted} />
        </HeightAdjustableContainer>
      </div>
    </div>
  );
};
