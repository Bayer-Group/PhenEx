import { CohortDataService } from '../CohortViewer/CohortDataService';

import { textToCohort } from '../../api/text_to_cohort/route';

type MessageCallback = (messages: Message[]) => void;

export interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

class ChatPanelDataService {
  private static instance: ChatPanelDataService;
  private messages: Message[] = [
    {
      id: 1,
      text: 'Hi\n ### I use **PhenEx** to help you generate evidence using Real World Data.\n\n\nI can help you build cohorts of patients with a similar condition, characterize them at the timepoint of interest, and assess clinical endpoints.\n\nAsk me more if you have questions!',
      isUser: false,
    },
  ];
  private lastMessageId = this.messages.length;
  private listeners: Set<MessageCallback> = new Set();
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
    console.log('HERE IS THE ISSUE ADDING USER MESSAGE');
    this.sendAIRequest(text);
    return newMessage;
  }

  public onMessagesUpdated(callback: MessageCallback): void {
    this.listeners.add(callback);
  }

  public removeMessagesUpdatedListener(callback: MessageCallback): void {
    this.listeners.delete(callback);
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

  private async sendAIRequest(inputText): void {
    try {
      const response = await textToCohort({ user_request: inputText.trim() , current_cohort:this.cohortDataService.cohort_data});
      const assistantMessage: Message = {
        id: ++this.lastMessageId,
        text: response.explanation,
        isUser: false,
      };
      this.cohortDataService.updateCohortFromChat(response.cohort)
      this.messages.push(assistantMessage);
      this.notifyListeners();
    } catch (error) {
      console.error('Error fetching cohort explanation:', error);
    }
  }
}

export const chatPanelDataService = ChatPanelDataService.getInstance();
