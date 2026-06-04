import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import birdIcon from '../../assets/bird_icon.png';
import playButton from '../../assets/icons/play_button.svg';
import { ChatPopover } from './ChatPopover';
import { DraggablePositionedPortal } from '../Portal/DraggablePositionedPortal';
import { PhenExNavBarTooltip } from './PhenExNavBarTooltip';
import { SwitchButton } from '../ButtonsAndTabs/SwitchButton/SwitchButton';

interface ActionNavBarProps {
  height: number;
  onHideNavBar?: () => void;
  onShowNavBar?: () => void;
  isChatOpen?: boolean;
  onChatToggle?: (isOpen: boolean) => void;
  showReport?: boolean;
  onShowReportChange?: (value: boolean) => void;
  onExecute?: () => void;

}

export const ActionNavBar: React.FC<ActionNavBarProps> = ({ 
  height, 
  onHideNavBar, 
  onShowNavBar,
  isChatOpen: controlledIsChatOpen,
  onChatToggle: controlledOnChatToggle,
  showReport = false,
  onShowReportChange,
  onExecute

}) => {
  const [internalShowChatPopover, setInternalShowChatPopover] = useState(false);
  
  const isControlled = controlledIsChatOpen !== undefined;
  const showChatPopover = isControlled ? controlledIsChatOpen : internalShowChatPopover;
  
  const setShowChatPopover = (value: boolean) => {
    if (isControlled && controlledOnChatToggle) {
      controlledOnChatToggle(value);
    } else {
      setInternalShowChatPopover(value);
    }
  };

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
    <div className={styles.navBar} style={{ height: `${height}px`,width: `auto`, gap:`20px` }}>
      <div className={styles.actionButtons}>
        {/* <SwitchButton /* TODO : REMOVE COMPLETELY
          tooltip="Show report"
          value={showReport}
          onValueChange={onShowReportChange}
          classNameSwitchContainer={styles.switchContainer}
          classNameSwitchBackground={styles.switchBackground}
          classNameSwitchBackgroundSelected={styles.switchBackgroundSelected}
          classNameSwitch={styles.switch}
          classNameSwitchSelected={styles.switchSelected}
        />
        
        <button 
          ref={playButtonRef}
          className={styles.actionButton}
          onMouseEnter={() => setShowPlayTooltip(true)}
          onMouseLeave={() => setShowPlayTooltip(false)}
          onClick={onExecute}
        >
          <img src={playButton} alt="Execute" style={{ width: '30px', height: '30px' }} />
        </button> */}
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
          offsetY={0} 
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
