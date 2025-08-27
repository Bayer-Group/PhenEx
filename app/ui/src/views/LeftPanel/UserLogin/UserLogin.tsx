import { FC, useEffect, useState } from 'react';
import styles from './UserLogin.module.css';
import { LoggedIn } from './LoggedIn';
import { NotLoggedIn } from './NotLoggedIn';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';

interface UserLoginProps {}

export const UserLogin: FC<UserLoginProps> = ({}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const loginService = LoginDataService.getInstance();

  useEffect(() => {
    // Initial check of login state
    setIsLoggedIn(loginService.isLoggedIn());

    // Add listener for auth state changes
    const handleAuthChange = () => {
      setIsLoggedIn(loginService.isLoggedIn());
    };

    loginService.addListener(handleAuthChange);

    // Cleanup listener on unmount
    return () => {
      loginService.removeListener(handleAuthChange);
    };
  }, [loginService]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  return (
    <div className={styles.controls}>
      {isLoggedIn ? <LoggedIn /> : <NotLoggedIn onLoginSuccess={handleLoginSuccess} />}
    </div>
  );
};
