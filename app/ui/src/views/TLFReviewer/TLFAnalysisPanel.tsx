import { FC, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { BACKEND_URL, authFetch } from '@/api/httpClient';
import { convertMarkdownToHTML } from '@/utils/markdown';
import styles from './TLFAnalysisPanel.module.css';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface TLFAnalysisPanelProps {
  studyId: string;
  executionId: string;
}

export const TLFAnalysisPanel: FC<TLFAnalysisPanelProps> = ({
  studyId,
  executionId,
}) => {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toolMessages, setToolMessages] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);
  
  const suggestedPrompts = [
    "How many patients are in the final cohort?",
    "Summarize the key demographic characteristics",
    "Are there any data quality issues I should be aware of?",
    "What are the main findings from the analysis?",
    "Show me treatment group comparisons",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentResponse, conversation]);

  const send = async (questionOverride?: string) => {
    const question = (questionOverride || input).trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setCurrentResponse('');
    setErrorMsg('');
    setToolMessages([]);
    cancelRef.current = false;

    try {
      const resp = await authFetch(`${BACKEND_URL}/study/${studyId}/tlf-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution_id: executionId,
          user_instructions: question,
          conversation: conversation.map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? resp.statusText);
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body.');

      let buffer = '';
      let fullResponse = '';
      const tools: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelRef.current) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'chunk') {
              fullResponse += msg.text;
              setCurrentResponse(fullResponse);
            } else if (msg.type === 'tool') {
              tools.push(msg.message);
              setToolMessages([...tools]);
            } else if (msg.type === 'error') {
              setErrorMsg(msg.message ?? 'AI error');
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      if (!cancelRef.current) {
        setConversation((prev) => [
          ...prev,
          { role: 'user', content: question },
          { role: 'assistant', content: fullResponse },
        ]);
        setCurrentResponse('');
        setToolMessages([]);
      }
    } catch (e: any) {
      if (!cancelRef.current) {
        setErrorMsg(e?.message ?? 'Failed to connect.');
      }
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={styles.panel}>
      {/* ── Conversation ─────────────────────────────────────────── */}
      <div className={styles.conversation}>
        {conversation.length === 0 && !isStreaming && !errorMsg && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Ask me anything about this study's outputs</p>
            <p className={styles.emptyHint}>I can autonomously explore all files to answer your questions.</p>
            <div className={styles.promptsGrid}>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  className={styles.promptButton}
                  onClick={() => send(prompt)}
                  disabled={isStreaming}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((turn, i) => (
          <div key={i} className={turn.role === 'user' ? styles.userTurn : styles.assistantTurn}>
            {turn.role === 'user' ? (
              <div className={styles.userBubble}>{turn.content}</div>
            ) : (
              <div
                className={styles.markdownContent}
                dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(turn.content, BACKEND_URL) }}
              />
            )}
          </div>
        ))}

        {toolMessages.length > 0 && (
          <div className={styles.toolMessages}>
            {toolMessages.map((msg, idx) => (
              <div key={idx} className={styles.toolMessage}>{msg}</div>
            ))}
          </div>
        )}

        {isStreaming && currentResponse && (
          <div className={styles.assistantTurn}>
            <div
              className={styles.markdownContent}
              dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(currentResponse, BACKEND_URL) }}
            />
          </div>
        )}

        {isStreaming && !currentResponse && !toolMessages.length && (
          <div className={styles.thinkingDots}><span /><span /><span /></div>
        )}

        {errorMsg && (
          <div className={styles.errorBubble}>{errorMsg}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div className={styles.inputBar}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a question… (↩ to send, ⇧↩ for newline)"
          rows={2}
          disabled={isStreaming}
        />
        <button
          className={styles.sendBtn}
          onClick={() => send()}
          disabled={!input.trim() || isStreaming}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
};
