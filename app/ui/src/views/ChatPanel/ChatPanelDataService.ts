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
    this.notifyListeners();
    this.sendAIRequest(text);
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
    this.messages = [];
    this.lastMessageId = 0;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const currentMessages = this.getMessages();
    this.listeners.forEach(listener => listener(currentMessages));
  }

  private notifyAICompletionListeners(success: boolean): void {
    this.aiCompletionListeners.forEach(listener => listener(success));
  }

  private buffer: string = '';
  private isInThinkingBlock: boolean = false;

  private processMessageText(chunk: string): string {
    this.buffer += chunk;
    let result = '';
    let currentIndex = 0;
    while (true) {
      if (this.isInThinkingBlock) {
        const endIndex = this.buffer.indexOf('-->', currentIndex);
        if (endIndex === -1) break;
        currentIndex = endIndex + '-->'.length;
        this.isInThinkingBlock = false;
      } else {
        const startIndex = this.buffer.indexOf('<!-- THINKING:', currentIndex);
        if (startIndex === -1) {
          result += this.buffer.slice(currentIndex);
          this.buffer = '';
          break;
        }
        result += this.buffer.slice(currentIndex, startIndex);
        currentIndex = startIndex + '<!-- THINKING:'.length;
        this.isInThinkingBlock = true;
      }
    }

    return result;
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
    console.log('Using cohort ID:', cohortId);
    
    try {
      const stream = await suggestChanges(
        cohortId,
        inputText.trim(),
        "gpt-4o-mini",
        false
      );

      console.log('Stream received from suggestChanges');
      const assistantMessage: Message = {
        id: ++this.lastMessageId,
        text: '',
        isUser: false,
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
                const processedText = this.processMessageText(data.message);
                if (processedText) {
                  assistantMessage.text += processedText;
                  this.notifyListeners();
                }
              } else if (data.type === 'error') {
                console.error('Stream error:', data.message);
                assistantMessage.text += `\n\nError: ${data.message}`;
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
      if (this.cohortDataService.cohort_data?.id) {
        try {
          const response = await getUserCohort(this.cohortDataService.cohort_data.id, true);
          console.log('Response from suggestChanges:', response);
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
      this.notifyAICompletionListeners(false);
    }
  }

  public async acceptAIResult(): Promise<void> {
    try {
      if (!this.cohortDataService.cohort_data?.id) {
        console.error('No cohort ID available for accepting changes');
        return;
      }
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
