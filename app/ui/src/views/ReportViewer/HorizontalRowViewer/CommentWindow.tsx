import React, { useState, useRef } from 'react';
import { ResizableContainer } from '../../../components/ResizableContainer';
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

  return (
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
        {/* Header with collapse and clear buttons */}
        <div className={styles.header}>
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
  );
};
