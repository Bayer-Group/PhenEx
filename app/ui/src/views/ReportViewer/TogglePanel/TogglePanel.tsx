import { FC, ReactNode } from 'react';
import styles from './TogglePanel.module.css';

export interface TogglePanelProps {
  /** Label shown in the header when expanded. */
  title: string;
  /** Whether the panel is collapsed to a header-only strip. */
  collapsed: boolean;
  /** Toggle collapse/expand for this panel. */
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Wraps a panel with a fixed 40px clickable header. Clicking the header toggles
 * the panel between its normal width and a collapsed header-only strip. The
 * content is hidden (not unmounted) while collapsed so state is preserved.
 */
export const TogglePanel: FC<TogglePanelProps> = ({ title, collapsed, onToggle, children }) => (
  <div className={styles.togglePanel}>
    <div className={styles.content} hidden={collapsed}>
      {children}
    </div>
    <button
      type="button"
      className={styles.chevronButton}
      onClick={onToggle}
      title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      aria-expanded={!collapsed}
    >
      <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
    </button>
  </div>
);
