import React, { useState, useEffect, useRef } from 'react';
import styles from './ExecutePanel.module.css';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';

export const ExecutePanel: React.FC = () => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [logs, setLogs] = useState<
    Array<{ message: string | any; type: 'log' | 'error' | 'result' | 'complete'; timestamp: Date }>
  >([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all'); // 'all', 'info', 'warning', 'error', 'debug'
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
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
        <i>Execute your cohort.</i>
        <ul>
          <li>
            Extract the patients that belong to your cohort and generate the attrition table
          </li>
          <li>Assess the cohort at baseline and generate Table 1</li>
          <li>Perform outcome analyses such as Time to Event</li>
        </ul>
        When you are finished defining your cohort :
        <ol>
          <li>
            <em>Trigger execution</em> : <i>click</i> <code>Execute Cohort</code> below. You can watch the execution in real time in this panel; the logs are streamed to you. This allows you to monitor the progress and see any issues as they arise.
          </li>
          <li>
            <em>View results</em> : 
              <ul>
                <li>Counts of patients in the cohort that fulfill a phenotype are displayed directly in the cohort editing table in the 'type' column.</li>
                <li>Further results are found in the <code>Report</code> tab</li>
              </ul>
          </li>
        </ol>
      </span>
    );
  };

  const renderFilterDropdown = () => {
    return (
      <div></div>
    );
    //   <div className={styles.filterDropdown}>
    //     <select
    //       value={logFilter}
    //       onChange={e => setLogFilter(e.target.value)}
    //       className={styles.filterSelect}
    //     >
    //       <option value="all">All Logs</option>
    //       <option value="info">Info</option>
    //       <option value="warning">Warnings</option>
    //       <option value="error">Errors</option>
    //       <option value="debug">Debug</option>
    //     </select>
    //   </div>
    // );
  };

  const renderControls = () => {
    const tabs = [
      isExecuting ? 'Executing...' : 'Execute Cohort',
      'Clear Logs',
      'Filter'
    ];

    const handleTabChange = (index: number) => {
      switch(index) {
        case 0:
          handleExecute();
          break;
        case 1:
          clearLogs();
          break;
      }
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
  }


  const renderLogs = () => {
    return (
      <div className={styles.logsContainer} ref={logsContainerRef}>
        {logs.length === 0 ? (
          renderEmptyLogs()
        ) : (
          renderLogMessages()
        )}
      </div>
    );
  }

  const renderEmptyLogs = () =>{
    return (
        <div className={styles.emptyState}>
        </div>
    );
  }

  const renderLogMessages = () =>{
    return (
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
    );
  }

  return (
    <SlideoverPanel title="Execute" info={infoContent()}>
      <div className={styles.container}>
        {renderControls()}
        <div className={styles.content}>
          {renderLogs()}
        </div>
      </div>
    </SlideoverPanel>
  );
};
