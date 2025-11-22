import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import api from "../api/axios";

const CustContext = createContext()

export const CustProvider = ({ children }) => {
    const { token } = useAuth()
    const [data, setData] = useState([])
    const [org, setOrg] = useState("")
    useEffect(() => {
        if (!token) return
        const getEmps = async () => {
            try {
                const data = await api.get(`/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                const org = data.data.data.orgId
                if (!org) return
                const orgName = await api.get(`/organization/one/${org}`)

                if (data.data.role == 'admin') {
                    const payload = {
                        orgId: org,
                        role: data.data.role
                    }
                    const custs = await api.get(`/customer/getAllCusts`, { params: payload })
                    // console.log(custs.data)
                    setData(custs.data)
                    setOrg(orgName.data.name)
                }
            } catch (error) {
                console.log(error)
            }
        }
        getEmps()
    }, [token])


    return (
        <CustContext.Provider value={{data, org}}>{children}</CustContext.Provider>
    )
}

export const custAuth = () => {
    const context = useContext(CustContext);
    if (!context) {
        throw new Error("empAuth must be used within an AuthProvider");
    }
    return context;
};