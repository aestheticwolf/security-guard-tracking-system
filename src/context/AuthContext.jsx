import { createContext, startTransition, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import useSessionTimer from "../hooks/useSessionTimer";
import {
  getCurrentUser,
  loginUser,
  logoutUser
} from "../services/authService";
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession
} from "../utils/sessionStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const storedSession = typeof window === "undefined" ? null : getStoredSession();
  const [token, setToken] = useState(storedSession?.token || null);
  const [user, setUser] = useState(storedSession?.user || null);
  const [authReady, setAuthReady] = useState(false);

  function clearSession() {
    clearStoredSession();
    setToken(null);
    startTransition(() => setUser(null));
  }

  function persistSession(nextToken, nextUser) {
    setStoredSession({ token: nextToken, user: nextUser });
    setToken(nextToken);
    startTransition(() => setUser(nextUser));
  }

  async function login(credentials) {
    const response = await loginUser(credentials);
    persistSession(response.token, response.user);
    return response.user;
  }

  async function logout({ remote = true } = {}) {
    const currentToken = token;

    if (remote && currentToken) {
      try {
        await logoutUser();
      } catch {
        // Ignore remote logout failures and clear the local session anyway.
      }
    }

    clearSession();
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateUser() {
      if (!token) {
        setAuthReady(true);
        return;
      }

      try {
        const response = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        startTransition(() => setUser(response.user));
        setStoredSession({ token, user: response.user });
      } catch {
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    }

    hydrateUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useSessionTimer(token, () => {
    toast.error("Your session expired. Please sign in again.");
    logout({ remote: false });
  });

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        authReady,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
