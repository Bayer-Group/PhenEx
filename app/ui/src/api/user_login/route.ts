import axios from 'axios';

const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }
  return { isValid: true, message: '' };
};

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const loginUser = async (username: string, password: string) => {
  try {
    const validation = validatePassword(password);
    if (!validation.isValid) {
      throw new Error(validation.message);
    }
    // Only log non-sensitive data
    console.log('Attempting login for user:', username);
    const response = await axios.post(
      `${BACKEND_URL}/login`,
      { username, password },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('Login successful');
    return response.data;
  } catch (error) {
    console.error('Error in loginUser:', error);
    throw error;
  }
}

export const registerUser = async (username: string, password: string) => {
    try {
        const validation = validatePassword(password);
        if (!validation.isValid) {
          throw new Error(validation.message);
        }
        console.log('Attempting registration for user:', username);
        const response = await axios.post(
        `${BACKEND_URL}/register`,
        { username, password },
        { headers: { 'Content-Type': 'application/json' } }
        );
        console.log('Registration successful');
    return response.data;
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
  }
}