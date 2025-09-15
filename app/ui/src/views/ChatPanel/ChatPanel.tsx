import React, { useState, useRef, useEffect } from 'react';
import { VerticalSplitView } from './VerticalSplitView/VerticalSplitView';
import { InteractionArea, InteractionAreaRef } from './InteractionArea/InteractionArea';
import { MessagesDisplay } from './MessagesDisplay/MessagesDisplay';
import { chatPanelDataService } from './ChatPanelDataService';

interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = () => {
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const interactionAreaRef = useRef<InteractionAreaRef>(null);

  useEffect(() => {
    // Check initial state
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
    <VerticalSplitView userHasInteracted={userHasInteracted}>
      <MessagesDisplay></MessagesDisplay>
      <InteractionArea ref={interactionAreaRef} userHasInteracted={userHasInteracted}></InteractionArea>
    </VerticalSplitView>
  );
};
