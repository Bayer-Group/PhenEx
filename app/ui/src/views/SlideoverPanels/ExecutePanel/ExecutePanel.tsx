import React, { useState, useEffect, useRef } from 'react';
import styles from './ExecutePanel.module.css';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';

export const ExecutePanel: React.FC = () => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [logs, setLogs] = useState<
    Array<{ message: string | any; type: 'log' | 'error' | 'result' | 'complete'; timestamp: Date }>
  >([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all'); // 'all', 'info', 'warning', 'error', 'debug'
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleExecutionProgress = (
      message: string | any,
      type: 'log' | 'error' | 'result' | 'complete'
    ) => {
      setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date() }]);

      if (type === 'complete' || type === 'error') {
        setIsExecuting(false);
      }
    };

    dataService.addExecutionProgressListener(handleExecutionProgress);

    return () => {
      dataService.removeExecutionProgressListener(handleExecutionProgress);
    };
  }, [dataService]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleExecute = async () => {
    setIsExecuting(true);
    setLogs([]);
    try {
      await dataService.executeCohort();
    } catch (error) {
      console.error('Execution failed:', error);
      setIsExecuting(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const shouldShowLog = (message: string | any) => {
    if (logFilter === 'all') return true;

    // Convert message to string if it's not already
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const lowerMessage = messageStr.toLowerCase();

    switch (logFilter) {
      case 'error':
        return lowerMessage.includes('[error]') || lowerMessage.includes('[stderr]');
      case 'warning':
        return lowerMessage.includes('[warning]') || lowerMessage.includes('[warn]');
      case 'info':
        return lowerMessage.includes('[info]') || lowerMessage.includes('[stdout]');
      case 'debug':
        return lowerMessage.includes('[debug]');
      default:
        return true;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const getLogClassName = (type: string, message: string | any) => {
    // Convert message to string if it's not already
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    // Check for log level indicators in the message
    if (messageStr.includes('[ERROR]') || messageStr.includes('[STDERR]')) {
      return styles.errorLog;
    }
    if (messageStr.includes('[WARNING]') || messageStr.includes('[WARN]')) {
      return styles.warningLog;
    }
    if (messageStr.includes('[INFO]')) {
      return styles.infoLog;
    }
    if (messageStr.includes('[DEBUG]')) {
      return styles.debugLog;
    }

    switch (type) {
      case 'error':
        return styles.errorLog;
      case 'result':
        return styles.resultLog;
      case 'complete':
        return styles.completeLog;
      default:
        return styles.normalLog;
    }
  };

  const infoContent = () => {
    return (
      <span>
        <i>Execute your study</i> using this panel. Execution:
        <ul>
          <li>
            Extracts the patients that belong to your cohort and generates the attrition table
          </li>
          <li>Assesses the cohort at baseline and generates Table 1</li>
          <li>Performs outcome analyses such as Time to Event</li>
        </ul>
        To setup your database in PhenEx :
        <ol>
          <li>
            <em>Trigger execution</em> : <i>click</i> <code>Execute</code> below.
          </li>
          <li>
            <em>View results</em> : Counts of patients in the cohort that fulfill a phenotype are
            displayed directly in the cohort editing table in the 'type' column. Further results are
            found in the <em>Report</em> tab
          </li>
        </ol>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Execute" info={infoContent()}>
      <div className={styles.container}>
        <div className={styles.controls}>
          <button onClick={handleExecute} disabled={isExecuting} className={styles.executeButton}>
            {isExecuting ? 'Executing...' : 'Execute Cohort'}
          </button>
          <button onClick={clearLogs} className={styles.clearButton}>
            Clear Logs
          </button>
          <select
            value={logFilter}
            onChange={e => setLogFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Logs</option>
            <option value="info">Info</option>
            <option value="warning">Warnings</option>
            <option value="error">Errors</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        <div className={styles.content}>
          <div className={styles.logsContainer}>
            {logs.length === 0 ? (
              <div className={styles.emptyState}>
                Click "Execute Cohort" to see real-time execution logs
              </div>
            ) : (
              logs
                .filter(log => shouldShowLog(log.message))
                .map((log, index) => {
                  // Format message for display
                  const displayMessage =
                    typeof log.message === 'string'
                      ? log.message
                      : JSON.stringify(log.message, null, 2);

                  return (
                    <div
                      key={index}
                      className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}
                    >
                      <span className={styles.timestamp}>[{formatTimestamp(log.timestamp)}]</span>
                      <span className={styles.logMessage}>{displayMessage}</span>
                    </div>
                  );
                })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </SlideoverPanel>
  );
};
