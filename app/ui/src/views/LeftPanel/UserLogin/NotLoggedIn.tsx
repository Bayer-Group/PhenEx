import { FC, useRef, useState } from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsAndTabs/ButtonsBar/CustomizableDropdownButton';
import { LoginDataService } from '../../../services/supabaseAuthService';
import { PopoverHeader } from '../../../components/PopoverHeader/PopoverHeader';

interface NotLoggedInProps {
  onLoginSuccess?: () => void;
}

export const NotLoggedIn: FC<NotLoggedInProps> = ({ onLoginSuccess }) => {
  const customizableDropdownButtonRef = useRef<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const loginService = LoginDataService.getInstance();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    try {
      setError('');
      const success = await loginService.login(email, password);
      if (success) {
        onLoginSuccess?.();
        customizableDropdownButtonRef.current?.closeDropdown();
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'azure' = 'google') => {
    try {
      setError('');
      await loginService.loginWithOAuth(provider);
      // OAuth will redirect, so no need to handle success here
    } catch (err: any) {
      setError(err.message || 'OAuth login failed.');
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    try {
      setError('');
      const success = await loginService.register(email, password, username);
      if (success) {
        setError('Registration successful! Please check your email for confirmation.');
        // Optionally switch back to login view
        setTimeout(() => {
          setIsRegistering(false);
          setError('');
        }, 3000);
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    }
  };

  const renderLogin = () => {
    return (
      <div className={styles.container}>
        <PopoverHeader
          onClick={clickedOnHeader}
          title={isRegistering ? 'Register New Account' : 'Login to PhenEx!'}
          className={styles.popoverheader}
        />

        <div className={styles.loginForm}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                isRegistering ? handleRegister() : handleLogin();
              }
            }}
            className={styles.loginInput}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                isRegistering ? handleRegister() : handleLogin();
              }
            }}
            className={styles.loginInput}
          />
          {isRegistering && (
            <input
              type="text"
              placeholder="Username (optional)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRegister();
                }
              }}
              className={styles.loginInput}
            />
          )}
          {error && <div className={styles.errorMessage}>{error}</div>}
          <div className={styles.loginButtons}>
            {isRegistering ? (
              <>
                <button onClick={handleRegister} className={styles.loginButton}>
                  Register
                </button>
                <button onClick={() => setIsRegistering(false)} className={styles.loginButton}>
                  Back to Login
                </button>
              </>
            ) : (
              <>
                <button onClick={handleLogin} className={styles.loginButton}>
                  Login
                </button>
                <button onClick={() => setIsRegistering(true)} className={styles.loginButton}>
                  Create Account
                </button>
                <button onClick={() => handleOAuthLogin('google')} className={styles.loginButton}>
                  Login with Google
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const clickedOnHeader = () => {
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  return (
    <CustomizableDropdownButton
      key={'login'}
      label={'Login'}
      content={renderLogin()}
      ref={customizableDropdownButtonRef}
      menuClassName={styles.loginDropdownMenu}
    />
  );
};
