import { loginUser, registerUser } from '../../../api/user_login/route';

interface UserData {
  username: string;
  email: string;
}


// export abstract class LoginDataService {
export class LoginDataService {
  private static instance: LoginDataService;
  public loggedIn: boolean = false;
  public loginUsername: string = '';
  private token: string | null = null;
  private currentUser: UserData | null = null;
  private listeners: any[] = [];

  private constructor() {
    // Restore session from localStorage if it exists
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedUser = localStorage.getItem('userData');

    if (storedToken && storedUsername) {
      this.token = storedToken;
      this.loginUsername = storedUsername;
      this.loggedIn = true;
      this.currentUser = storedUser ? JSON.parse(storedUser) : null;
    }
  }

  public static getInstance(): LoginDataService {
    if (!LoginDataService.instance) {
      LoginDataService.instance = new LoginDataService();
    }
    return LoginDataService.instance;
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await loginUser(username, password);
      if (response?.access_token) {
        this.token = response.access_token;
        this.loggedIn = true;
        this.loginUsername = username;
        
        // Save to localStorage
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('username', username);
        
        await this.fetchUserData();
        this.notifyListeners()

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      this.loggedIn = false;
      this.loginUsername = '';
      this.token = null;
      throw error;
    }
  }

  async register(username: string, password: string, email: string): Promise<boolean> {
    try {
      const response = await registerUser(username, password, email);
      return !!response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error; // Propagate the error to show validation messages
    }
    this.notifyListeners()
  }

  async logout(): Promise<void> {
    this.token = null;
    this.currentUser = null;
    this.loggedIn = false;
    this.loginUsername = '';
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userData');
    this.notifyListeners()
  }

  private async fetchUserData(): Promise<void> {
    if (!this.token) return;

    try {
      // Implement user data fetching once the endpoint is available
      // const response = await axios.get<UserData>('/users/me', {
      //   headers: {
      //     Authorization: `Bearer ${this.token}`,
      //   },
      // });
      // this.currentUser = response.data;
      this.currentUser = {
        username: this.loginUsername,
        email: ''  // Will be populated when the endpoint is available
      };
      
      // Save user data to localStorage
      localStorage.setItem('userData', JSON.stringify(this.currentUser));
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      this.token = null;
      this.currentUser = null;
      this.loggedIn = false;
      this.loginUsername = '';
    }
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  getCurrentUser(): UserData | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return this.token;
  }

  getUsername(): string {
    return this.loginUsername;
  }

   private notifyListeners() {
    console.log("NOTIFYING LISTENRERS")
    this.listeners.forEach(listener => listener());
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

}
