import React, { useEffect, useState } from 'react';
import styles from './ChatHistoryPanel.module.css';
import { getChatSessions, deleteChatSession, type ChatSession } from '../../../api/chat_history/route';
import { chatPanelDataService } from '../ChatPanelDataService';

interface ChatHistoryPanelProps {
  studyId?: string;
  onResumeSession: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function sessionLabel(session: ChatSession): string {
  if (session.title) return session.title;
  if (session.first_message) {
    return session.first_message.length > 60
      ? session.first_message.slice(0, 57) + '…'
      : session.first_message;
  }
  return 'Chat ' + formatDate(session.created_at);
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ studyId, onResumeSession }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getChatSessions(studyId);
      setSessions(data);
    } catch (e) {
      // Silently show empty state — the table may not exist yet (pending migration)
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [studyId]);

  const handleResume = async (session: ChatSession) => {
    await chatPanelDataService.loadSession(session);
    onResumeSession();
  };

  const handleDelete = async (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(session.id);
    try {
      await deleteChatSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (err) {
      console.warn('Failed to delete session:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className={styles.container}><p className={styles.empty}>Loading…</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>Chat History</span>
      </div>
      {sessions.length === 0 ? (
        <p className={styles.empty}>No previous chats.</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map(session => (
            <li key={session.id} className={styles.item} onClick={() => handleResume(session)}>
              <div className={styles.label}>{sessionLabel(session)}</div>
              <div className={styles.meta}>{formatDate(session.updated_at)}</div>
              <button
                className={styles.deleteBtn}
                title="Delete chat"
                disabled={deleting === session.id}
                onClick={e => handleDelete(session, e)}
              >
                {deleting === session.id ? '…' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
