import React, { useState, useRef, useEffect } from 'react';
import styles from './MessagesDisplay.module.css';
import ReactMarkdown from 'react-markdown';
import { Message, chatPanelDataService } from '../ChatPanelDataService';

interface MessagesDisplayProps {}

export const MessagesDisplay: React.FC<MessagesDisplayProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [featherOpacity, setFeatherOpacity] = useState(1);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPosition = container.scrollTop;
      const maxScroll = 200;
      const newOpacity = Math.max(0.4, 1 - scrollPosition / maxScroll);
      setFeatherOpacity(newOpacity);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMessages(chatPanelDataService.getMessages());
    const handleMessagesUpdated = (updatedMessages: Message[]) => {
      console.log('UPDAGED MESSAGES', updatedMessages);
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

  console.log('MESSAGES', messages);
  return (
    <div
      className={`${styles.container} ${!isScrolledToBottom ? styles.scrolling : ''}`}
      ref={messagesContainerRef}
    >
      <div className={styles.messagesContainer}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${message.isUser ? styles.userMessage : styles.assistantMessage}`}
          >
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
};
