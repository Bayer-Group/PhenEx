import { FC, useRef, useState } from 'react';
import EyeSolidIcon from '../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../assets/icons/eye-closed.svg';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import styles from './CommentBar.module.css';

interface CommentBarProps {
  commentsCollapsed: boolean;
  onToggleCollapsed: () => void;
  onNewComment: () => void;
}

export const CommentBar: FC<CommentBarProps> = ({
  commentsCollapsed,
  onToggleCollapsed,
  onNewComment,
}) => {
  const eyeRef = useRef<HTMLButtonElement>(null);
  const newCommentRef = useRef<HTMLButtonElement>(null);
  const [hoveredBtn, setHoveredBtn] = useState<'eye' | 'new' | null>(null);

  return (
    <div className={styles.commentBar}>
      <button
        ref={newCommentRef}
        className={styles.newCommentBtn}
        onClick={onNewComment}
        onMouseEnter={() => setHoveredBtn('new')}
        onMouseLeave={() => setHoveredBtn(null)}
      >
        + New comment
      </button>

      <div className={styles.rightSection}>
        <button
          ref={eyeRef}
          className={styles.eyeToggle}
          onClick={onToggleCollapsed}
          onMouseEnter={() => setHoveredBtn('eye')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          <img
            src={commentsCollapsed ? EyeClosedIcon : EyeSolidIcon}
            alt={commentsCollapsed ? 'Show comments' : 'Hide comments'}
            className={styles.eyeIcon}
          />
        </button>
      </div>

      <PhenExNavBarTooltip
        isVisible={hoveredBtn === 'new'}
        anchorElement={newCommentRef.current}
        label="Open comment window"
        verticalPosition="above"
        horizontalAlignment="right"
      />
      <PhenExNavBarTooltip
        isVisible={hoveredBtn === 'eye'}
        anchorElement={eyeRef.current}
        label={commentsCollapsed ? 'Show comments' : 'Hide comments'}
        verticalPosition="above"
        horizontalAlignment="right"
      />
    </div>
  );
};
