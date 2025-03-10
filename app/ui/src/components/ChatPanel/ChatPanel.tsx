import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';
import phenexFeather from '../../assets/phenx_feather.png';

import { VerticalSplitView } from './VerticalSplitView/VerticalSplitView';
import { InteractionArea } from './InteractionArea/InteractionArea';
import { MessagesDisplay } from './MessagesDisplay/MessagesDisplay';
interface ChatPanelProps {
  onTextEnter?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onTextEnter }) => {
  const [inputText, setInputText] = useState('');

  useEffect(() => {}, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputText.trim()) {
      onTextEnter?.(inputText.trim());
      setInputText('');
    }
  };

  return (
    <VerticalSplitView>
      <MessagesDisplay></MessagesDisplay>
      <InteractionArea></InteractionArea>
    </VerticalSplitView>
  );
};
