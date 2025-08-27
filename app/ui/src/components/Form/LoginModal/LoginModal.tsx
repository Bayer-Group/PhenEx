import { FC, useState } from 'react';
import { Modal } from '../../Modal/Modal';
import { Input } from '../Input';
import { ModernButton } from '../Button';
import { FormField } from '../FormField';
import { LoginDataService } from '../../../services/supabaseAuthService';
import styles from './LoginModal.module.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

interface FormErrors {
  email?: string;
  password?: string;
  username?: string;
  general?: string;
}

export const LoginModal: FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const loginService = LoginDataService.getInstance();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (isRegistering) {
        const success = await loginService.register(formData.email, formData.password, formData.username);
        if (success) {
          setErrors({ general: 'Registration successful! Please check your email for confirmation.' });
          setTimeout(() => {
            setIsRegistering(false);
            setErrors({});
          }, 3000);
        } else {
          setErrors({ general: 'Registration failed. Please try again.' });
        }
      } else {
        const success = await loginService.login(formData.email, formData.password);
        if (success) {
          onLoginSuccess?.();
          onClose();
          setFormData({ email: '', password: '', username: '' });
        } else {
          setErrors({ general: 'Invalid email or password. Please try again.' });
        }
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'azure' = 'azure') => {
    try {
      setErrors({});
      await loginService.loginWithOAuth(provider);
    } catch (err: any) {
      setErrors({ general: err.message || 'OAuth login failed.' });
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({ email: '', password: '', username: '' });
    setErrors({});
    setIsRegistering(false);
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Modal
      isVisible={isOpen}
      onClose={handleClose}
      minWidth="420px"
      maxWidth="500px"
      contentClassName={styles.modalContent}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className={styles.subtitle}>
            {isRegistering 
              ? 'Sign up to get started with PhenEx' 
              : 'Sign in to your PhenEx account'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <FormField error={errors.email}>
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange('email')}
              error={!!errors.email}
              helperText={errors.email}
              autoComplete="email"
            />
          </FormField>

          <FormField error={errors.password}>
            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange('password')}
              error={!!errors.password}
              helperText={errors.password}
              autoComplete={isRegistering ? "new-password" : "current-password"}
            />
          </FormField>

          {isRegistering && (
            <FormField error={errors.username}>
              <Input
                type="text"
                label="Username (Optional)"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleInputChange('username')}
                error={!!errors.username}
                helperText={errors.username}
                autoComplete="username"
              />
            </FormField>
          )}

          {errors.general && (
            <div className={`${styles.message} ${errors.general.includes('successful') ? styles.success : styles.error}`}>
              {errors.general}
            </div>
          )}

          <div className={styles.actions}>
            <ModernButton
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={isLoading}
            >
              {isRegistering ? 'Create Account' : 'Sign In'}
            </ModernButton>

            {!isRegistering && (
              <ModernButton
                type="button"
                variant="outline"
                size="md"
                fullWidth
                onClick={() => handleOAuthLogin('azure')}
                disabled={isLoading}
              >
                <svg width="16" height="16" viewBox="0 0 23 23" fill="none">
                  <path d="M1 1h10v10H1V1z" fill="#f35325"/>
                  <path d="M12 1h10v10H12V1z" fill="#81bc06"/>
                  <path d="M1 12h10v10H1V12z" fill="#05a6f0"/>
                  <path d="M12 12h10v10H12V12z" fill="#ffba08"/>
                </svg>
                Continue with Microsoft
              </ModernButton>
            )}

            <div className={styles.switch}>
              <span className={styles.switchText}>
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button
                type="button"
                className={styles.switchButton}
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setErrors({});
                }}
                disabled={isLoading}
              >
                {isRegistering ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
