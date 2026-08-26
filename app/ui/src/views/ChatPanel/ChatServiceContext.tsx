import React, { createContext, useContext, ReactNode } from 'react';
import { IChatService } from './IChatService';

const ChatServiceContext = createContext<IChatService | null>(null);

export const ChatServiceProvider: React.FC<{ service: IChatService; children: ReactNode }> = ({ service, children }) => {
  return (
    <ChatServiceContext.Provider value={service}>
      {children}
    </ChatServiceContext.Provider>
  );
};

export const useChatService = (): IChatService => {
  const context = useContext(ChatServiceContext);
  if (!context) {
    throw new Error('useChatService must be used within a ChatServiceProvider');
  }
  return context;
};
