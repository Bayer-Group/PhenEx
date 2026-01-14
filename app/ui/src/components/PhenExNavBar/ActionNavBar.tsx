import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import birdIcon from '../../assets/bird_icon.png';
import playButton from '../../assets/icons/play_button.svg';
import { ChatPopover } from './ChatPopover';
import { DraggablePositionedPortal } from '../Portal/DraggablePositionedPortal';
import { PhenExNavBarTooltip } from './PhenExNavBarTooltip';

interface ActionNavBarProps {
  height: number;
  onHideNavBar?: () => void;
  onShowNavBar?: () => void;
}

export const ActionNavBar: React.FC<ActionNavBarProps> = ({ height, onHideNavBar, onShowNavBar }) => {
  const [showChatPopover, setShowChatPopover] = useState(false);
  const [resetPortalToPositioned, setResetPortalToPositioned] = useState(false);
  const [showPlayTooltip, setShowPlayTooltip] = useState(false);
  const [showIssuesToolip, setShowIssuesToolip] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const issuesLabelRef = useRef<HTMLSpanElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleChatButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowChatTooltip(false);
    setShowChatPopover(!showChatPopover);
    if (!showChatPopover && onHideNavBar) {
      onHideNavBar();
    }
  };

  const closeChatPopover = () => {
    setShowChatPopover(false);
    setResetPortalToPositioned(true);
    setTimeout(() => setResetPortalToPositioned(false), 50);
    if (onShowNavBar) {
      onShowNavBar();
    }
  };

  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div className={styles.actionButtons}>
                <span 
          ref={issuesLabelRef}
          className={styles.issuesLabel}
          onMouseEnter={() => setShowIssuesToolip(true)}
          onMouseLeave={() => setShowIssuesToolip(false)}
        >
          27
        </span>

        <button 
          ref={playButtonRef}
          className={styles.actionButton}
          onMouseEnter={() => setShowPlayTooltip(true)}
          onMouseLeave={() => setShowPlayTooltip(false)}
        >
          <img src={playButton} alt="Play" style={{ width: '30px', height: '30px' }} />
        </button>
        <button 
          ref={chatButtonRef}
          className={styles.actionButton}
          onClick={handleChatButtonClick}
          onMouseEnter={() => setShowChatTooltip(true)}
          onMouseLeave={() => setShowChatTooltip(false)}
        >
          <img src={birdIcon} alt="PhenEx" className={styles.birdIcon} />
        </button>
      </div>
      
      <PhenExNavBarTooltip
        isVisible={showIssuesToolip}
        anchorElement={issuesLabelRef.current}
        label="View Issues"
      />
      
      <PhenExNavBarTooltip
        isVisible={showPlayTooltip}
        anchorElement={playButtonRef.current}
        label="Execute cohort"
      />
      
      <PhenExNavBarTooltip
        isVisible={showChatTooltip}
        anchorElement={chatButtonRef.current}
        label="Open chat"
      />

      
      
      {showChatPopover && (
        <DraggablePositionedPortal 
          triggerRef={chatButtonRef} 
          position="below" 
          offsetY={-100} 
          alignment="right"
          resetToPositioned={resetPortalToPositioned}
          onClose={closeChatPopover}
          dragHandleRef={dragHandleRef}
        >
          <ChatPopover onClose={closeChatPopover} dragHandleRef={dragHandleRef} />
        </DraggablePositionedPortal>
      )}
    </div>
  );
};
