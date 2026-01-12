import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import birdIcon from '../../assets/bird_icon.png';
import playButton from '../../assets/icons/play_button.svg';
import { ChatPopover } from './ChatPopover';
import { DraggablePositionedPortal } from '../Portal/DraggablePositionedPortal';

interface ActionNavBarProps {
  height: number;
  onHideNavBar?: () => void;
  onShowNavBar?: () => void;
}

export const ActionNavBar: React.FC<ActionNavBarProps> = ({ height, onHideNavBar, onShowNavBar }) => {
  const [showChatPopover, setShowChatPopover] = useState(false);
  const [resetPortalToPositioned, setResetPortalToPositioned] = useState(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleChatButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();
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
        <button className={styles.actionButton}>
          <img src={playButton} alt="Play" style={{ width: '30px', height: '30px' }} />
        </button>
        <span className={styles.issuesLabel}>issues</span>
        <button 
          ref={chatButtonRef}
          className={styles.actionButton}
          onClick={handleChatButtonClick}
        >
          <img src={birdIcon} alt="PhenEx" className={styles.birdIcon} />
        </button>
      </div>
      
      {showChatPopover && (
        <DraggablePositionedPortal 
          triggerRef={chatButtonRef} 
          position="below" 
          offsetY={5} 
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
