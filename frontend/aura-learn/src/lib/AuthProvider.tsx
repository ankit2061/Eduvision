/**
 * Custom Auth Provider — replaces Auth0 entirely.
 * Uses localStorage to persist JWT token from our backend.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface AuthUser {
    user_id: string;
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AuthUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<AuthUser>;
    register: (name: string, email: string, password: string, role: string) => Promise<AuthUser>;
    logout: () => void;
    getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
    login: async () => ({ user_id: "", name: "", email: "", role: "" }),
    register: async () => ({ user_id: "", name: "", email: "", role: "" }),
    logout: () => { },
    getToken: () => null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount, check localStorage for existing session
    useEffect(() => {
        const savedToken = localStorage.getItem("eduvision_token");
        const savedUser = localStorage.getItem("eduvision_user");
        if (savedToken && savedUser) {
            try {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            } catch {
                localStorage.removeItem("eduvision_token");
                localStorage.removeItem("eduvision_user");
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Login failed" }));
            throw new Error(err.detail || "Login failed");
        }

        const data = await res.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem("eduvision_token", data.access_token);
        localStorage.setItem("eduvision_user", JSON.stringify(data.user));
        return data.user;
    }, []);

    const register = useCallback(async (name: string, email: string, password: string, role: string): Promise<AuthUser> => {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Registration failed" }));
            throw new Error(err.detail || "Registration failed");
        }

        const data = await res.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem("eduvision_token", data.access_token);
        localStorage.setItem("eduvision_user", JSON.stringify(data.user));
        return data.user;
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("eduvision_token");
        localStorage.removeItem("eduvision_user");
    }, []);

    const getToken = useCallback(() => token, [token]);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated: !!token && !!user,
                isLoading,
                user,
                token,
                login,
                register,
                logout,
                getToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
