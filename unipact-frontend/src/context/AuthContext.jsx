import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check if user is logged in on mount
    useEffect(() => {
        checkUserStatus();
    }, []);

    const checkUserStatus = async () => {
        try {
            const response = await api.get('/users/me/');
            setUser(response.data);
        } catch (error) {
            console.log("Not logged in");
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await api.post('/users/login/', { email, password });
        // Update State
        setUser(response.data.user);
        return response.data;
    };

    const registerCompany = async (data) => {
        const response = await api.post('/users/register/company/', data);
        setUser(response.data.user);
        return response.data;
    };

    const registerClub = async (data) => {
        // data can be FormData for file upload
        const response = await api.post('/users/register/club/', data);
        setUser(response.data.user);
        return response.data;
    };

    const logout = async () => {
        try {
            await api.post('/users/logout/');
            setUser(null);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const value = {
        user,
        loading,
        login,
        registerCompany,
        registerClub,
        logout,
        checkUserStatus
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
