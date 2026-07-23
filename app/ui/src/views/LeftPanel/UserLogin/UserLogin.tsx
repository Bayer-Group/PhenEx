import { FC, useContext, useState } from 'react';
import styles from './UserLogin.module.css';
import { AuthContext } from '@/auth/AuthProvider';

import { UserButton } from '../../../components/User';
import { LoginModal } from '../../../components/Form';
import { Portal } from '../../../components/Portal/Portal';

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
    <>
      <Portal>
        <div className={styles.loginPortal}>
          <button
            className={styles.loginButton}
            onClick={() => setIsLoginModalOpen(true)}
          >
            Log in to get started
          </button>
        </div>
      </Portal>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
};
