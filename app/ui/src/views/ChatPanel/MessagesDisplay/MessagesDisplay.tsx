import React, { useState, useRef, useEffect } from 'react';
import styles from './MessagesDisplay.module.css';
import ReactMarkdown from 'react-markdown';
import { Message, chatPanelDataService } from '../ChatPanelDataService';
import { SimpleCustomScrollbar } from '../../../components/SimpleCustomScrollbar/SimpleCustomScrollbar';

interface MessagesDisplayProps {
  bottomMargin?: number;
}

export const MessagesDisplay: React.FC<MessagesDisplayProps> = ({ bottomMargin = 10 }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(chatPanelDataService.getMessages());
    const handleMessagesUpdated = (updatedMessages: Message[]) => {
      setMessages(updatedMessages);
    };

    chatPanelDataService.onMessagesUpdated(handleMessagesUpdated);
    return () => chatPanelDataService.removeMessagesUpdatedListener(handleMessagesUpdated);
  }, []);

  const scrollToBottom = () => {
    if (messagesContainerRef.current && isScrolledToBottom) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;

      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;
      setIsScrolledToBottom(isAtBottom);
    }
  };

  useEffect(() => {
    // Initial scroll to bottom
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    const container = messagesContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isScrolledToBottom]);

  // This effect ensures scrolling to bottom when panel becomes visible after being collapsed
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });

    if (messagesContainerRef.current) {
      observer.observe(messagesContainerRef.current);
    }

    return () => {
      if (messagesContainerRef.current) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div
        className={`${styles.messagesContainer} ${!isScrolledToBottom ? styles.scrolling : ''}`}
        ref={messagesContainerRef}
      >
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${message.isUser ? styles.userMessage : styles.assistantMessage}`}
            style={{
              marginBottom: index === messages.length - 1 ? `${bottomMargin + 20}px` : undefined
            }}
          >
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        ))}
      </div>
      <SimpleCustomScrollbar 
        targetRef={messagesContainerRef}
        orientation="vertical"
        marginTop={100}
        marginBottom={bottomMargin}
      />
    </div>
  );
};
