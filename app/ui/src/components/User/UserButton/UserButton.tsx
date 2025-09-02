import { FC, useState } from 'react';
import { Avatar } from '../../Avatar/Avatar';
import { UserMenu } from '../UserMenu/UserMenu';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';
import styles from './UserButton.module.css';

interface UserButtonProps {
  className?: string;
}

export const UserButton: FC<UserButtonProps> = ({ className = '' }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const loginService = LoginDataService.getInstance();
  
  const currentUser = loginService.getCurrentUser();
  const username = currentUser?.username || loginService.getUsername();
  const email = currentUser?.email;

  return (
    <>
      <button
        className={`${styles.userButton} ${className}`}
        onClick={() => setIsMenuOpen(true)}
        title={`User menu for ${username}`}
      >
        {/* <Avatar 
          name={username}
          email={email}
          size="md"
          className={styles.avatar}
        /> */}
        <div className={styles.userInfo}>
          <span className={styles.username}>
            {username}
          </span>
          {email && (
            <span className={styles.email}>
              {email}
            </span>
          )}
        </div>
        <svg 
          className={styles.chevron} 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      <UserMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onLogout={() => setIsMenuOpen(false)}
      />
    </>
  );
};
