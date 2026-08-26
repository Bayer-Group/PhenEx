import React, { useEffect, useState, useRef } from 'react';
import { IssuesPopover } from './IssuesPopover';
import { CohortIssuesDisplay } from './CohortIssuesDisplay';
import { DraggablePositionedPortal } from '../../../components/Portal/DraggablePositionedPortal';
import styles from './IssuesDisplayControl.module.css';
import { CohortDataService } from '../CohortDataService/CohortDataService';

export interface CohortIssue {
  phenotype_id: string;
  issues: string[];
}

interface IssuesDisplayControlProps {
  showPopover?: boolean;
  setShowPopover?: (show: boolean) => void;
}

export const IssuesDisplayControl: React.FC<IssuesDisplayControlProps> = ({
  showPopover: externalShowPopover,
  setShowPopover: externalSetShowPopover
}) => {
  const [internalShowPopover, setInternalShowPopover] = useState(false);
  const [issues, setIssues] = useState<CohortIssue[]>([]);
  const [resetPortalToPositioned, setResetPortalToPositioned] = useState(false);
  const [dataService] = useState(() => CohortDataService.getInstance());
  const issuesService = dataService.issues_service;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Use external state if provided, otherwise use internal state
  const showPopover = externalShowPopover !== undefined ? externalShowPopover : internalShowPopover;
  const setShowPopover = externalSetShowPopover || setInternalShowPopover;

  useEffect(() => {
    const listener = () => {
      setIssues(issuesService.issues);
    };
    issuesService.addListener(listener);

    return () => {
      issuesService.removeListener(listener);
    };
  }, [dataService]);

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      // if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      //   setShowPopover(false);
      // }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const handleClick = (event: React.MouseEvent) => {
    console.log("HOWING OPOPER")
    event.stopPropagation();
    if (!showPopover) {
      setShowPopover(!showPopover);
    }
  };
  const closePopover = () => {
    console.log('[IssuesDisplayControl] closePopover called');
    setShowPopover(false);
    // Reset portal to positioned mode when closing
    setResetPortalToPositioned(true);
    // Reset the flag after a brief delay to allow the effect to trigger
    setTimeout(() => setResetPortalToPositioned(false), 50);
  };

  return (
    <>    </>
    // <div
    //   ref={containerRef}
    //   className={`${styles.container} ${showPopover ? styles.showingPopover : ''} ${
    //     issues?.length ? styles.hasIssues : styles.noIssues
    //   }`}
    //   onClick={handleClick}
    // >
    //   {showPopover && (
    //     <DraggablePositionedPortal 
    //       triggerRef={containerRef} 
    //       position="below" 
    //       offsetY={5} 
    //       alignment="right" // Right edge of trigger = bottom-right anchor point for ResizableContainer
    //       resetToPositioned={resetPortalToPositioned}
    //       onClose={closePopover}
    //       dragHandleRef={dragHandleRef}
    //     >
    //       <IssuesPopover issues={issues} onClose={closePopover} dragHandleRef={dragHandleRef} />
    //     </DraggablePositionedPortal>
    //   )}
    //   <div className={styles.issuesButton}>
    //     <CohortIssuesDisplay issues={issues} selected={showPopover} onClick={closePopover} />
    //   </div>
    // </div>
  );
};
