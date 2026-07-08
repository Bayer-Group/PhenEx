import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

import {
  suggestChangesForStudy,
  getUserCohort,
  getPublicCohort,
  acceptChanges,
  rejectChanges,
} from '../../api/text_to_cohort/route';

import {
  createChatSession,
  addChatMessage,
  getChatMessages,
  type ChatMessage as DBChatMessage,
  type ChatSession,
} from '../../api/chat_history/route';

type MessageCallback = (messages: Message[]) => void;
type AICompletionCallback = (success: boolean) => void;
type SessionChangeCallback = (sessionId: string | null) => void;

export { type ChatSession };

export interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isLoading?: boolean;
  steps?: string[];
  stepsExpanded?: boolean;
  pendingChanges?: { cohortId: string; cohortName: string }[];
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
  private sessionChangeListeners: Set<SessionChangeCallback> = new Set();
  private _cohortDataService: CohortDataService | null = null;

  // Current DB session
  private _sessionId: string | null = null;

  // Study-mode fields
  private _studyMode: boolean = false;
  private _studyId: string = '';
  private _activeCohortId: string | null = null;
  public modifiedCohortIds: string[] = [];
  public modifiedCohortNames: string[] = [];
  
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
    this.persistMessage('user', text);
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

  public onSessionChange(callback: SessionChangeCallback): void {
    this.sessionChangeListeners.add(callback);
  }

  public removeSessionChangeListener(callback: SessionChangeCallback): void {
    this.sessionChangeListeners.delete(callback);
  }

  private notifySessionChangeListeners(): void {
    this.sessionChangeListeners.forEach(l => l(this._sessionId));
  }

  public getSessionId(): string | null {
    return this._sessionId;
  }

  /** Ensure a DB session exists for the current context, creating one if needed. */
  private async ensureSession(): Promise<string> {
    if (this._sessionId) return this._sessionId;
    try {
      const session = await createChatSession({
        study_id: this._studyMode ? this._studyId || undefined : undefined,
      });
      this._sessionId = session.id;
      this.notifySessionChangeListeners();
    } catch (e) {
      console.warn('Could not create chat session in DB:', e);
      // Generate a temporary client-side UUID so persistence can be retried later
      this._sessionId = crypto.randomUUID();
    }
    return this._sessionId!;
  }

  /** Persist a single message to the DB (fire-and-forget, errors are logged only). */
  private async persistMessage(role: 'user' | 'assistant', text: string): Promise<void> {
    if (!text.trim()) return;
    try {
      const sessionId = await this.ensureSession();
      await addChatMessage(sessionId, {
        study_id: this._studyMode ? this._studyId || undefined : undefined,
        role,
        text,
      });
    } catch (e) {
      console.warn('Failed to persist chat message:', e);
    }
  }

  /** Load a historical session: replace current messages and resume. */
  public async loadSession(session: ChatSession): Promise<void> {
    try {
      const dbMessages = await getChatMessages(session.id);
      this._sessionId = session.id;
      if (session.study_id) {
        this._studyMode = true;
        this._studyId = session.study_id;
      }
      // Rebuild messages array from DB records
      this.messages = [
        {
          id: 123,
          text: '# Hi, I\'m Fox. How can I help?\n1. **Create an entire cohort from scratch:**  enter a description of your entry criterion and any inclusion or exclusion criteria. \n2. **Modify an existing cohort:** ask for help on a single aspect of your study.',
          isUser: false,
        },
      ];
      this.lastMessageId = 123;
      this.conversationHistory = [];
      dbMessages.forEach((m: DBChatMessage) => {
        const msg: Message = {
          id: ++this.lastMessageId,
          text: m.text,
          isUser: m.role === 'user',
        };
        this.messages.push(msg);
        if (m.role === 'user') this.addUserMessageToHistory(m.text);
        else this.addSystemResponseToHistory(m.text);
      });
      this.notifyListeners();
      this.notifySessionChangeListeners();
    } catch (e) {
      console.error('Failed to load chat session:', e);
    }
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
    this.modifiedCohortIds = [];
    this.modifiedCohortNames = [];
    // Start a fresh DB session
    this._sessionId = null;
    this.notifySessionChangeListeners();
    this.notifyListeners();
  }

  public setStudyMode(studyId: string, activeCohortId?: string): void {
    this._studyMode = true;
    this._studyId = studyId;
    this._activeCohortId = activeCohortId ?? null;
  }

  public setActiveCohortHint(cohortId: string | null): void {
    this._activeCohortId = cohortId;
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
    let stream: ReadableStream<Uint8Array>;

    if (this._studyMode) {
      if (!this._studyId) {
        console.error('AI request failed: No study ID set in study mode');
        this.notifyAICompletionListeners(false);
        return;
      }
      try {
        stream = await suggestChangesForStudy(
          this._studyId,
          inputText.trim(),
          'gpt-4o',
          this.getConversationHistory(),
          undefined,
          this._activeCohortId ?? undefined,
        );
      } catch (error) {
        console.error('AI study request failed:', error);
        this.notifyAICompletionListeners(false);
        return;
      }
    } else {
      // Cohort-editor mode: route through the unified study endpoint using the
      // cohort's own study_id, passing the cohort_id as active_cohort_id hint.
      if (!this.cohortDataService.cohort_data || !this.cohortDataService.cohort_data.id) {
        console.error('AI request failed: No cohort data available');
        this.notifyAICompletionListeners(false);
        return;
      }
      const cohortId = this.cohortDataService.cohort_data.id;
      const studyId = this.cohortDataService.cohort_data.study_id as string | undefined;
      if (!studyId) {
        console.error('AI request failed: No study_id on cohort data');
        this.notifyAICompletionListeners(false);
        return;
      }
      let cohortDescription: string | null = null;
      if (this.cohortDataService.cohort_data.description) {
        try {
          const delta = this.cohortDataService.cohort_data.description;
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
      try {
        stream = await suggestChangesForStudy(
          studyId,
          inputText.trim(),
          'gpt-4o',
          this.getConversationHistory(),
          cohortDescription || undefined,
          cohortId,
        );
      } catch (error) {
        console.error('AI cohort request failed:', error);
        this.notifyAICompletionListeners(false);
        return;
      }
    }

    try {
      // Create the loading indicator message BEFORE making the request
      const assistantMessage: Message = {
        id: ++this.lastMessageId,
        text: '',
        isUser: false,
        isLoading: true,
      };
      this.messages.push(assistantMessage);
      this.notifyListeners();

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textBuffer = '';   // accumulate AI text, show all at once at end
      const steps: string[] = [];  // tool operations, shown collapsed
      
      console.log('Receiving AI response stream...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('AI response stream completed');
          break;
        }

        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                // Buffer text — reveal all at once when complete (VS Code Copilot style)
                if (data.message) textBuffer += data.message;
              } else if (data.type === 'tool_call') {
                // Accumulate tool steps — shown collapsed
                if (data.message) {
                  steps.push(data.message);
                  assistantMessage.steps = [...steps];
                  assistantMessage.isLoading = true;
                  this.notifyListeners();
                }
              } else if (data.type === 'tool_error') {
                if (data.message) {
                  steps.push(`❌ ${data.message}`);
                  assistantMessage.steps = [...steps];
                  this.notifyListeners();
                }
              } else if (data.type === 'error') {
                console.error('AI stream error:', data.message);
                textBuffer += `\n\n❌ **Error:** ${data.message}`;
                break;
              } else if (data.type === 'complete') {
                if (data.modified_cohort_ids?.length) {
                  this.modifiedCohortIds = data.modified_cohort_ids;
                  this.modifiedCohortNames = data.modified_cohort_names ?? [];
                  // Attach pending changes to the message bubble itself
                  assistantMessage.pendingChanges = data.modified_cohort_ids.map(
                    (id: string, i: number) => ({
                      cohortId: id,
                      cohortName: (data.modified_cohort_names ?? [])[i] ?? id,
                    })
                  );
                }
                break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE message:', parseError);
            }
          }
        }
      }
      
      // Reveal the full text response now that the stream is done
      assistantMessage.text = textBuffer;
      assistantMessage.isLoading = false;
      
      // Add the complete assistant response to history
      if (assistantMessage.text.trim()) {
        this.addSystemResponseToHistory(assistantMessage.text.trim());
        this.persistMessage('assistant', assistantMessage.text.trim());
      }

      // Refresh data after AI changes
      if (this._studyMode) {
        try {
          const { StudyDataService } = await import('../StudyViewer/StudyDataService');
          await StudyDataService.getInstance().refreshStudyData();
        } catch (error) {
          console.error('Failed to refresh study data after AI changes:', error);
        }
      } else if (this.cohortDataService.cohort_data?.id) {
        try {
          console.log('Fetching updated cohort after AI changes...');
          let response: any;
          try {
            const studyId = this.cohortDataService.cohort_data.study_id;
            const cohortId = this.cohortDataService.cohort_data.id;
            if (studyId) {
              response = await getUserCohort(studyId, cohortId, true);
            } else {
              response = await getPublicCohort(cohortId, true);
            }
          } catch (userCohortError: any) {
            const status = userCohortError?.response?.status ?? userCohortError?.status;
            if (status === 404) {
              response = await getPublicCohort(this.cohortDataService.cohort_data.id, true);
            } else {
              throw userCohortError;
            }
          }
          this.cohortDataService.updateCohortFromChat(response);
        } catch (error) {
          console.error('Failed to fetch updated cohort after AI changes:', error);
          this.notifyAICompletionListeners(false);
          return;
        }
      }
      this.notifyListeners();
      this.notifyAICompletionListeners(true);
      console.log('AI request completed successfully');
    } catch (error) {
      console.error('AI request failed:', error);
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage && !lastMessage.isUser && lastMessage.isLoading) {
        lastMessage.isLoading = false;
        this.notifyListeners();
      }
      this.notifyAICompletionListeners(false);
    }
  }

  public async acceptForCohort(cohortId: string): Promise<void> {
    try {
      this.addUserActionToHistory(`ACCEPT_CHANGES:${cohortId}`);
      const response = await acceptChanges(cohortId);
      if (this.cohortDataService.cohort_data?.id === cohortId) {
        this.cohortDataService.updateCohortFromChat(response);
      }
      this.modifiedCohortIds = this.modifiedCohortIds.filter(id => id !== cohortId);
      this.modifiedCohortNames = this.modifiedCohortNames.filter((_, i) =>
        this.modifiedCohortIds[i] !== cohortId
      );
      // Clear from message bubbles
      this.messages.forEach(m => {
        if (m.pendingChanges) m.pendingChanges = m.pendingChanges.filter(c => c.cohortId !== cohortId);
      });
      if (this._studyMode) {
        const { StudyDataService } = await import('../StudyViewer/StudyDataService');
        await StudyDataService.getInstance().refreshStudyData();
      }
      this.notifyListeners();
    } catch (error) {
      console.error(`Failed to accept changes for cohort ${cohortId}:`, error);
    }
  }

  public async rejectForCohort(cohortId: string): Promise<void> {
    try {
      this.addUserActionToHistory(`REJECT_CHANGES:${cohortId}`);
      const response = await rejectChanges(cohortId);
      if (this.cohortDataService.cohort_data?.id === cohortId) {
        this.cohortDataService.updateCohortFromChat(response);
      }
      this.modifiedCohortIds = this.modifiedCohortIds.filter(id => id !== cohortId);
      this.modifiedCohortNames = this.modifiedCohortNames.filter((_, i) =>
        this.modifiedCohortIds[i] !== cohortId
      );
      // Clear from message bubbles
      this.messages.forEach(m => {
        if (m.pendingChanges) m.pendingChanges = m.pendingChanges.filter(c => c.cohortId !== cohortId);
      });
      if (this._studyMode) {
        const { StudyDataService } = await import('../StudyViewer/StudyDataService');
        await StudyDataService.getInstance().refreshStudyData();
      }
      this.notifyListeners();
    } catch (error) {
      console.error(`Failed to reject changes for cohort ${cohortId}:`, error);
    }
  }

  public async acceptAIResult(): Promise<void> {
    try {
      if (!this.cohortDataService.cohort_data?.id) {
        console.error('Accept failed: No cohort ID available');
        return;
      }
      console.log('Accepting AI changes...');
      this.addUserActionToHistory('ACCEPT_CHANGES');
      
      const response = await acceptChanges(this.cohortDataService.cohort_data.id);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      console.log('AI changes accepted successfully');
    } catch (error) {
      console.error('Failed to accept AI changes:', error);
    }
  }

  public async rejectAIResult(): Promise<void> {
    try {
      if (!this.cohortDataService.cohort_data?.id) {
        console.error('Reject failed: No cohort ID available');
        return;
      }
      
      console.log('Rejecting AI changes...');
      // Track the reject action in conversation history
      this.addUserActionToHistory('REJECT_CHANGES');
      
      const response = await rejectChanges(this.cohortDataService.cohort_data.id);
      this.cohortDataService.updateCohortFromChat(response);
      this.notifyListeners();
      console.log('AI changes rejected successfully');
    } catch (error) {
      console.error('Failed to reject AI changes:', error);
    }
  }

  public retryAIRequest(): void {
    // Get the last user message
    const userMessages = this.messages.filter(message => message.isUser);
    if (userMessages.length === 0) {
      console.warn('Retry failed: No user messages found');
      return;
    }
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    // Resend the AI request with the last user message text
    this.sendAIRequest(lastUserMessage.text);
  }
}

export const chatPanelDataService = ChatPanelDataService.getInstance();
