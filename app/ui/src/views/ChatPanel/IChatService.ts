import { Message, ConversationEntry } from './ChatPanelDataService';

export interface IChatService {
  // State
  getMessages(): Message[];
  getUserMessageCount(): number;
  isAIThinking(): boolean;
  
  // Actions
  addUserMessageWithText(text: string): Promise<void>;
  stopAI(): void;
  clearMessages(): void;
  
  // Specific to study agent (we'll make these no-ops in TLF)
  acceptAIResult?(): void;
  rejectAIResult?(): void;
  retryAIRequest?(): void;
  addSystemMessage?(text: string): void;
  
  // History management
  getConversationHistory(): ConversationEntry[];
  
  // Listeners
  onMessagesUpdated(callback: (messages: Message[]) => void): void;
  removeMessagesUpdatedListener(callback: (messages: Message[]) => void): void;
  onAICompletion(callback: (success: boolean) => void): void;
  removeAICompletionListener(callback: (success: boolean) => void): void;
  onSessionChange(callback: (sessionId: string | null) => void): void;
  removeSessionChangeListener(callback: (sessionId: string | null) => void): void;
  
  // DB Session persistence
  loadChatSession?(sessionId: string): Promise<void>;
  getSessionId?(): string | null;
  
  // Context
  getAppContext(): string;
  getStudyId(): string | undefined;
}
