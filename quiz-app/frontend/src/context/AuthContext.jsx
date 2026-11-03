import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMyProfile, updateMyProfile as apiUpdateProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('has_submitted');
        localStorage.removeItem('dev_user_profile');
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_token');
        setUser(null);
    }, []);

    const fetchUserProfile = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        const userId = localStorage.getItem('user_id');

        if (!token && !userId) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const profile = await getMyProfile();
            setUser(profile);
            const phone = profile?.phone || profile?.user_id || '';
            const cleanPhone = phone.replace(/\D/g, '').slice(-10);
            if (profile?.role === 'admin' || cleanPhone === '9437555900') {
                localStorage.setItem('admin_auth', 'true');
            }
        } catch (err) {
            console.error('Error fetching user profile:', err);
            // If unauthorized and refresh also failed, log out
            if (err.response?.status === 401) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        fetchUserProfile();

        // Listen for silent refresh logout event from api.js
        const handleLogoutEvent = () => logout();
        window.addEventListener('auth:logout', handleLogoutEvent);

        return () => {
            window.removeEventListener('auth:logout', handleLogoutEvent);
        };
    }, [fetchUserProfile, logout]);

    const login = (authData) => {
        if (authData.access_token) {
            localStorage.setItem('access_token', authData.access_token);
        }
        if (authData.refresh_token) {
            localStorage.setItem('refresh_token', authData.refresh_token);
        }

        const userId = authData.user?.user_id || authData.user_id;
        if (userId) {
            localStorage.setItem('user_id', userId);
        }

        if (authData.has_submitted !== undefined) {
            localStorage.setItem('has_submitted', authData.has_submitted);
        }
        if (authData.week_id) {
            localStorage.setItem('week_id', authData.week_id);
        }

        const phone = authData.user?.phone || authData.user?.user_id || authData.user_id || '';
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        if (authData.role === 'admin' || authData.admin_auth || authData.user?.role === 'admin' || cleanPhone === '9437555900') {
            localStorage.setItem('admin_auth', 'true');
        }

        if (authData.user) {
            setUser(authData.user);
        } else {
            fetchUserProfile();
        }
    };

    const updateProfile = async (profileData) => {
        const response = await apiUpdateProfile(profileData);
        if (response.user) {
            setUser(response.user);
        } else {
            setUser((prev) => ({ ...prev, ...profileData }));
        }
        return response;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user || !!localStorage.getItem('access_token') || !!localStorage.getItem('user_id'),
                loading,
                login,
                logout,
                updateProfile,
                refreshProfile: fetchUserProfile
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
