import { FC, useState, useContext } from 'react';
import { UserMenu } from '../UserMenu/UserMenu';
import { AuthContext } from '@/auth/AuthProvider';
import styles from './UserButton.module.css';

interface UserButtonProps {
  className?: string;
}

export const UserButton: FC<UserButtonProps> = ({ className = '' }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const email = user.email;
  const username = user.username;

  return (
    <>
      <button
        className={`${styles.userButton} ${className}`}
        onClick={() => setIsMenuOpen(true)}
        title={`User menu for ${username}`}
      >
        <div className={styles.avatar} />
        <div className={styles.userInfo}>
          <span className={styles.username}>{username}</span>
          {/* {email && <span className={styles.email}>{email}</span>} */}
        </div>
        <div className={styles.chevron} />
      </button>

      <UserMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onLogout={() => setIsMenuOpen(false)}
      />
    </>
  );
};
