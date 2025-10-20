import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
const Logout = () => {

    const { logout } = useAuth()
    const navigate = useNavigate()
    useEffect(() => {
        logout()
        navigate("/login")
    }, [])



    return (
        <div></div>
    )
}

export default Logout