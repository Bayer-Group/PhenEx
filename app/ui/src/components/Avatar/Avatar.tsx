import { FC } from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  name?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  src?: string;
}

export const Avatar: FC<AvatarProps> = ({ 
  name, 
  email, 
  size = 'md', 
  className = '',
  src 
}) => {
  const getInitials = () => {
    if (name) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const displayName = name || email?.split('@')[0] || 'User';

  return (
    <div className={`${styles.avatar} ${styles[size]} ${className}`}>
      {src ? (
        <img 
          src={src} 
          alt={displayName}
          className={styles.image}
        />
      ) : (
        <div className={styles.initials}>
          {getInitials()}
        </div>
      )}
    </div>
  );
};
