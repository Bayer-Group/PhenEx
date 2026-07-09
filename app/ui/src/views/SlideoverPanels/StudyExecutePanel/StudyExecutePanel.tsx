import React, { useState, useEffect, useRef } from 'react';
import styles from './StudyExecutePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import {
  executeStudy,
  getStudyExecutions,
  getExecutionReport,
  getExecutionLog,
  deleteExecution,
} from '../../../api/text_to_cohort/route';

type LogEntry = { message: string; type: 'log' | 'error' | 'complete'; timestamp: Date };
type Execution = { execution_id: string; started_at: string | null; status: string };

export const StudyExecutePanel: React.FC = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logSearch, setLogSearch] = useState<string>('');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [showRunsDropdown, setShowRunsDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'logs' | 'log-file' | null>(null);
  const [logFileContent, setLogFileContent] = useState<string | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getStudyId = (): string | null => StudyDataService.getInstance().study_data?.id ?? null;

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

  // Poll until the StudyDataService has a study loaded, then fetch executions once.
  useEffect(() => {
    let cancelled = false;
    const tryFetch = async () => {
      const studyId = getStudyId();
      if (studyId) {
        await fetchExecutions();
        return;
      }
      // Retry until study is available
      const timer = setTimeout(async () => {
        if (!cancelled) await tryFetch();
      }, 300);
      return () => clearTimeout(timer);
    };
    tryFetch();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
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

    setIsExecuting(true);
    setExecutionState('running');
    setLogs([]);
    setLogFileContent(null);
    setViewMode('logs');
    setSelectedExecId(null);

    try {
      const execId = await executeStudy(
        studyId,
        (event) => {
          if (event.type === 'log' && event.message)
            setLogs(prev => [...prev, { message: event.message!, type: 'log', timestamp: new Date() }]);
          if (event.type === 'error' && event.message)
            setLogs(prev => [...prev, { message: event.message!, type: 'error', timestamp: new Date() }]);
          if (event.type === 'complete')
            setLogs(prev => [...prev, { message: 'Execution complete.', type: 'complete', timestamp: new Date() }]);
        },
      );
      if (execId) setSelectedExecId(execId);
      setExecutionState('success');
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Error: ${err?.message ?? 'Execution failed'}`, type: 'error', timestamp: new Date() }]);
      setExecutionState('failed');
    } finally {
      setIsExecuting(false);
      await fetchExecutions();
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
      : '';
    return (
      <div className={styles.controls}>
        <button
          className={`${styles.executeBtn} ${executeStateClass}`}
          onClick={handleExecute}
          disabled={isExecuting}
        >
          {isExecuting ? 'Running…' : 'Execute Study'}
        </button>
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
        <div className={styles.logsWrapper}>
          {logHeader}
          <div className={styles.logsContainer} ref={logsContainerRef}>
            <pre className={styles.logFileContent}>{logFileContent}</pre>
          </div>
        </div>
      );
    }
    if (viewMode === 'logs' || hasLogs) {
      return (
        <div className={styles.logsWrapper}>
          {logHeader}
          <div className={styles.logsContainer} ref={logsContainerRef}>
            {logs.length === 0 ? <div className={styles.emptyState} /> : logs.filter(log => shouldShowLog(log.message)).map((log, i) => (
              <div key={i} className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}>
                <span className={styles.timestamp}>[{log.timestamp.toLocaleTimeString()}]</span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <div className={styles.logsContainer} ref={logsContainerRef}><div className={styles.emptyState} /></div>;
  };

  const infoContent = () => (
    <span>
      <i>Execute the study.</i>
      <ol>
        <li>Click <code>Execute Study</code> to run all cohorts and generate the report.</li>
        <li>Use the <strong>Past Runs</strong> dropdown to browse previous executions.</li>
        <li>For each run you can view the report, inspect the log file, or delete the run.</li>
      </ol>
    </span>
  );

  return (
    <SlideoverPanel title="Execute Study" info={infoContent()}>
      <div className={styles.container}>
        {renderControls()}
        {renderRunsBar()}
        <div className={styles.content}>
          {renderContent()}
        </div>
      </div>
    </SlideoverPanel>
  );
};

