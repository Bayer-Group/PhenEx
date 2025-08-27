import { FC, useState } from 'react';
import { Modal } from '../../Modal/Modal';
import { Avatar } from '../../Avatar/Avatar';
import { ModernButton } from '../../Form';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const UserMenu: FC<UserMenuProps> = ({ isOpen, onClose, onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const loginService = LoginDataService.getInstance();
  
  const currentUser = loginService.getCurrentUser();
  const username = currentUser?.username || loginService.getUsername();
  const email = currentUser?.email;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await loginService.logout();
      onLogout?.();
      onClose();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      isVisible={isOpen}
      onClose={onClose}
      minWidth="320px"
      maxWidth="400px"
      contentClassName={styles.modalContent}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <Avatar 
            name={username}
            email={email}
            size="lg"
            className={styles.avatar}
          />
          <div className={styles.userInfo}>
            <h3 className={styles.username}>
              {username || email?.split('@')[0] || 'User'}
            </h3>
            {email && (
              <p className={styles.email}>{email}</p>
            )}
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.actions}>
          <div className={styles.menuItem}>
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className={styles.menuItemText}>
                <div className={styles.menuItemTitle}>Account Settings</div>
                <div className={styles.menuItemDescription}>Manage your profile and preferences</div>
              </div>
            </div>
          </div>

          <div className={styles.menuItem}>
            <div className={styles.menuItemContent}>
              <div className={styles.menuItemIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </div>
              <div className={styles.menuItemText}>
                <div className={styles.menuItemTitle}>Preferences</div>
                <div className={styles.menuItemDescription}>Customize your PhenEx experience</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.footer}>
          <ModernButton
            variant="outline"
            size="md"
            fullWidth
            onClick={handleLogout}
            loading={isLoggingOut}
            className={styles.logoutButton}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </ModernButton>
        </div>
      </div>
    </Modal>
  );
};
