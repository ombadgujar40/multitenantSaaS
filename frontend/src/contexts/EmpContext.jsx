import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const EmpContext = createContext()

export const EmpProvider = ({ children }) => {
    const { token } = useAuth()
    const [data, setData] = useState([])
    const [org, setOrg] = useState("")
    useEffect(() => {
        if (!token) return
        const getEmps = async () => {
            try {
                const data = await axios.get(`http://127.0.0.1:2000/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                const org = data.data.data.orgId
                const orgName = await axios.get(`http://127.0.0.1:2000/organization/one/${org}`)

                if (data.data.role == 'admin') {
                    const payload = {
                        orgId: org,
                        role: data.data.role
                    }
                    const emps = await axios.get(`http://localhost:2000/employee/getAllEmps`, { params: payload })
                    console.log(emps.data)
                    setData(emps.data)
                    setOrg(orgName.data.name)
                }
            } catch (error) {
                console.log(error)
            }
        }
        getEmps()
    }, [token])


    return (
        <EmpContext.Provider value={{data, org}}>{children}</EmpContext.Provider>
    )
}

export const empAuth = () => {
    const context = useContext(EmpContext);
    if (!context) {
        throw new Error("empAuth must be used within an AuthProvider");
    }
    return context;
};