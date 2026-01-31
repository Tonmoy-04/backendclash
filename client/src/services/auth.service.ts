import api from './api';

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', { email, password });
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  }

  async register(username: string, email: string, password: string) {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    // Change password feature - requires authentication token
    const response = await api.put('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // App uses HashRouter; in packaged Electron file://, `/login` would resolve to a file path.
    window.location.hash = '#/login';
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  async verifyToken(): Promise<boolean> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return false;
      }
      
      const response = await api.get('/auth/verify-token');
      return response.status === 200 && response.data.isValid === true;
    } catch (error) {
      // Token is invalid or expired
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
