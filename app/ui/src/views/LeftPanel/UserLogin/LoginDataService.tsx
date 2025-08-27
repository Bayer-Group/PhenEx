import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - using environment variables for flexibility
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

interface UserData {
  username: string;
  email: string;
}

export class LoginDataService {
  private static instance: LoginDataService;
  public loggedIn: boolean = false;
  public loginUsername: string = '';
  private currentUser: User | null = null;
  private listeners: (() => void)[] = [];

  private constructor() {
    // Initialize auth state listener
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUser = session.user;
        this.loggedIn = true;
        this.loginUsername = session.user.email?.split('@')[0] || session.user.id;
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.loggedIn = false;
        this.loginUsername = '';
      }
      this.notifyListeners();
    });

    // Check for existing session on startup
    this.initializeSession();
  }

  private async initializeSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
        this.loggedIn = true;
        this.loginUsername = session.user.email?.split('@')[0] || session.user.id;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  }

  public static getInstance(): LoginDataService {
    if (!LoginDataService.instance) {
      LoginDataService.instance = new LoginDataService();
    }
    return LoginDataService.instance;
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        throw new Error(error.message);
      }

      if (data.user) {
        this.currentUser = data.user;
        this.loggedIn = true;
        this.loginUsername = data.user.email?.split('@')[0] || data.user.id;
        this.notifyListeners();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login failed:', error);
      this.loggedIn = false;
      this.loginUsername = '';
      this.currentUser = null;
      throw error;
    }
  }

  async register(email: string, password: string, username?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
        },
      });

      if (error) {
        console.error('Registration error:', error.message);
        throw new Error(error.message);
      }

      if (data.user) {
        // Note: User might need to confirm email before being fully authenticated
        return true;
      }

      return false;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error.message);
        throw new Error(error.message);
      }

      this.currentUser = null;
      this.loggedIn = false;
      this.loginUsername = '';
      this.notifyListeners();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if logout request fails
      this.currentUser = null;
      this.loggedIn = false;
      this.loginUsername = '';
      this.notifyListeners();
    }
  }

  async loginWithOAuth(provider: 'google' | 'github' | 'azure' = 'google') {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('OAuth login error:', error.message);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('OAuth login failed:', error);
      throw error;
    }
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  getCurrentUser(): UserData | null {
    if (!this.currentUser) return null;
    
    return {
      username: this.currentUser.user_metadata?.username || this.currentUser.email?.split('@')[0] || this.currentUser.id,
      email: this.currentUser.email || '',
    };
  }

  getSupabaseUser(): User | null {
    return this.currentUser;
  }

  async getToken(): Promise<string | null> {
    // Get the current session token
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  getUsername(): string {
    return this.loginUsername;
  }

  private notifyListeners() {
    console.log('NOTIFYING LISTENERS');
    this.listeners.forEach(listener => listener());
  }

  addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: () => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}
