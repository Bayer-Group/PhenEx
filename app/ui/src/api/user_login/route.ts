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
    // Convert data to form-urlencoded format for OAuth2 compatibility
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await axios.post(
      `${BACKEND_URL}/login`,
      formData,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('Login successful');
    return response.data;
  } catch (error) {
    console.error('Error in loginUser:', error);
    throw error;
  }
}

export const registerUser = async (username: string, password: string, email: string) => {
    try {
        // First validate the password locally
        const validation = validatePassword(password);
        if (!validation.isValid) {
            throw new Error(validation.message);
        }

        // Log attempt (non-sensitive data only)
        console.log('Attempting registration for user:', username);
        
        // Make the registration request
        const response = await axios.post(
            `${BACKEND_URL}/register`,
            { username, password, email },
            { 
                headers: { 'Content-Type': 'application/json' },
                validateStatus: (status) => status < 500 // Allow any status < 500 to be handled in code
            }
        );

        // Handle various response statuses
        if (response.status === 400) {
            const errorMessage = response.data.detail || 'Registration failed. Please check your input.';
            console.error('Registration failed:', errorMessage);
            throw new Error(errorMessage);
        }

        console.log('Registration successful');
        return response.data;
    } catch (error: any) {
        if (error.response?.data?.detail) {
            console.error('Error in registerUser:', error.response.data.detail);
            throw new Error(error.response.data.detail);
        }
        console.error('Error in registerUser:', error);
        throw error;
    }
}