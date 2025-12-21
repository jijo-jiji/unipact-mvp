import api from '../api/client';

const authService = {
  
  // LOGIN FUNCTION
  // Matches PDF Page 4 Data Contract
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login/', { 
        email, 
        password 
      });
      
      // If success, save the tokens (The "System Keys")
      if (response.data.access) {
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        localStorage.setItem('user_role', response.data.role); // Assuming backend sends role
      }
      
      return response.data;
    } catch (error) {
      console.error("System Access Denied:", error.response?.data || error.message);
      throw error;
    }
  },

  // LOGOUT FUNCTION
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
  },

  // CHECK IF LOGGED IN
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  }
};

export default authService;