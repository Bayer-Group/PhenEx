import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getStudyIssues, StudyIssue } from '../../../api/study/route';
import styles from './StudyIssuesPanel.module.css';
import buttonStyles from './FixWithAIButton.module.css';
import { chatPanelDataService } from '../../ChatPanel/ChatPanelDataService';
import { mainViewLayoutService } from '../../MainView/MainViewLayoutService';

interface GroupedIssues {
  cohortId: string;
  cohortName: string;
  phenotypeIssues: {
    phenotypeId: string;
    phenotypeName: string;
    errors: StudyIssue[];
    warnings: StudyIssue[];
  }[];
  cohortLevelErrors: StudyIssue[];
  cohortLevelWarnings: StudyIssue[];
}

export const StudyIssuesPanel = () => {
  const { studyId } = useParams<{ studyId: string }>();
  const [errors, setErrors] = useState<StudyIssue[]>([]);
  const [warnings, setWarnings] = useState<StudyIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedCohorts, setExpandedCohorts] = useState<Set<string>>(new Set());

  const fetchIssues = async () => {
    if (!studyId) return;
    
    try {
      setLoading(true);
      const response = await getStudyIssues(studyId);
      setErrors(response.errors);
      setWarnings(response.warnings);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching study issues:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    
    // Auto-refresh every 5 seconds when there are issues
    const interval = setInterval(() => {
      if (errors.length > 0 || warnings.length > 0) {
        fetchIssues();
      }
    }, 5000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  // Expand all cohorts by default when issues first load
  useEffect(() => {
    if (errors.length > 0 || warnings.length > 0) {
      const cohortIds = new Set<string>();
      [...errors, ...warnings].forEach(issue => {
        if (issue.cohort_id) {
          cohortIds.add(issue.cohort_id);
        }
      });
      setExpandedCohorts(cohortIds);
    }
  }, [errors, warnings]);

  const toggleCohort = (cohortId: string) => {
    setExpandedCohorts(prev => {
      const next = new Set(prev);
      if (next.has(cohortId)) {
        next.delete(cohortId);
      } else {
        next.add(cohortId);
      }
      return next;
    });
  };

  const handleFixWithAI = (issue: StudyIssue, context?: string) => {
    console.log('🔧 handleFixWithAI called');
    
    // Format the issue message for AI
    let issueText = 'Please fix the following issue:\n\n';
    
    if (context) {
      issueText += `Context: ${context}\n`;
    }
    
    if (issue.cohort_name) {
      issueText += `Cohort: "${issue.cohort_name}"\n`;
    }
    
    if (issue.phenotype_name) {
      issueText += `Phenotype: "${issue.phenotype_name}"\n`;
    }
    
    issueText += `\nIssue: ${issue.message}`;
    
    console.log('🔧 Clearing messages and sending to AI:', issueText.substring(0, 100) + '...');
    
    // Start a new chat session by clearing previous messages
    chatPanelDataService.clearMessages();
    
    // Add the message to AI chat (this automatically sends it)
    chatPanelDataService.addUserMessageWithText(issueText);
    
    console.log('🔧 Calling mainViewLayoutService.openChatTab()');
    
    // Open the chat tab
    mainViewLayoutService.openChatTab();
  };

  const renderIssue = (issue: StudyIssue, idx: number, severity: 'error' | 'warning', context?: string) => {
    const isError = severity === 'error';
    const className = isError ? styles.issueError : styles.issueWarning;
    const icon = isError ? '✕' : '⚠';
    
    return (
      <div key={`${severity}-${idx}`} className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className={styles.issueIcon}>{icon}</span>
        <span className={styles.issueMessage} style={{ flex: 1 }}>{issue.message}</span>
        <button
          className={buttonStyles.fixWithAIButton}
          onClick={() => handleFixWithAI(issue, context)}
          title="Fix with AI"
        >
          Fix with AI
        </button>
      </div>
    );
  };

  // Group issues by cohort and phenotype
  const groupedIssues: GroupedIssues[] = [];
  const studyLevelErrors: StudyIssue[] = [];
  const studyLevelWarnings: StudyIssue[] = [];
  
  [...errors, ...warnings].forEach(issue => {
    if (!issue.cohort_id) {
      // Study-level issue
      if (issue.severity === 'error') {
        studyLevelErrors.push(issue);
      } else {
        studyLevelWarnings.push(issue);
      }
      return;
    }
    
    // Find or create cohort group
    let cohortGroup = groupedIssues.find(g => g.cohortId === issue.cohort_id);
    if (!cohortGroup) {
      cohortGroup = {
        cohortId: issue.cohort_id,
        cohortName: issue.cohort_name || 'Unnamed Cohort',
        phenotypeIssues: [],
        cohortLevelErrors: [],
        cohortLevelWarnings: [],
      };
      groupedIssues.push(cohortGroup);
    }
    
    if (!issue.phenotype_id) {
      // Cohort-level issue
      if (issue.severity === 'error') {
        cohortGroup.cohortLevelErrors.push(issue);
      } else {
        cohortGroup.cohortLevelWarnings.push(issue);
      }
      return;
    }
    
    // Find or create phenotype group
    let phenotypeGroup = cohortGroup.phenotypeIssues.find(
      p => p.phenotypeId === issue.phenotype_id
    );
    if (!phenotypeGroup) {
      phenotypeGroup = {
        phenotypeId: issue.phenotype_id,
        phenotypeName: issue.phenotype_name || 'Unnamed Phenotype',
        errors: [],
        warnings: [],
      };
      cohortGroup.phenotypeIssues.push(phenotypeGroup);
    }
    
    if (issue.severity === 'error') {
      phenotypeGroup.errors.push(issue);
    } else {
      phenotypeGroup.warnings.push(issue);
    }
  });

  const totalErrors = errors.length;
  const totalWarnings = warnings.length;
  const hasIssues = totalErrors > 0 || totalWarnings > 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading validation status...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Study Validation</h3>
        {lastUpdated && (
          <div className={styles.lastUpdated}>
            Last checked: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {!hasIssues ? (
        <div className={styles.successState}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successText}>
            Study is valid and ready for execution
          </div>
        </div>
      ) : (
        <div className={styles.issuesContainer}>
          <div className={styles.summary}>
            {totalErrors > 0 && (
              <div className={styles.summaryError}>
                {totalErrors} error{totalErrors !== 1 ? 's' : ''}
              </div>
            )}
            {totalWarnings > 0 && (
              <div className={styles.summaryWarning}>
                {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Study-level issues */}
          {(studyLevelErrors.length > 0 || studyLevelWarnings.length > 0) && (
            <div className={styles.issueSection}>
              <div className={styles.sectionTitle}>Study Configuration</div>
              {studyLevelErrors.map((issue, idx) => renderIssue(issue, idx, 'error', 'Study Configuration'))}
              {studyLevelWarnings.map((issue, idx) => renderIssue(issue, idx, 'warning', 'Study Configuration'))}
            </div>
          )}

          {/* Cohort-grouped issues */}
          {groupedIssues.map(cohortGroup => {
            const cohortErrorCount = cohortGroup.cohortLevelErrors.length + 
              cohortGroup.phenotypeIssues.reduce((sum, p) => sum + p.errors.length, 0);
            const cohortWarningCount = cohortGroup.cohortLevelWarnings.length + 
              cohortGroup.phenotypeIssues.reduce((sum, p) => sum + p.warnings.length, 0);
            const isExpanded = expandedCohorts.has(cohortGroup.cohortId);
            
            return (
              <div key={cohortGroup.cohortId} className={styles.issueSection}>
                <div 
                  className={styles.sectionTitle}
                  onClick={() => toggleCohort(cohortGroup.cohortId)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={styles.accordionIcon}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  {cohortGroup.cohortName}
                  <span className={styles.issueBadges}>
                    {cohortErrorCount > 0 && (
                      <span className={styles.errorBadge}>{cohortErrorCount}</span>
                    )}
                    {cohortWarningCount > 0 && (
                      <span className={styles.warningBadge}>{cohortWarningCount}</span>
                    )}
                  </span>
                </div>
                
                {isExpanded && (
                  <>
                    {/* Cohort-level issues */}
                    {cohortGroup.cohortLevelErrors.map((issue, idx) => renderIssue(issue, idx, 'error', cohortGroup.cohortName))}
                    {cohortGroup.cohortLevelWarnings.map((issue, idx) => renderIssue(issue, idx, 'warning', cohortGroup.cohortName))}
                    
                    {/* Phenotype-grouped issues */}
                    {cohortGroup.phenotypeIssues.map(phenotypeGroup => (
                      <div key={phenotypeGroup.phenotypeId} className={styles.phenotypeGroup}>
                        <div className={styles.phenotypeTitle}>
                          {phenotypeGroup.phenotypeName}
                        </div>
                        {phenotypeGroup.errors.map((issue, idx) => renderIssue(issue, idx, 'error', `${cohortGroup.cohortName} > ${phenotypeGroup.phenotypeName}`))}
                        {phenotypeGroup.warnings.map((issue, idx) => renderIssue(issue, idx, 'warning', `${cohortGroup.cohortName} > ${phenotypeGroup.phenotypeName}`))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {hasIssues && (
        <div className={styles.footer}>
          <button className={styles.refreshButton} onClick={fetchIssues}>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};
