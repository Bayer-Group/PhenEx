import { FC, useMemo } from 'react';
import { type SequentialRow, type RegistryComment } from './studyRegistryUtils';
import { CommentCard } from './HorizontalRowViewer/CommentCard';

interface CommentsPanelProps {
  row: SequentialRow;
}

/** Comments for a single row, rendered as the right-hand panel of a cell layout. */
export const CommentsPanel: FC<CommentsPanelProps> = ({ row }) => {
  const comments: RegistryComment[] = useMemo(
    () => (row.registry?.comments ?? []).filter((c) => c.text),
    [row],
  );

  if (!comments.length) {
    return (
      <div style={{ padding: 20, color: '#999', fontSize: 13 }}>
        No comments for this row.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {comments.map((comment, i) => (
        <CommentCard key={i} comment={comment} />
      ))}
    </div>
  );
};
