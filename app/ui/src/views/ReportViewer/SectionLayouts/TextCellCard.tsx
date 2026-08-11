import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './TextCellCard.module.css';

/**
 * Header row for a text tile: the drag label plus a delete affordance. Rendered
 * inside the grid tile's draggable header, so the delete button stops pointer
 * propagation to avoid starting a drag.
 */
export function TextCellTitle({ onDelete }: { onDelete: () => void }) {
  return (
    <div className={styles.title}>
      <span className={styles.titleLabel}>Text</span>
      <button
        type="button"
        className={styles.deleteBtn}
        title="Delete text cell"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Body of a text tile: renders markdown, switching to a plain textarea on
 * double-click and committing on blur. Placement and persistence are owned by
 * the section layout store; this component only owns the editing UX.
 */
export function TextCellCard({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className={styles.editor}
        defaultValue={content}
        placeholder="Write markdown…"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
        onBlur={(e) => { onChange(e.target.value); setEditing(false); }}
      />
    );
  }

  return (
    <div
      className={content ? styles.markdown : styles.placeholder}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {content ? <ReactMarkdown>{content}</ReactMarkdown> : 'Double-click to edit'}
    </div>
  );
}
