import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import {useNavigate} from 'react-router-dom'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState()
  const [id, setId] = useState()
  const [orgId, setOrgId] = useState()


  useEffect(() => {
    const tk = localStorage.getItem('token')
    if(!tk) {
      setToken("")
      return undefined
    }

    const getUserData = async () => {
      setToken(tk)
      try {
        const data = await axios.get(`http://127.0.0.1:2000/me`, {
          headers: {
            Authorization: `Bearer ${tk}`
          }
        })

        setId(data.data.id)
        setOrgId(data.data.organisation)
      } catch (error) {
        console.log(error)
      }
    }

    getUserData()
  }, [])
  
  const login = async (email, password, role) => {

    const cred = {
      email, password, role
    }
    try {
      const data = await axios.post(`http://127.0.0.1:2000/login`, cred) 
      if (!data) {
        console.log("error in login context function")
      }

      const tk = data.data.token
      localStorage.setItem('token', tk)
      setToken(tk)

      return {sucess: true, tok: tk}
    } catch (error) {
      console.log(error)
      return {sucess: false}
    }
  } 


  const logout = async (req, res) => {
    localStorage.removeItem('token')
    setToken("")
    return {msg: true}
  }

  return (
    <AuthContext.Provider
      value={{token, login, id, orgId, logout}}
    >
      {children}
    </AuthContext.Provider>
  );
}


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};