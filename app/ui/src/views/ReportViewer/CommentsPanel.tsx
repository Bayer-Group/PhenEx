import { FC, useMemo } from 'react';
import { type ViewerEntry, type RegistryComment, getEntryComments } from './studyRegistryUtils';
import { CommentCard } from './HorizontalRowViewer/CommentCard';

interface CommentsPanelProps {
  entries: ViewerEntry[];
  currentIndex: number;
}

export const CommentsPanel: FC<CommentsPanelProps> = ({ entries, currentIndex }) => {
  const currentEntry = entries[currentIndex];
  const comments: RegistryComment[] = useMemo(
    () => (currentEntry ? getEntryComments(currentEntry) : []),
    [currentEntry],
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
