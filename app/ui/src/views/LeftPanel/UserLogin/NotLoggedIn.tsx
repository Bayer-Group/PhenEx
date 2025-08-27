import { FC, useState } from 'react';
import styles from './UserLogin.module.css';
import { LoginModal } from '../../../components/Form';
import { ModernButton } from '../../../components/Form';

interface NotLoggedInProps {
  onLoginSuccess?: () => void;
}

export const NotLoggedIn: FC<NotLoggedInProps> = ({ onLoginSuccess }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    onLoginSuccess?.();
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
