import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';
import { textToCohort } from '../../api/text_to_cohort/route';
import ReactMarkdown from 'react-markdown';
import phenexFeather from '../../assets/phenx_feather.png';
import { CohortDataService } from '../CohortViewer/CohortDataService';


interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isHtml?: boolean;
}

interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onTextEnter }) => {
  const [featherOpacity, setFeatherOpacity] = useState(1);
  const [inputText, setInputText] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [dataService] = useState(() => CohortDataService.getInstance());


  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPosition = container.scrollTop;
      const maxScroll = 200; // Adjust this value to control how quickly opacity changes
      const newOpacity = Math.max(.4, 1 - scrollPosition / maxScroll);
      setFeatherOpacity(newOpacity);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '# Hi, my name is Assistant.\nHow can I help you today?', isUser: false },
    
  ]);



  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputText.trim()) {
      const userMessage: Message = {
        id: messages.length + 1,
        text: inputText.trim(),
        isUser: true,
      };
      setMessages([...messages, userMessage]);
      if (onTextEnter) {
        onTextEnter(inputText.trim());
      }
      setInputText('');

      try {
        const response = await textToCohort({ user_request: inputText.trim() , current_cohort:dataService.cohort_data});
        const assistantMessage: Message = {
          id: messages.length + 2,
          text: response.explanation,
          isUser: false,
          isHtml: false,
        };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
        dataService.updateCohortFromChat(response.cohort)
      } catch (error) {
        console.error('Error fetching cohort explanation:', error);
      }
    }
  };

  return (
    <div className={styles.chatPanel}>
            <img 
        src={phenexFeather} 
        alt="Phenex Feather" 
        className={styles.image} 
        style={{ opacity: featherOpacity }}
      />
      <div className={styles.messagesContainer}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${
              message.isUser ? styles.userMessage : styles.assistantMessage
            }`}
            dangerouslySetInnerHTML={message.isHtml ? { __html: message.text } : undefined}
          >
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        ))}
      </div>
      <div className={styles.inputContainer}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          className={styles.input}
          rows={3}
        />
      </div>
    </div>
  );
};