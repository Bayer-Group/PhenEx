import { FC, useRef, useState } from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsBar/CustomizableDropdownButton';
import { LoginDataService } from './LoginDataService';

interface NotLoggedInProps {
  onLoginSuccess?: () => void;
}

export const NotLoggedIn: FC<NotLoggedInProps> = ({ onLoginSuccess }) => {
  const customizableDropdownButtonRef = useRef(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const loginService = LoginDataService.getInstance();

  const handleLogin = async () => {
    try {
      setError('');
      const success = await loginService.login(username, password);
      if (success) {
        customizableDropdownButtonRef.current?.closeDropdown();
        onLoginSuccess?.();
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An error occurred during login.');
    }
  };

  const handleRegister = async () => {
    if (!email) {
      setError('Email is required for registration');
      return;
    }
    try {
      setError('');
      const success = await loginService.register(username, password, email);
      if (success) {
        // Automatically login after successful registration
        await handleLogin();
      } else {
        setError('Registration failed. Username or email might already be taken.');
      }
    } catch (err) {
      setError('An error occurred during registration.');
    }
  };

  const renderLogin = () => {
    return (
      <div className={styles.container}>
        <div className={styles.loginHeader} onClick={() => clickedOnHeader()}>
          {isRegistering ? 'Register New Account' : 'Login to PhenEx!'}
          <span className={styles.loginHeaderButton}>Close</span>
        </div>
        <div className={styles.loginForm}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
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
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                isRegistering ? handleRegister() : handleLogin();
              }
            }}
            className={styles.loginInput}
          />
          {isRegistering && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
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
                <button onClick={handleRegister} className={styles.loginButton}>Register</button>
                <button onClick={() => setIsRegistering(false)} className={styles.loginButton}>
                  Back to Login
                </button>
              </>
            ) : (
              <>
                <button onClick={handleLogin} className={styles.loginButton}>Login</button>
                <button onClick={() => setIsRegistering(true)} className={styles.loginButton}>
                  Create Account
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
      key={"login"}
      label={"Login"}
      content={renderLogin()}
      ref={customizableDropdownButtonRef}
      menuClassName={styles.loginDropdownMenu}
    />
  );
};
