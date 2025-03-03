import React, { useState } from 'react';
import styles from './ChatPanel.module.css';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onTextEnter }) => {
  const [inputText, setInputText] = useState('');

  // Dummy chat data
  const [messages] = useState<Message[]>([
    { id: 1, text: 'Hi, my name is Assistant. How can I help you today?', isUser: false },
    { id: 2, text: 'Hi! My name is User. I have some questions about the system.', isUser: true },
    { id: 3, text: "Of course! I'd be happy to help. What would you like to know?", isUser: false },
    { id: 4, text: 'Can you explain how the phenotype definitions work?', isUser: true },
    {
      id: 5,
      text: 'Phenotype definitions help categorize and describe specific traits or characteristics in a standardized way.',
      isUser: false,
    },
    { id: 6, text: 'Hi, my name is Assistant. How can I help you today?', isUser: false },
    { id: 7, text: 'Hi! My name is User. I have some questions about the system.', isUser: true },
    { id: 8, text: "Of course! I'd be happy to help. What would you like to know?", isUser: false },
    { id: 9, text: 'Can you explain how the phenotype definitions work?', isUser: true },
    {
      id: 10,
      text: 'Phenotype definitions help categorize and describe specific traits or characteristics in a standardized way.',
      isUser: false,
    },
    { id: 11, text: 'Hi, my name is Assistant. How can I help you today?', isUser: false },
    { id: 12, text: 'Hi! My name is User. I have some questions about the system.', isUser: true },
    {
      id: 13,
      text: "Of course! I'd be happy to help. What would you like to know?",
      isUser: false,
    },
    { id: 14, text: 'Can you explain how the phenotype definitions work?', isUser: true },
    {
      id: 15,
      text: 'Phenotype definitions help categorize and describe specific traits or characteristics in a standardized way.',
      isUser: false,
    },
    { id: 16, text: 'Hi, my name is Assistant. How can I help you today?', isUser: false },
    { id: 17, text: 'Hi! My name is User. I have some questions about the system.', isUser: true },
    {
      id: 18,
      text: "Of course! I'd be happy to help. What would you like to know?",
      isUser: false,
    },
    { id: 19, text: 'Can you explain how the phenotype definitions work?', isUser: true },
    {
      id: 20,
      text: 'Phenotype definitions help categorize and describe specific traits or characteristics in a standardized way.',
      isUser: false,
    },
  ]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputText.trim()) {
      onTextEnter?.(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.messagesContainer}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${
              message.isUser ? styles.userMessage : styles.assistantMessage
            }`}
          >
            {message.id} {message.text}
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
