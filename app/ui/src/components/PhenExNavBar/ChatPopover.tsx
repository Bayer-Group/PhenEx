import React, { useRef, useState, useEffect } from 'react';
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade in animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    // Trigger fade out animation
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      if (onClose) onClose();
    }, 100);
  };

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
      <div className={`${styles.popover} ${isVisible ? styles.visible : ''}`}>
        <div ref={dragHandleRef} className={styles.transparentHeader}>
          <div className={styles.transparentHeaderGradient} />
          <button
            className={styles.customCloseButton}
            onClick={handleClose}
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
          marginToEnd={20}
          classNameThumb={styles.customScrollbarThumb}
        />
      </div>
    </ResizableContainer>
  );
};
