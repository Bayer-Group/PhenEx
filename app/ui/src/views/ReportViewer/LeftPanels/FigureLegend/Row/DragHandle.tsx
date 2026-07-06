import { FC } from 'react';

interface DragHandleProps {
  className?: string;
}

export const DragHandle: FC<DragHandleProps> = ({ className }) => (
  <span className={className} aria-hidden>
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="3" cy="2.5" r="1.2" /><circle cx="7" cy="2.5" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="11.5" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
    </svg>
  </span>
);
