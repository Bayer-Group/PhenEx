import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

import {
  suggestChanges,
  getUserCohort,
  acceptChanges,
  rejectChanges,
} from '../../api/text_to_cohort/route';

type MessageCallback = (messages: Message[]) => void;
type AICompletionCallback = (success: boolean) => void;

export interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isLoading?: boolean;
}

export interface ConversationEntry {
  user?: string;
  system?: string;
  user_action?: string;
}

class ChatPanelDataService {
  private static instance: ChatPanelDataService;
  private messages: Message[] = [
    {
      id: 123,
      text: '# Hi, I\'m Fox. How can I help?\n1. **Create an entire cohort from scratch:**  enter a description of your entry criterion and any inclusion or exclusion criteria. \n2. **Modify an existing cohort:** ask for help on a single aspect of your study.',
      isUser: false,
    },
  ];
  private lastMessageId = this.messages.length;
  private conversationHistory: ConversationEntry[] = [];
  private readonly MAX_HISTORY_ENTRIES = 25;
  private listeners: Set<MessageCallback> = new Set();
  private aiCompletionListeners: Set<AICompletionCallback> = new Set();
  private _cohortDataService: CohortDataService | null = null;
  
  private get cohortDataService(): CohortDataService {
    if (!this._cohortDataService) {
      this._cohortDataService = CohortDataService.getInstance();
    }
    return this._cohortDataService;
  }
  
  private constructor() {}

  public static getInstance(): ChatPanelDataService {
    if (!ChatPanelDataService.instance) {
      ChatPanelDataService.instance = new ChatPanelDataService();
    }
    return ChatPanelDataService.instance;
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  public getUserMessageCount(): number {
    return this.messages.filter(message => message.isUser).length;
  }

  public addUserMessageWithText(text: string): Message {
    const newMessage: Message = {
      id: ++this.lastMessageId,
      text: text,
      isUser: true,
    };
    this.messages.push(newMessage);
    this.addUserMessageToHistory(text);
    this.notifyListeners();
    this.sendAIRequest(text);
    return newMessage;
  }

  public addSystemMessage(text: string): Message {
    const newMessage: Message = {
      id: ++this.lastMessageId,
      text: text,
      isUser: false,
    };
    this.messages.push(newMessage);
    this.notifyListeners();
    return newMessage;
  }

  public onMessagesUpdated(callback: MessageCallback): void {
    this.listeners.add(callback);
  }

  public removeMessagesUpdatedListener(callback: MessageCallback): void {
    this.listeners.delete(callback);
  }

  public onAICompletion(callback: AICompletionCallback): void {
    this.aiCompletionListeners.add(callback);
  }

  public removeAICompletionListener(callback: AICompletionCallback): void {
    this.aiCompletionListeners.delete(callback);
  }

  public clearMessages(): void {
    this.messages = [
      {
        id: 123,
        text: '# Hi, I\'m Fox. How can I help?\n1. **Create an entire cohort from scratch:**  enter a description of your entry criterion and any inclusion or exclusion criteria. \n2. **Modify an existing cohort:** ask for help on a single aspect of your study.',
        isUser: false,
      },
    ];
    this.lastMessageId = this.messages.length;
    this.conversationHistory = [];
    this.notifyListeners();
  }

  public getConversationHistory(): ConversationEntry[] {
    return [...this.conversationHistory];
  }

  private addToHistory(entry: ConversationEntry): void {
    this.conversationHistory.push(entry);
    
    // Trim history to MAX_HISTORY_ENTRIES, keeping most recent
    if (this.conversationHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY_ENTRIES);
    }
  }

  private addUserMessageToHistory(text: string): void {
    this.addToHistory({ user: text });
  }

  private addSystemResponseToHistory(text: string): void {
    this.addToHistory({ system: text });
  }

  private addUserActionToHistory(action: string): void {
    this.addToHistory({ user_action: action });
  }

  private notifyListeners(): void {
    const currentMessages = this.getMessages();
    this.listeners.forEach(listener => listener(currentMessages));
  }

  private notifyAICompletionListeners(success: boolean): void {
    this.aiCompletionListeners.forEach(listener => listener(success));
  }



  private async sendAIRequest(inputText: string): Promise<void> {
    console.log('sendAIRequest called with inputText:', inputText);
    
    // Check if cohort data is available
    if (!this.cohortDataService.cohort_data || !this.cohortDataService.cohort_data.id) {
      console.error('No cohort data available or missing cohort ID');
      this.notifyAICompletionListeners(false);
      return;
    }
    
    const cohortId = this.cohortDataService.cohort_data.id;
    
    // Extract plain text from description (which is a Quill Delta object)
    let cohortDescription: string | null = null;
    if (this.cohortDataService.cohort_data.description) {
      try {
        const delta = this.cohortDataService.cohort_data.description;
        // If it's a Quill Delta object, extract text from ops
        if (delta.ops && Array.isArray(delta.ops)) {
          cohortDescription = delta.ops
            .map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
            .join('')
            .trim();
        } else if (typeof delta === 'string') {
          cohortDescription = delta.trim();
        }
      } catch (e) {
        console.warn('Failed to extract cohort description:', e);
      }
    }
    
    console.log('Using cohort ID:', cohortId);
    console.log('Cohort description available:', !!cohortDescription);
    if (cohortDescription) {
      console.log('Description length:', cohortDescription.length, 'characters');
    }
    
    try {
      const stream = await suggestChanges(
        cohortId,
        inputText.trim(),
        "gpt-4o-mini",
        false,
        this.getConversationHistory(),
        cohortDescription || undefined
      );

      console.log('Stream received from suggestChanges');
      const assistantMessage: Message = {
        id: ++this.lastMessageId,
        text: '',
        isUser: false,
        isLoading: true,
      };
      this.messages.push(assistantMessage);
      this.notifyListeners();
      console.log('Assistant message initialized:', assistantMessage);

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream reading completed');
          break;
        }

        console.log('Stream chunk received:', value);
        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;

        // Process SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
              console.log('Parsed SSE data:', data);
              
              if (data.type === 'content') {
                // Regular AI content - just add to message
                if (data.message) {
                  assistantMessage.text += data.message;
                  this.notifyListeners();
                }
              } else if (data.type === 'info') {
                // Info messages - skip rendering
                // These are not useful to display
              } else if (data.type === 'tool_call') {
                // Tool call messages - skip rendering (internal operations)
                // User doesn't need to see these
              } else if (data.type === 'tool_result') {
                // Tool result messages - skip rendering (internal operations)
                // User doesn't need to see these
              } else if (data.type === 'tool_error') {
                // Tool error messages
                if (data.message) {
                  assistantMessage.text += `\n❌ **Error:** ${data.message}\n`;
                  this.notifyListeners();
                }
              } else if (data.type === 'function_explanation') {
                // Function call explanation - add with special formatting (legacy support)
                if (data.message) {
                  assistantMessage.text += `\n\n**🔄 Making changes:** ${data.message}\n\n`;
                  this.notifyListeners();
                }
              } else if (data.type === 'function_success') {
                // Function call success - add confirmation (legacy support)
                if (data.message) {
                  assistantMessage.text += `\n✅ ${data.message}\n`;
                  this.notifyListeners();
                }
              } else if (data.type === 'error') {
                console.error('Stream error:', data.message);
                assistantMessage.text += `\n\n❌ **Error:** ${data.message}`;
                this.notifyListeners();
                break;
              } else if (data.type === 'complete') {
                console.log('Stream completed');
                break;
              } else if (data.type === 'result') {
                console.log('Received result data:', data.data);
                // Handle result data if needed
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE message:', line, parseError);
            }
          }
        }
      }

      console.log('Finalizing assistant response');
      
      // Mark as no longer loading
      assistantMessage.isLoading = false;
      
      // Add the complete assistant response to history
      if (assistantMessage.text.trim()) {
        this.addSystemResponseToHistory(assistantMessage.text.trim());
      }
      
      if (this.cohortDataService.cohort_data?.id) {
        try {
          const response = await getUserCohort(this.cohortDataService.cohort_data.id, true);
          this.cohortDataService.updateCohortFromChat(response);
        } catch (error) {
          console.error('Error fetching updated cohort:', error);
          this.notifyAICompletionListeners(false);
          return;
        }
      }
      this.notifyListeners();
      console.log('About to call notifyAICompletionListeners(true)');
      this.notifyAICompletionListeners(true);
      console.log('AI request completed successfully');
    } catch (error) {
      console.error('Error in sendAIRequest:', error);
      // Mark the last assistant message as no longer loading if it exists
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage && !lastMessage.isUser && lastMessage.isLoading) {
        lastMessage.isLoading = false;
        this.notifyListeners();
      }
      this.notifyAICompletionListeners(false);
    }
  }

  public async acceptAIResult(): Promise<void> {
    try {
      if (!this.cohortDataService.cohort_data?.id) {
        console.error('No cohort ID available for accepting changes');
        return;
      }
      
      // Track the accept action in conversation history
      this.addUserActionToHistory('ACCEPT_CHANGES');
      
      const response = await acceptChanges(this.cohortDataService.cohort_data.id);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      console.log('AI result accepted successfully');
    } catch (error) {
      console.error('Error in acceptAIResult:', error);
    }
  }

  public async rejectAIResult(): Promise<void> {
    try {
      if (!this.cohortDataService.cohort_data?.id) {
        console.error('No cohort ID available for rejecting changes');
        return;
      }
      
      // Track the reject action in conversation history
      this.addUserActionToHistory('REJECT_CHANGES');
      
      const response = await rejectChanges(this.cohortDataService.cohort_data.id);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      console.log('AI result rejected successfully');
    } catch (error) {
      console.error('Error in rejectAIResult:', error);
    }
  }

  public retryAIRequest(): void {
    // Get the last user message
    const userMessages = this.messages.filter(message => message.isUser);
    if (userMessages.length === 0) {
      console.warn('No user messages found to retry');
      return;
    }
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    console.log('Retrying AI request with last user message:', lastUserMessage.text);
    
    // Resend the AI request with the last user message text
    this.sendAIRequest(lastUserMessage.text);
  }
}

export const chatPanelDataService = ChatPanelDataService.getInstance();
