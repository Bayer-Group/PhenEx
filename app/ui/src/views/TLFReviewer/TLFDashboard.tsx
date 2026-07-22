import { FC } from 'react';
import styles from './TLFDashboard.module.css';
import { DashboardCard } from './TLFReviewerView';

const safeStr = (val: unknown): string =>
  typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val ?? '');

interface TLFDashboardProps {
  cards: DashboardCard[];
  analyzing: boolean;
  error: string;
}

export const TLFDashboard: FC<TLFDashboardProps> = ({ cards, analyzing, error }) => {
  // Organize cards by type
  const summary = cards.find(c => c.card_type === 'summary');
  const insights = cards.filter(c => c.card_type === 'insight');
  const issues = cards.filter(c => c.card_type === 'issue');

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>Analysis Failed</p>
          <p className={styles.errorMessage}>{error}</p>

        </div>
      </div>
    );
  }

  if (analyzing && cards.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Analyzing study outputs...</p>
          <p className={styles.loadingHint}>
            The AI is exploring your files and extracting key insights.
            This usually takes 10-30 seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Executive Summary */}
      {summary && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>📋 Executive Summary</h2>
          <div className={styles.summaryContent}>
            {safeStr(summary.data.content)}
          </div>
        </section>
      )}

      {/* Main Insights */}
      {insights.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>✨ Main Insights</h2>
          <div className={styles.insightsList}>
            {insights.map((insight, idx) => (
              <InsightCard key={insight.id} data={insight.data} index={idx} />
            ))}
          </div>
        </section>
      )}

      {/* Potential Issues */}
      <section className={styles.section}>
        <details className={styles.issuesDetails} open={issues.length > 0}>
          <summary className={styles.sectionTitle}>⚠️ Potential Issues</summary>
          {issues.length === 0 ? (
            <div className={styles.noIssues}>
              {analyzing ? 'Checking for issues...' : 'No issues found yet.'}
            </div>
          ) : (
            <div className={styles.issuesList}>
              {issues.map((issue) => (
                <IssueCard key={issue.id} data={issue.data} />
              ))}
            </div>
          )}
        </details>
      </section>

      {analyzing && (
        <div className={styles.analyzingBadge}>
          <div className={styles.spinner} />
          <span>Analyzing...</span>
        </div>
      )}
    </div>
  );
};

// ── Insight Card ──────────────────────────────────────────────────────────────

const InsightCard: FC<{ data: any; index: number }> = ({ data, index }) => {
  return (
    <div className={styles.insightCard}>
      <div className={styles.insightNumber}>{index + 1}</div>
      <div className={styles.insightContent}>
        <div className={styles.insightText}>{safeStr(data.text)}</div>
        {data.supporting_data && Object.keys(data.supporting_data).length > 0 && (
          <div className={styles.supportingData}>
            {Object.entries(data.supporting_data).map(([key, val]) => (
              <div key={key} className={styles.dataPoint}>
                <span className={styles.dataKey}>{key}:</span>{' '}
                <span className={styles.dataValue}>{safeStr(val)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Issue Card ────────────────────────────────────────────────────────────────

const IssueCard: FC<{ data: any }> = ({ data }) => {
  const severityStyles: Record<string, string> = {
    info: styles.issueInfo,
    warning: styles.issueWarning,
    error: styles.issueError,
  };

  const severityIcons: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div className={`${styles.issueCard} ${severityStyles[data.severity] || styles.issueInfo}`}>
      <div className={styles.issueIcon}>{severityIcons[data.severity] || 'ℹ️'}</div>
      <div className={styles.issueContent}>
        <div className={styles.issueMessage}>{safeStr(data.message)}</div>
        {data.details && (
          <div className={styles.issueDetails}>{safeStr(data.details)}</div>
        )}
      </div>
    </div>
  );
};
