import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

import {
  textToCohort,
  getCohort,
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
      text: '# Create cohorts with AI\n1. **Create an entire cohort from scratch:**  enter a description of your entry criterion and any inclusion or exclusion criteria. \n2. **Modify an existing cohort:** ask for help on a single aspect of your study.',
      isUser: false,
    },
  ];
  private lastMessageId = this.messages.length;
  private listeners: Set<MessageCallback> = new Set();
  private aiCompletionListeners: Set<AICompletionCallback> = new Set();
  private cohortDataService = CohortDataService.getInstance();
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
    try {
      const stream = await textToCohort({
        user_request: inputText.trim(),
        current_cohort: this.cohortDataService.cohort_data,
      });

      console.log('Stream received from textToCohort');
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream reading completed');
          break;
        }

        console.log('Stream chunk received:', value);
        const decodedChunk = decoder.decode(value, { stream: true });
        const processedText = this.processMessageText(decodedChunk);
        if (processedText) {
          assistantMessage.text += processedText;
          this.notifyListeners();
        }
      }

      console.log('Finalizing assistant response');
      const response = await getCohort(this.cohortDataService.cohort_data.id, true);
      console.log('Response from textToCohort:', response);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      this.notifyAICompletionListeners(true);
      console.log('AI request completed successfully');
    } catch (error) {
      console.error('Error in sendAIRequest:', error);
      this.notifyAICompletionListeners(false);
    }
  }

  public async acceptAIResult(): Promise<void> {
    try {
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
      const response = await rejectChanges(this.cohortDataService.cohort_data.id);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      console.log('AI result rejected successfully');
    } catch (error) {
      console.error('Error in rejectAIResult:', error);
    }
  }

  public retryAIRequest(): void {}
}

export const chatPanelDataService = ChatPanelDataService.getInstance();
