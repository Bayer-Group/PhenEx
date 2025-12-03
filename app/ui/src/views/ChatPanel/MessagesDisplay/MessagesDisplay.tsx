import React, { useState, useRef, useEffect } from 'react';
import styles from './MessagesDisplay.module.css';
import { Message, chatPanelDataService } from '../ChatPanelDataService';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';

interface MessagesDisplayProps {
  bottomMargin?: number;
}

// Ultra-simple markdown to HTML converter with nested list support
function convertMarkdownToHTML(markdown: string): string {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert lists with nesting support
  const lines = html.split('\n');
  const processed: string[] = [];
  const listStack: { type: string; indent: number }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    
    if (bulletMatch || numberMatch) {
      const indent = (bulletMatch?.[1] || numberMatch?.[1] || '').length;
      const content = bulletMatch?.[2] || numberMatch?.[2] || '';
      const currentType = bulletMatch ? 'ul' : 'ol';
      
      // Close lists that are at a deeper or equal indentation level
      while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
        const closed = listStack.pop()!;
        processed.push(`</${closed.type}>`);
      }
      
      // Open new list if we're at a new indentation level
      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
        processed.push(`<${currentType}>`);
        listStack.push({ type: currentType, indent });
      }
      
      processed.push(`<li>${content}</li>`);
    } else {
      // Close all open lists
      while (listStack.length > 0) {
        const closed = listStack.pop()!;
        processed.push(`</${closed.type}>`);
      }
      
      if (line.trim() === '') {
        processed.push('<br/>');
      } else if (!line.startsWith('<h') && !line.startsWith('<strong>')) {
        processed.push(`<p>${line}</p>`);
      } else {
        processed.push(line);
      }
    }
  }
  
  // Close any remaining open lists
  while (listStack.length > 0) {
    const closed = listStack.pop()!;
    processed.push(`</${closed.type}>`);
  }
  
  html = processed.join('\n');
  
  return html;
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
            <div 
              className={styles.markdownContent}
              dangerouslySetInnerHTML={{ 
                __html: convertMarkdownToHTML(message.text) 
              }}
            />
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
