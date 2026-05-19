import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api, { UNAUTHORIZED_EVENT } from "@/lib/api";
import { User, Role } from "@/types";

const ROLE_LEVELS: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  TEAM_MEMBER: 1,
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  hasRole: (minRole: Role) => boolean;
  roleLevel: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem("stallion_token"),
    isLoading: true,
  });

  useEffect(() => {
    const onUnauthorized = () => {
      setState({ user: null, token: null, isLoading: false });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("stallion_token");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    try {
      const { data } = await api.get<User>("/auth/me");
      setState({ user: data, token, isLoading: false });
    } catch {
      localStorage.removeItem("stallion_token");
      setState({ user: null, token: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>(
      "/auth/login",
      { email, password },
    );
    localStorage.setItem("stallion_token", data.token);
    setState({ user: data.user, token: data.token, isLoading: false });
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>(
      "/auth/register",
      { name, email, password },
    );
    localStorage.setItem("stallion_token", data.token);
    setState({ user: data.user, token: data.token, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem("stallion_token");
    setState({ user: null, token: null, isLoading: false });
  };

  const updateUser = (user: User) => {
    setState((s) => ({ ...s, user }));
  };

  const userRole = state.user?.role ?? "TEAM_MEMBER";
  const roleLevel = ROLE_LEVELS[userRole] ?? 1;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateUser,
        isSuperAdmin: userRole === "SUPER_ADMIN",
        isAdmin: roleLevel >= ROLE_LEVELS["ADMIN"],
        isManager: roleLevel >= ROLE_LEVELS["MANAGER"],
        hasRole: (minRole: Role) => roleLevel >= ROLE_LEVELS[minRole],
        roleLevel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
