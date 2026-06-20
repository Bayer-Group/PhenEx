import { FC, useMemo } from 'react';
import { type SequentialRow, type RegistryComment } from './studyRegistryUtils';
import { CommentCard } from './HorizontalRowViewer/CommentCard';

interface CommentsPanelProps {
  rows: SequentialRow[];
  currentIndex: number;
}

export const CommentsPanel: FC<CommentsPanelProps> = ({ rows, currentIndex }) => {
  const currentRow = rows[currentIndex];
  const comments: RegistryComment[] = useMemo(
    () => (currentRow?.registry?.comments ?? []).filter((c) => c.text),
    [currentRow],
  );

  if (!comments.length) {
    return (
      <div style={{ padding: 20, color: '#999', fontSize: 13 }}>
        No comments for this row.
      </div>
    );
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {comments.map((comment, i) => (
        <CommentCard key={i} comment={comment} />
      ))}
    </div>
  );
};
