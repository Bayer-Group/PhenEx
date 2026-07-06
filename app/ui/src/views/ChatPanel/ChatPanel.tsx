import React, { useState, useRef, useEffect } from 'react';
import { MessagesDisplay } from './MessagesDisplay/MessagesDisplay';
import { HeightAdjustableContainer } from '../../components/HeightAdjustableContainer/HeightAdjustableContainer';
import styles from './ChatPanel.module.css'
import { InteractionArea, InteractionAreaRef } from './InteractionArea/InteractionArea';
import { chatPanelDataService } from './ChatPanelDataService';
import { ChatHistoryPanel } from './ChatHistoryPanel/ChatHistoryPanel';

interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = () => {
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [bottomContainerHeight, setBottomContainerHeight] = useState(200);
  const [showHistory, setShowHistory] = useState(false);
  const interactionAreaRef = useRef<InteractionAreaRef>(null);

  const studyId = chatPanelDataService['_studyId'] || undefined;

  const handleHeightChange = (height: number) => {
    setBottomContainerHeight(height);
  };

  useEffect(() => {
    const userMessageCount = chatPanelDataService.getUserMessageCount();
    setUserHasInteracted(userMessageCount > 0);

    const handleMessagesUpdated = () => {
      const currentUserMessageCount = chatPanelDataService.getUserMessageCount();
      if (currentUserMessageCount > 0) setUserHasInteracted(true);
    };

    chatPanelDataService.onMessagesUpdated(handleMessagesUpdated);
    return () => chatPanelDataService.removeMessagesUpdatedListener(handleMessagesUpdated);
  }, []);

  const handleResumeSession = () => {
    setShowHistory(false);
    setUserHasInteracted(chatPanelDataService.getUserMessageCount() > 0);
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {showHistory ? (
        <ChatHistoryPanel studyId={studyId} onResumeSession={handleResumeSession} />
      ) : (
        <>
          <MessagesDisplay bottomMargin={bottomContainerHeight} />
          <div className={styles.heightAdjustableContainer}>
            <HeightAdjustableContainer
              initialHeight={200}
              minHeight={200}
              maxHeight={400}
              onHeightChange={handleHeightChange}
            >
              <InteractionArea
                ref={interactionAreaRef}
                userHasInteracted={userHasInteracted}
                onHistory={() => setShowHistory(true)}
              />
            </HeightAdjustableContainer>
          </div>
        </>
      )}
    </div>
  );
};
