import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios"
import { useNavigate } from "react-router-dom";


interface User {
  email: string;
  password: string;
}


interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  token: string;
  role: string;
  name: string;
  email: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState()
  const [email, setEmail] = useState()
  const [name, setName] = useState()
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token")
    setToken(token)
    if (token) {
      axios.get("http://127.0.0.1:2000/emp/me", {
        headers: { Authorization: `Bearer ${token}` }
      }).then((res) => { setRole(res.data.role), setIsLoading(false), setName(res.data.name), setEmail(res.data.email) }).catch((err) => console.log(err))
    }
  }, []);


  const login = async (email: string, password: string) => {
    const mockUser: User = {
      email,
      password
    };

    try {
      const userData = await axios.post("http://127.0.0.1:2000/emp/login", mockUser)
      localStorage.setItem("token", userData.data.token);
      setIsLoading(false)
    } catch (error) {
      console.log(error)
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ email, name, role, token, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
