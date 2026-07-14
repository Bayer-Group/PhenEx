import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styles from './StudyExecutePanel.module.css';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import {
  executeStudy,
  interruptStudyExecution,
  getStudyExecutions,
  getExecutionReport,
  getExecutionLog,
  deleteExecution,
} from '../../../api/text_to_cohort/route';
import { getStudyIssues } from '../../../api/study/route';
import { mainViewLayoutService } from '../../MainView/MainViewLayoutService';

type LogEntry = { message: string; type: 'log' | 'error' | 'complete'; timestamp: Date };
type Execution = { execution_id: string; started_at: string | null; status: string };

export const StudyExecutePanel: React.FC = () => {
  const { studyId: paramStudyId } = useParams<{ studyId: string }>();
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'success' | 'failed' | 'interrupted'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logSearch, setLogSearch] = useState<string>('');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [showRunsDropdown, setShowRunsDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'logs' | 'log-file' | null>(null);
  const [logFileContent, setLogFileContent] = useState<string | null>(null);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Prefer URL param (most reliable in cohort/study view), fall back to StudyDataService
  const getStudyId = (): string | null =>
    paramStudyId ?? StudyDataService.getInstance().study_data?.id ?? null;

  const fetchExecutions = async () => {
    const studyId = getStudyId();
    if (!studyId) return;
    try {
      const execs = await getStudyExecutions(studyId);
      setExecutions(execs);
    } catch {
      // silently ignore
    }
  };

  const checkValidation = async (): Promise<{ hasErrors: boolean; errorCount: number }> => {
    const studyId = getStudyId();
    if (!studyId) return { hasErrors: false, errorCount: 0 };
    try {
      const validation = await getStudyIssues(studyId);
      const hasErrors = !validation.valid;
      const errorCount = validation.errors.length;
      setHasValidationErrors(hasErrors);
      setValidationErrorCount(errorCount);
      return { hasErrors, errorCount };
    } catch {
      // silently ignore
      return { hasErrors: false, errorCount: 0 };
    }
  };

  // On mount (and when studyId changes), load executions and validation, then poll validation every 120s.
  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const tryFetch = async () => {
      const studyId = getStudyId();
      if (studyId) {
        await fetchExecutions();
        await checkValidation();
        pollInterval = setInterval(() => {
          if (!cancelled) checkValidation();
        }, 120000);
        return;
      }
      // Retry until study is available (handles async load)
      const timer = setTimeout(async () => {
        if (!cancelled) await tryFetch();
      }, 300);
      return () => clearTimeout(timer);
    };
    tryFetch();
    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramStudyId]);

  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = contentScrollRef.current.scrollHeight;
    }
  }, [logs, logFileContent]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRunsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExecute = async () => {
    const studyId = getStudyId();
    if (!studyId || isExecuting) return;

    // Check validation before executing — use returned value to avoid stale React state
    const { hasErrors, errorCount } = await checkValidation();
    if (hasErrors) {
      setLogs([{
        message: `Cannot execute: Study has ${errorCount} validation error${errorCount !== 1 ? 's' : ''}. Please check the Issues tab.`,
        type: 'error',
        timestamp: new Date()
      }]);
      setViewMode('logs');
      return;
    }

    setIsExecuting(true);
    setCurrentExecutionId(null);
    setExecutionState('running');
    setLogs([]);
    setLogFileContent(null);
    setViewMode('logs');
    setSelectedExecId(null);

    try {
      const execId = await executeStudy(
        studyId,
        (event) => {
          if (event.type === 'started' && event.execution_id) {
            setCurrentExecutionId(event.execution_id);
          }
          if (event.type === 'log' && event.message)
            setLogs(prev => [...prev, { message: event.message!, type: 'log', timestamp: new Date() }]);
          if (event.type === 'error' && event.message)
            setLogs(prev => [...prev, { message: event.message!, type: 'error', timestamp: new Date() }]);
          if (event.type === 'complete')
            setLogs(prev => [...prev, { message: 'Execution complete.', type: 'complete', timestamp: new Date() }]);
          if (event.type === 'interrupted')
            setLogs(prev => [...prev, { message: 'Execution interrupted.', type: 'error', timestamp: new Date() }]);
        },
      );
      if (execId) setSelectedExecId(execId);
      setExecutionState(prev => prev === 'interrupted' ? 'interrupted' : 'success');
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Error: ${err?.message ?? 'Execution failed'}`, type: 'error', timestamp: new Date() }]);
      setExecutionState('failed');
    } finally {
      setIsExecuting(false);
      setCurrentExecutionId(null);
      await fetchExecutions();
      await checkValidation();
    }
  };

  const handleInterrupt = async () => {
    if (!currentExecutionId) return;
    try {
      await interruptStudyExecution(currentExecutionId);
      setExecutionState('interrupted');
      setLogs(prev => [...prev, { message: 'Interrupt requested...', type: 'error', timestamp: new Date() }]);
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Failed to interrupt: ${err?.message}`, type: 'error', timestamp: new Date() }]);
    }
  };

  const openReport = async (execId: string) => {
    const studyId = getStudyId();
    if (!studyId) return;
    try {
      const html = await getExecutionReport(studyId, execId);
      const blob = new Blob([html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Failed to open report: ${err?.message}`, type: 'error', timestamp: new Date() }]);
      setViewMode('logs');
    }
  };

  const openLog = async (execId: string) => {
    const studyId = getStudyId();
    if (!studyId) return;
    try {
      const content = await getExecutionLog(studyId, execId);
      setLogFileContent(content);
      setViewMode('log-file');
      setSelectedExecId(execId);
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Failed to load log: ${err?.message}`, type: 'error', timestamp: new Date() }]);
      setViewMode('logs');
    }
  };

  const handleDelete = async (execId: string) => {
    const studyId = getStudyId();
    if (!studyId) return;
    try {
      await deleteExecution(studyId, execId);
      if (selectedExecId === execId) {
        setSelectedExecId(null);
        setLogFileContent(null);
        setViewMode(null);
      }
      await fetchExecutions();
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Failed to delete run: ${err?.message}`, type: 'error', timestamp: new Date() }]);
      setViewMode('logs');
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const shouldShowLog = (message: string) => {
    if (!logSearch.trim()) return true;
    return message.toLowerCase().includes(logSearch.toLowerCase());
  };

  const getLogClassName = (type: string, message: string) => {
    if (type === 'error' || message.includes('[ERROR]') || message.includes('[STDERR]')) return styles.errorLog;
    if (type === 'complete') return styles.completeLog;
    if (message.includes('[WARNING]')) return styles.warningLog;
    if (message.includes('[INFO]')) return styles.infoLog;
    return styles.normalLog;
  };

  const formatExecLabel = (exec: Execution) => {
    const date = exec.started_at ? new Date(exec.started_at).toLocaleString() : exec.execution_id.slice(0, 8);
    return `${date} — ${exec.status}`;
  };

  const renderControls = () => {
    const executeStateClass =
      executionState === 'running' ? styles.executeRunning
      : executionState === 'success' ? styles.executeSuccess
      : executionState === 'failed' ? styles.executeFailed
      : executionState === 'interrupted' ? styles.executeFailed
      : '';
    
    const isDisabled = isExecuting || hasValidationErrors;
    
    return (
      <div className={styles.controls}>
        {isExecuting ? (
          <div className={styles.executeRow}>
            <button
              className={`${styles.executeBtn} ${executeStateClass} ${styles.executeBtnFlex}`}
              disabled
            >
              Running…
            </button>
            <button
              className={styles.interruptBtn}
              onClick={handleInterrupt}
              disabled={!currentExecutionId}
              title="Interrupt execution"
            >
              Interrupt
            </button>
          </div>
        ) : (
          <button
            className={`${styles.executeBtn} ${executeStateClass}`}
            onClick={handleExecute}
            disabled={isDisabled}
            title={hasValidationErrors ? `Cannot execute: ${validationErrorCount} validation error${validationErrorCount !== 1 ? 's' : ''}. Check Issues tab.` : ''}
          >
            Execute Study
          </button>
        )}
        {hasValidationErrors && (
          <div className={styles.validationWarning}>
            {validationErrorCount} issue{validationErrorCount !== 1 ? 's' : ''} must be fixed before execution.{' '}
            <span 
              style={{ 
                textDecoration: 'underline', 
                cursor: 'pointer',
                color: 'var(--color-accent-bright)'
              }}
              onClick={() => mainViewLayoutService.openRightPanelTab(3)}
            >
              See Issues tab
            </span>
            .
          </div>
        )}
      </div>
    );
  };

  const renderRunsBar = () => {
    if (executions.length === 0) return null;
    const selectedExec = executions.find(e => e.execution_id === selectedExecId);

    return (
      <div className={styles.runsBar} ref={dropdownRef}>
        <div className={styles.runsBarRow}>
          <button
            className={styles.runsDropdownTrigger}
            onClick={() => setShowRunsDropdown(v => !v)}
          >
            {selectedExec ? formatExecLabel(selectedExec) : 'Past Runs ▾'}
          </button>
          {selectedExecId && (
            <div className={styles.runsActions}>
              <button onClick={() => openReport(selectedExecId)}>View Report ↗</button>
              <button className={styles.deleteBtn} onClick={() => handleDelete(selectedExecId)}>🗑</button>
            </div>
          )}
        </div>
        {showRunsDropdown && (
          <div className={styles.runsDropdownList}>
            {executions.map(exec => (
              <div
                key={exec.execution_id}
                className={`${styles.runsDropdownItem} ${exec.execution_id === selectedExecId ? styles.runsDropdownItemActive : ''}`}
                onClick={() => { setSelectedExecId(exec.execution_id); setShowRunsDropdown(false); openLog(exec.execution_id); }}
              >
                <span className={styles.runsDropdownLabel}>{formatExecLabel(exec)}</span>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(exec.execution_id); }}
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    const hasLogs = logs.length > 0;
    const logText = viewMode === 'log-file' && logFileContent !== null
      ? logFileContent
      : logs.map(l => l.message).join('\n');

    const logHeader = (
      <div className={styles.logHeader}>
        <input
          className={styles.logSearch}
          type="text"
          placeholder="Filter logs…"
          value={logSearch}
          onChange={e => setLogSearch(e.target.value)}
        />
        <button
          className={`${styles.copyIconBtn}${copied ? ' ' + styles.copied : ''}`}
          onClick={() => handleCopy(logText)}
          title="Copy logs"
          aria-label="Copy logs"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          )}
        </button>
      </div>
    );

    if (viewMode === 'log-file' && logFileContent !== null) {
      return (
        <>
          {logHeader}
          <div className={styles.logsContent} ref={logsContainerRef}>
            <pre className={styles.logFileContent}>{logFileContent}</pre>
          </div>
        </>
      );
    }
    if (viewMode === 'logs' || hasLogs) {
      return (
        <>
          {logHeader}
          <div className={styles.logsContent} ref={logsContainerRef}>
            {logs.length === 0 ? <div className={styles.emptyState} /> : logs.filter(log => shouldShowLog(log.message)).map((log, i) => (
              <div key={i} className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}>
                <span className={styles.timestamp}>[{log.timestamp.toLocaleTimeString()}]</span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            ))}
          </div>
        </>
      );
    }
    return <div className={styles.logsContent} ref={logsContainerRef}><div className={styles.emptyState} /></div>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.panelTitle}>Execute Study</div>
        {renderControls()}
        {renderRunsBar()}
      </div>
      <div className={styles.scrollableWrapper}>
        <div ref={contentScrollRef} className={styles.scrollableContent}>
          {renderContent()}
        </div>
        <div className={styles.scrollbarRegion}>
          <SimpleCustomScrollbar
            targetRef={contentScrollRef}
            orientation="vertical"
            marginTop={10}
            marginBottom={10}
            marginToEnd={10}
            classNameTrack={styles.scrollBarTrack}
            classNameThumb={styles.scrollBarThumb}
            showOnHover={true}
          />
        </div>
      </div>
    </div>
  );
};
