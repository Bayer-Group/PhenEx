import { FC, useContext, useState } from 'react';
import styles from './UserLogin.module.css';
import { AuthContext } from '@/auth/AuthProvider';

import { UserButton } from '../../../components/User';
import { ModernButton } from '../../../components/Form';
import { LoginModal } from '../../../components/Form';

export const UserLogin: FC = () => {
  const { user } = useContext(AuthContext);

  const isLoggedIn = !user.isAnonymous;

  return <div className={styles.controls}>{isLoggedIn ? <LoggedIn /> : <NotLoggedIn />}</div>;
};

const LoggedIn: FC = () => {
  return (
    <div className={styles.container}>
      <UserButton className={styles.userButton} />
    </div>
  );
};

const NotLoggedIn: FC = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
  };

  return (
    <div className={styles.container}>
      <ModernButton
        variant="primary"
        size="md"
        onClick={() => setIsLoginModalOpen(true)}
        className={styles.loginTriggerButton}
      >
        Sign In
      </ModernButton>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};
