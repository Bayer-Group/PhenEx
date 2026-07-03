import React, { useState, useEffect, useRef } from 'react';
import styles from './StudyExecutePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { executeStudy } from '../../../api/text_to_cohort/route';
import { BACKEND_URL, authFetch } from '../../../api/httpClient';

export const StudyExecutePanel: React.FC = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<Array<{ message: string; type: 'log' | 'error' | 'complete'; timestamp: Date }>>([]); 
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const getStudyId = (): string | null => {
    const service = StudyDataService.getInstance();
    return service.study_data?.id ?? null;
  };

  const getDatabaseConfig = (): Record<string, any> | null => {
    const cohortService = CohortDataService.getInstance();
    return cohortService.cohort_data?.database_config ?? null;
  };

  const handleExecute = async () => {
    const studyId = getStudyId();
    const databaseConfig = getDatabaseConfig();
    if (!studyId || isExecuting) return;

    if (!databaseConfig || !databaseConfig.mapper) {
      setLogs([{ message: 'No database configuration found. Please configure the database on a cohort first.', type: 'error', timestamp: new Date() }]);
      return;
    }

    setIsExecuting(true);
    setLogs([]);
    setReportUrl(null);

    try {
      const execId = await executeStudy(studyId, (event) => {
        if (event.type === 'log' && event.message) {
          setLogs(prev => [...prev, { message: event.message!, type: 'log', timestamp: new Date() }]);
        }
        if (event.type === 'error' && event.message) {
          setLogs(prev => [...prev, { message: event.message!, type: 'error', timestamp: new Date() }]);
        }
        if (event.type === 'complete') {
          setLogs(prev => [...prev, { message: 'Execution completed. Generating report...', type: 'complete', timestamp: new Date() }]);
        }
      }, databaseConfig);

      if (execId) {
        setReportUrl(`${BACKEND_URL}/study/${studyId}/report`);
        setLogs(prev => [...prev, { message: 'Report ready.', type: 'complete', timestamp: new Date() }]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, { message: `Error: ${err?.message ?? 'Execution failed'}`, type: 'error', timestamp: new Date() }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setReportUrl(null);
  };

  const getLogClassName = (type: string, message: string) => {
    if (type === 'error' || message.includes('[ERROR]') || message.includes('[STDERR]')) return styles.errorLog;
    if (type === 'complete') return styles.completeLog;
    if (message.includes('[WARNING]')) return styles.warningLog;
    if (message.includes('[INFO]')) return styles.infoLog;
    return styles.normalLog;
  };

  const renderControls = () => {
    const executingLabel = isExecuting ? 'Executing...' : 'Execute Study';
    const tabs = [executingLabel, 'Clear Logs'];

    const handleTabChange = (index: number) => {
      if (tabs[index] === executingLabel) {
        handleExecute();
      } else if (tabs[index] === 'Clear Logs') {
        clearLogs();
      }
    };

    return (
      <div className={styles.controls}>
        <TabsWithDropdown
          width={400}
          height={25}
          tabs={tabs}
          onTabChange={handleTabChange}
          dropdown_items={{}}
          active_tab_index={-1}
          outline_tab_index={0}
        />
      </div>
    );
  };

  const renderLogs = () => (
    <div className={styles.logsContainer} ref={logsContainerRef}>
      {logs.length === 0 ? (
        <div className={styles.emptyState} />
      ) : (
        logs.map((log, i) => (
          <div key={i} className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}>
            <span className={styles.timestamp}>[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={styles.logMessage}>{log.message}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderReportLink = () => {
    if (!reportUrl) return null;
    const handleViewReport = async () => {
      try {
        const resp = await authFetch(reportUrl);
        if (!resp.ok) throw new Error(`${resp.status}`);
        const html = await resp.text();
        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (err: any) {
        setLogs(prev => [...prev, { message: `Failed to open report: ${err?.message}`, type: 'error', timestamp: new Date() }]);
      }
    };
    return (
      <div className={styles.reportLink}>
        <button onClick={handleViewReport}>View Report ↗</button>
      </div>
    );
  };

  const infoContent = () => (
    <span>
      <i>Execute the study.</i>
      <ol>
        <li>Click <code>Execute Study</code> to run all cohorts and generate the report.</li>
        <li>A <strong>View Report</strong> link will appear when the report is ready.</li>
      </ol>
    </span>
  );

  return (
    <SlideoverPanel title="Execute Study" info={infoContent()}>
      <div className={styles.container}>
        {renderControls()}
        <div className={styles.content}>
          {renderReportLink()}
          {renderLogs()}
        </div>
      </div>
    </SlideoverPanel>
  );
};
