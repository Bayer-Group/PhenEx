import { IChatService } from '../ChatPanel/IChatService';
import { Message, ConversationEntry } from '../ChatPanel/ChatPanelDataService';
import { BACKEND_URL, authFetch } from '@/api/httpClient';
import { createChatSession, addChatMessage, getChatMessages } from '@/api/chat_history/route';

export class TLFChatService implements IChatService {
  private messages: Message[] = [
    {
      id: 1,
      text: "Hello! I'm your TLF analysis assistant. I have autonomously explored this study's output files and extracted the insights shown on the dashboard.\n\nWhat else would you like to know? I help you dive deeper into the data.",
      isUser: false,
    }
  ];
  
  private lastMessageId = 1;
  private conversationHistory: ConversationEntry[] = [];
  private readonly MAX_HISTORY_ENTRIES = 25;
  private isAIRunning = false;
  private abortController: AbortController | null = null;
  
  private listeners: Set<(messages: Message[]) => void> = new Set();
  private completionListeners: Set<(success: boolean) => void> = new Set();
  private sessionChangeListeners: Set<(id: string | null) => void> = new Set();

  private _sessionId: string | null = null;

  constructor(
    private studyId: string,
    private executionId: string
  ) {}

  public getAppContext(): string { return 'tlf'; }
  public getStudyId(): string { return this.studyId; }

  public getMessages(): Message[] { return [...this.messages]; }
  public getUserMessageCount(): number { return this.messages.filter(m => m.isUser).length; }
  public isAIThinking(): boolean { return this.isAIRunning; }
  public getConversationHistory() { return [...this.conversationHistory]; }
  
  public getSessionId(): string | null { return this._sessionId; }

  public onMessagesUpdated(cb: (m: Message[]) => void) { this.listeners.add(cb); }
  public removeMessagesUpdatedListener(cb: (m: Message[]) => void) { this.listeners.delete(cb); }
  public onAICompletion(cb: (s: boolean) => void) { this.completionListeners.add(cb); }
  public removeAICompletionListener(cb: (s: boolean) => void) { this.completionListeners.delete(cb); }
  public onSessionChange(cb: (id: string | null) => void) { this.sessionChangeListeners.add(cb); }
  public removeSessionChangeListener(cb: (id: string | null) => void) { this.sessionChangeListeners.delete(cb); }

  private notify() { this.listeners.forEach(cb => cb([...this.messages])); }

  public clearMessages(): void {
    this.messages = [this.messages[0]];
    this.lastMessageId = 1;
    this.conversationHistory = [];
    this._sessionId = null;
    this.sessionChangeListeners.forEach(cb => cb(null));
    this.notify();
  }

  public stopAI(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isAIRunning = false;
    this.notify();
    this.completionListeners.forEach(cb => cb(false));
  }

  public async addUserMessageWithText(text: string): Promise<void> {
    if (!text.trim() || this.isAIRunning) return;

    // Add user message
    this.messages.push({
      id: ++this.lastMessageId,
      text: text,
      isUser: true,
    });
    this.conversationHistory.push({ user: text });
    
    // Ensure we have a session ID
    if (!this._sessionId) {
      try {
        const session = await createChatSession({ study_id: this.studyId, app_context: 'tlf' });
        this._sessionId = session.id;
        this.sessionChangeListeners.forEach(cb => cb(session.id));
        await addChatMessage(this._sessionId, { role: 'assistant', text: this.messages[0].text, study_id: this.studyId });
      } catch (e) {
        console.warn("Failed to create chat session", e);
      }
    }

    if (this._sessionId) {
      addChatMessage(this._sessionId, { role: 'user', text, study_id: this.studyId }).catch(console.error);
    }

    // Add loading AI message
    const aiMessageId = ++this.lastMessageId;
    this.messages.push({
      id: aiMessageId,
      text: '',
      isUser: false,
      isLoading: true,
      steps: [],
    });
    this.notify();

    await this.sendAIRequest(text, aiMessageId);
  }

  private async sendAIRequest(text: string, messageId: number): Promise<void> {
    this.isAIRunning = true;
    this.abortController = new AbortController();

    const aiMessage = this.messages.find(m => m.id === messageId)!;
    aiMessage.steps = [];

    try {
      const resp = await authFetch(`${BACKEND_URL}/study/${this.studyId}/tlf-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abortController.signal,
        body: JSON.stringify({
          execution_id: this.executionId,
          user_instructions: text,
          conversation: this.conversationHistory.map(t => {
            if (t.user) return { role: 'user', content: t.user };
            if (t.system) return { role: 'assistant', content: t.system };
            return { role: 'user', content: t.user_action || '' };
          }).filter(x => x.content),
        }),
      });

      if (!resp.ok) throw new Error('Network response was not ok');

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No body');

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'chunk') {
              aiMessage.text += msg.text;
              this.notify();
            } else if (msg.type === 'tool') {
              aiMessage.steps!.push(msg.message);
              this.notify();
            } else if (msg.type === 'error') {
              aiMessage.text += `\n\n**Error:** ${msg.message}`;
              this.notify();
            }
          } catch {}
        }
      }

      aiMessage.isLoading = false;
      this.conversationHistory.push({ system: aiMessage.text });
      
      if (this._sessionId) {
        addChatMessage(this._sessionId, { role: 'assistant', text: aiMessage.text, study_id: this.studyId }).catch(console.error);
      }
      
      this.isAIRunning = false;
      this.notify();
      this.completionListeners.forEach(cb => cb(true));

    } catch (e: any) {
      if (e.name === 'AbortError') return;
      aiMessage.isLoading = false;
      aiMessage.text = `Connection failed: ${e.message}`;
      this.isAIRunning = false;
      this.notify();
      this.completionListeners.forEach(cb => cb(false));
    }
  }

  public async loadChatSession(sessionId: string): Promise<void> {
    try {
      const dbMessages = await getChatMessages(sessionId);
      if (dbMessages.length === 0) return;

      this.messages = dbMessages.map(msg => ({
        id: ++this.lastMessageId,
        text: msg.text,
        isUser: msg.role === 'user',
        isLoading: false,
      }));

      this.conversationHistory = dbMessages.map(msg => 
        msg.role === 'user' ? { user: msg.text } : { system: msg.text }
      );

      this._sessionId = sessionId;
      this.sessionChangeListeners.forEach(cb => cb(sessionId));
      this.notify();
    } catch (error) {
      console.error('Failed to load TLF chat session:', error);
    }
  }
}
