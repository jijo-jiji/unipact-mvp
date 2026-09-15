import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/client';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
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
        } catch {
            // Not signed in (or session expired)
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

    // With the instance's JSON default header, axios would serialise FormData to JSON and drop files
    const uploadConfig = (data) => (data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);

    const registerClub = async (data) => {
        // data can be FormData for file upload
        const response = await api.post('/users/register/club/', data, uploadConfig(data));
        setUser(response.data.user);
        return response.data;
    };

    const registerStudent = async (data) => {
        // data can be FormData for file upload
        const response = await api.post('/users/register/student/', data, uploadConfig(data));
        setUser(response.data.user);
        return response.data;
    };

    // Club committee invitation: creates the account and signs the new member in
    const claimClubInvitation = async (data) => {
        const response = await api.post('/users/users/claim/', data);
        setUser(response.data.user);
        return response.data;
    };

    const logout = async () => {
        try {
            await api.post('/users/logout/');
        } catch (error) {
            console.error("Logout request failed", error);
        } finally {
            // Always clear local state so the user is never stuck "signed in"
            setUser(null);
        }
    };

    // Account settings: save profile changes and keep the signed-in user in sync everywhere
    const updateAccount = async (data) => {
        const response = await api.patch('/users/me/settings/', data, uploadConfig(data));
        setUser(response.data);
        return response.data;
    };

    const changePassword = async (currentPassword, newPassword) => {
        const response = await api.post('/users/password/change/', { current_password: currentPassword, new_password: newPassword });
        return response.data;
    };

    const value = {
        user,
        loading,
        login,
        registerCompany,
        registerClub,
        registerStudent,
        claimClubInvitation,
        logout,
        checkUserStatus,
        updateAccount,
        changePassword,
    };

    // Render immediately: public pages shouldn't wait on the session check (a slow or offline
    // backend used to leave the whole site blank). ProtectedRoute shows a loader while `loading`.
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
