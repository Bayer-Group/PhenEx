import React, { useState, useRef, useEffect } from 'react';
import styles from './MessagesDisplay.module.css';
import { Message, chatPanelDataService } from '../ChatPanelDataService';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { MainViewService, ViewType } from '../../MainView/MainView';
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
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
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
            {message.isLoading && message.text === '' && (!message.steps || message.steps.length === 0) ? (
              <div className={styles.loadingIndicator}>
                <span className={styles.dot}></span>
                <span className={styles.dot}></span>
                <span className={styles.dot}></span>
              </div>
            ) : (
              <>
                {/* Collapsible steps — VS Code Copilot style */}
                {message.steps && message.steps.length > 0 && (
                  <div style={{ marginBottom: message.text ? 8 : 0 }}>
                    <button
                      onClick={() => setExpandedSteps(prev => {
                        const next = new Set(prev);
                        next.has(message.id) ? next.delete(message.id) : next.add(message.id);
                        return next;
                      })}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#888', fontSize: 12, padding: '2px 0', display: 'flex',
                        alignItems: 'center', gap: 4,
                      }}
                    >
                      {message.isLoading
                        ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Working…</>
                        : <>{expandedSteps.has(message.id) ? '▾' : '▸'} {message.steps.length} step{message.steps.length !== 1 ? 's' : ''}</>
                      }
                    </button>
                    {expandedSteps.has(message.id) && (
                      <div style={{ marginTop: 4, paddingLeft: 12, borderLeft: '2px solid #444', fontSize: 12, color: '#aaa' }}>
                        {message.steps.map((step, i) => (
                          <div key={i} style={{ padding: '2px 0' }}>{step}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Final response text */}
                {message.text && (
                  <div
                    className={styles.markdownContent}
                    dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(message.text) }}
                  />
                )}
                {/* Pending changes — VS Code Copilot style, inline in the message */}
                {message.pendingChanges && message.pendingChanges.length > 0 && (
                  <div style={{
                    marginTop: 10,
                    borderTop: '1px solid #3a3a3a',
                    paddingTop: 8,
                  }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pending changes
                    </div>
                    {message.pendingChanges.map(({ cohortId, cohortName }) => (
                      <div key={cohortId} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 0', fontSize: 13,
                      }}>
                        {/* Clickable cohort name — navigates to cohort editor */}
                        <button
                          onClick={() => MainViewService.getInstance().navigateTo({
                            viewType: ViewType.CohortDefinition,
                            data: cohortId,
                          })}
                          style={{
                            flex: 1, textAlign: 'left', background: 'none', border: 'none',
                            color: '#7cb9e8', cursor: 'pointer', fontSize: 13, padding: 0,
                            textDecoration: 'underline', textUnderlineOffset: 3,
                          }}
                          title="Open cohort to review changes"
                        >
                          📄 {cohortName}
                        </button>
                        <button
                          onClick={() => chatPanelDataService.acceptForCohort(cohortId)}
                          style={{
                            background: '#1e3a26', color: '#4caf6e', border: '1px solid #2d5c38',
                            borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12,
                          }}
                        >Accept</button>
                        <button
                          onClick={() => chatPanelDataService.rejectForCohort(cohortId)}
                          style={{
                            background: '#3a1e1e', color: '#e06c6c', border: '1px solid #5c2d2d',
                            borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12,
                          }}
                        >Reject</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
