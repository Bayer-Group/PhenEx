import { FC, useState, ReactNode } from 'react';
import styles from './UnifiedRightPanel.module.css';

interface UnifiedRightPanelProps {
  chatContent: ReactNode;
  executeContent?: ReactNode;
  constantsContent?: ReactNode;
}

export const UnifiedRightPanel: FC<UnifiedRightPanelProps> = ({
  chatContent,
  executeContent,
  constantsContent,
}) => {
  const [activeTab, setActiveTab] = useState<'execute' | 'constants' | 'chat'>('execute');

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        {executeContent != null && (
          <button
            className={`${styles.tab} ${activeTab === 'execute' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('execute')}
          >
            Execute
          </button>
        )}
        {constantsContent != null && (
          <button
            className={`${styles.tab} ${activeTab === 'constants' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('constants')}
          >
            Constants
          </button>
        )}
        <button
          className={`${styles.tab} ${activeTab === 'chat' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
      </div>
      <div className={styles.content}>
        {executeContent != null && (
          <div className={activeTab === 'execute' ? styles.paneVisible : styles.paneHidden}>
            {executeContent}
          </div>
        )}
        {constantsContent != null && (
          <div className={activeTab === 'constants' ? styles.paneVisible : styles.paneHidden}>
            {constantsContent}
          </div>
        )}
        <div className={activeTab === 'chat' ? styles.paneVisible : styles.paneHidden}>
          {chatContent}
        </div>
      </div>
    </div>
  );
};
