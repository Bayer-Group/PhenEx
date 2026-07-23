import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ResizableContainer } from '../../../../components/ResizableContainer';
import styles from './CommentWindow.module.css';

interface CommentWindowProps {
  onClose: () => void;
  onSave: (text: string) => void;
  onAskAI?: (text: string) => void;
}

export const CommentWindow: React.FC<CommentWindowProps> = ({
  onClose,
  onSave,
  onAskAI,
}) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag state: track the bottom-right anchor point
  const [anchor, setAnchor] = useState({ right: 20, bottom: 20 });
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);

  const handleSave = () => {
    onSave(commentText);
    setCommentText('');
    onClose();
  };

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI(commentText);
    }
  };

  const handleClear = () => {
    setCommentText('');
    textareaRef.current?.focus();
  };

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag when clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: anchor.right,
      startBottom: anchor.bottom,
    };
  }, [anchor]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setAnchor({
        right: Math.max(0, dragRef.current.startRight - dx),
        bottom: Math.max(0, dragRef.current.startBottom - dy),
      });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className={styles.anchor} style={{ right: anchor.right, bottom: anchor.bottom }}>
    <ResizableContainer
      className={styles.resizableContainer}
      initialWidth={500}
      initialHeight={300}
      minWidth={300}
      minHeight={200}
      maxWidth={1000}
      maxHeight={700}
      enableResize={{
        top: true,
        right: true,
        bottom: true,
        left: true,
      }}
    >
      <div className={styles.commentWindow}>
        {/* Header — drag handle */}
        <div className={styles.header} onMouseDown={handleHeaderMouseDown}>
          <div className={styles.headerLeft}>
            <button
              className={styles.collapseBtn}
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              −
            </button>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.clearBtn}
              onClick={handleClear}
              disabled={commentText.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Enter your comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />

        {/* Footer with action buttons */}
        <div className={styles.footer}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={commentText.length === 0}
          >
            Save
          </button>
          {onAskAI && (
            <button
              className={styles.aiBtn}
              onClick={handleAskAI}
              disabled={commentText.length === 0}
            >
              Ask AI
            </button>
          )}
        </div>
      </div>
    </ResizableContainer>
    </div>
  );
};
