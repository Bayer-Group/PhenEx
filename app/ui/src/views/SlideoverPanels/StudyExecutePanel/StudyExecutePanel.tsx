import React, { useState, useEffect, useRef } from 'react';
import styles from './StudyExecutePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
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
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Error: ${err?.message ?? 'Execution failed'}`, type: 'error', timestamp: new Date() }]);
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

  const shouldShowLog = (message: string) => {
    if (logFilter === 'all') return true;
    const lower = message.toLowerCase();
    switch (logFilter) {
      case 'error': return lower.includes('[error]') || lower.includes('[stderr]');
      case 'warning': return lower.includes('[warning]') || lower.includes('[warn]');
      case 'info': return lower.includes('[info]') || lower.includes('[stdout]');
      case 'debug': return lower.includes('[debug]');
      default: return true;
    }
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

  const renderFilterDropdown = () => (
    <div style={{ padding: '8px' }}>
      <select
        value={logFilter}
        onChange={e => setLogFilter(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="all">All Logs</option>
        <option value="info">Info</option>
        <option value="warning">Warnings</option>
        <option value="error">Errors</option>
        <option value="debug">Debug</option>
      </select>
    </div>
  );

  const renderControls = () => {
    const executingLabel = isExecuting ? 'Executing...' : 'Execute Study';
    const tabs = [executingLabel, 'Clear Logs', 'Filter'];
    const handleTabChange = (index: number) => {
      if (tabs[index] === executingLabel) handleExecute();
      else if (tabs[index] === 'Clear Logs') { setLogs([]); setLogFileContent(null); setViewMode(null); }
    };
    return (
      <div className={styles.controls}>
        <TabsWithDropdown
          width={400}
          height={25}
          tabs={tabs}
          onTabChange={handleTabChange}
          dropdown_items={{ 2: renderFilterDropdown() }}
          active_tab_index={-1}
          outline_tab_index={0}
        />
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
    if (viewMode === 'log-file' && logFileContent !== null) {
      return (
        <div className={styles.logsContainer} ref={logsContainerRef}>
          <pre className={styles.logFileContent}>{logFileContent}</pre>
        </div>
      );
    }
    if (viewMode === 'logs' || logs.length > 0) {
      return (
        <div className={styles.logsContainer} ref={logsContainerRef}>
          {logs.length === 0 ? <div className={styles.emptyState} /> : logs.filter(log => shouldShowLog(log.message)).map((log, i) => (
            <div key={i} className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}>
              <span className={styles.timestamp}>[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={styles.logMessage}>{log.message}</span>
            </div>
          ))}
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

