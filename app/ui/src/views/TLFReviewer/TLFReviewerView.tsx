import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, BACKEND_URL, authFetch } from '@/api/httpClient';
import styles from './TLFReviewerView.module.css';
import { TLFDashboard } from './TLFDashboard';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { ChatServiceProvider } from '../ChatPanel/ChatServiceContext';
import { TLFChatService } from './TLFChatService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TLFManifest {
  study_id: string;
  study_name: string;
  execution_id: string;
  executed_at: string | null;
  files: any[];
}

export interface DashboardCard {
  id: string;
  card_type: 'summary' | 'insight' | 'issue';
  data: any;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TLFReviewerView = () => {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();

  const [manifest, setManifest] = useState<TLFManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Dashboard state
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Initialize Chat Service
  const chatService = useMemo(() => {
    if (!manifest) return null;
    return new TLFChatService(manifest.study_id, manifest.execution_id);
  }, [manifest?.study_id, manifest?.execution_id]);

  // Load manifest
  useEffect(() => {
    if (!studyId) return;
    setLoading(true);
    api
      .get(`/study/${studyId}/tlf-manifest`)
      .then((r) => {
        setManifest(r.data);
      })
      .catch((e) => setError(e?.response?.data?.detail ?? 'Failed to load study manifest.'))
      .finally(() => setLoading(false));
  }, [studyId]);

  // Auto-analyze on manifest load
  useEffect(() => {
    if (!manifest) return;
    
    const runAutoAnalysis = async () => {
      setAnalyzing(true);
      setAnalysisError('');
      setCards([]);
      
      try {
        const resp = await authFetch(`${BACKEND_URL}/study/${manifest.study_id}/tlf-auto-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            execution_id: manifest.execution_id,
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
              
              if (msg.type === 'card') {
                // Add card to dashboard
                const newCard: DashboardCard = {
                  id: `${msg.card_type}-${Date.now()}-${Math.random()}`,
                  card_type: msg.card_type,
                  data: msg.data,
                };
                setCards((prev) => [...prev, newCard]);
              } else if (msg.type === 'error') {
                setAnalysisError(msg.message ?? 'Analysis failed');
              } else if (msg.type === 'done') {
                setAnalyzing(false);
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch (e: any) {
        setAnalysisError(e?.message ?? 'Failed to analyze study outputs.');
        setAnalyzing(false);
      }
    };

    runAutoAnalysis();
  }, [manifest]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading study…</div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>{error || 'Study not found.'}</p>
          <button className={styles.backLink} onClick={() => navigate('/')}>← Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button className={styles.homeBtn} onClick={() => navigate('/')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
            <polyline points="9 21 9 12 15 12 15 21" />
          </svg>
          Home
        </button>
        <span className={styles.topBarSep}>/</span>
        <span className={styles.topBarTitle}>{manifest.study_name}</span>
        <div className={styles.topBarRight}>
          {manifest.executed_at && (
            <span className={styles.topBarMeta}>
              {new Date(manifest.executed_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Left: Dashboard ──────────────────────────────────────── */}
        <div className={styles.dashboardPanel}>
          <TLFDashboard
            cards={cards}
            analyzing={analyzing}
            error={analysisError}
          />
        </div>

        {/* ── Right: AI Chat ───────────────────────────────────────── */}
        <div className={styles.chatPanel}>
          {chatService && (
            <ChatServiceProvider service={chatService}>
              <ChatPanel />
            </ChatServiceProvider>
          )}
        </div>
      </div>
    </div>
  );
};
