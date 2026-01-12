import React, { useRef } from 'react';
import styles from './ChatPopover.module.css';
import { ChatPanel } from '../../views/ChatPanel/ChatPanel';
import BirdIcon from '../../assets/bird_icon.png';
import { SimpleCustomScrollbar } from '../CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { ResizableContainer } from '../ResizableContainer';

interface ChatPopoverProps {
  onClose?: () => void;
  dragHandleRef?: React.RefObject<HTMLDivElement | null>;
}

export const ChatPopover: React.FC<ChatPopoverProps> = ({ onClose, dragHandleRef }) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <ResizableContainer
      className={styles.resizablePopover}
      initialWidth={400}
      initialHeight={window.innerHeight * 3 / 4}
      minWidth={300}
      minHeight={250}
      maxWidth={1200}
      maxHeight={window.innerHeight}
      enableResize={{
        top: true,
        right: true,
        bottom: true,
        left: true,
      }}
    >
      <div className={styles.popover}>
        <div ref={dragHandleRef} className={styles.transparentHeader}>
          <div className={styles.transparentHeaderGradient} />
          <button
            className={styles.customCloseButton}
            onClick={onClose}
          >
            ×
          </button>
          <div className={styles.headerContent}>
            <img src={BirdIcon} alt="PhenEx" className={styles.birdIcon} />
            <span className={styles.title}>AI Chat</span>
          </div>
        </div>
        
        <div ref={bodyRef} className={styles.body}>
          <ChatPanel />
        </div>
        
        <SimpleCustomScrollbar 
          targetRef={bodyRef}
          orientation="vertical"
          marginTop={100}
          marginBottom={20}
          classNameThumb={styles.customScrollbarThumb}
        />
      </div>
    </ResizableContainer>
  );
};
