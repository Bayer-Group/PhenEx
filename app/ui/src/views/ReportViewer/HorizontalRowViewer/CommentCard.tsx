import { FC } from 'react';
import { type RegistryComment } from '../studyRegistryUtils';
import styles from './CommentCard.module.css';
import ReactMarkdown from 'react-markdown';

export const CommentCard: FC<{ comment: RegistryComment }> = ({ comment }) => {
  const label = comment.type ?? comment.user ?? '';
  const statusLabel = comment.status === 'pinned' ? '📌' : comment.status === 'resolved' ? '✓' : '';

  return (
    <div className={styles.commentCard} onClick={(e) => e.stopPropagation()}>
      <div className={styles.commentHeader}>
        <span className={styles.commentUser}>{label} PRELIMINARY</span>
        {statusLabel && <span className={styles.commentStatus}>{statusLabel}</span>}
        {comment.date && <span className={styles.commentDate}>{comment.date}</span>}
      </div>
      <div className={styles.commentBody}>
        <ReactMarkdown>{comment.text}</ReactMarkdown>
      </div>
    </div>
  );
};
