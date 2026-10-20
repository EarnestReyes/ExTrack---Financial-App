import type { User } from "firebase/auth";
import { createContext, useContext } from "react";

export const AuthContext = createContext<{
  user: User | null;
  logout: () => Promise<void>;
}>({
  user: null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

