import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  updateProfile as firebaseUpdateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { AuthUser } from "@/types";

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  clearError: () => void;
  // Legacy compat — kept so pages that call login() still compile
  login: (identifier: string, method: "email" | "google" | "phone") => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map a Firebase user to our internal AuthUser shape */
function firebaseUserToAuthUser(fbUser: FirebaseUser): AuthUser {
  const displayName = fbUser.displayName || fbUser.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return {
    id: fbUser.uid,
    name: displayName,
    username: fbUser.email?.split("@")[0] || fbUser.uid.substring(0, 8),
    email: fbUser.email || "",
    phone: fbUser.phoneNumber || "",
    // Use photo URL from Google/provider if available; otherwise initials
    avatar: fbUser.photoURL || initials,
    isAuthenticated: true,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Subscribe to Firebase auth state changes.
   * With `browserLocalPersistence` set in firebase.js, Firebase auto-restores
   * the session from IndexedDB on every app launch — perfect for PWA offline use.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        const authUser = firebaseUserToAuthUser(fbUser);
        setUser(authUser);

        // Sync user to MongoDB and restore fields that Firebase Auth can't store
        // (e.g. base64 avatars are too large for Firebase's photoURL field)
        try {
          const { ApiService } = await import("@/services/ApiService");
          const dbUser = await ApiService.post("/api/users/sync", {
            authId: fbUser.uid,
            username: authUser.username,
            displayName: authUser.name,
            email: authUser.email,
            phone: authUser.phone,
            // Only send the Firebase avatar on first sync (don't overwrite a
            // custom uploaded avatar already saved in MongoDB)
            avatar: authUser.avatar,
          }) as any;

          if (dbUser) {
            setUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                // Prefer the MongoDB avatar (supports large base64) over the
                // Firebase photoURL (which has a small size limit)
                ...(dbUser.avatar && { avatar: dbUser.avatar }),
                ...(dbUser.upiId && { upiId: dbUser.upiId }),
              };
            });
          }
        } catch (e) {
          // Non-critical — don't block auth
          console.warn("User sync failed:", e);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut(auth);
      // onAuthStateChanged will clear user state automatically
    } catch (e: any) {
      setError(e?.message || "Logout failed");
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<AuthUser>) => {
      if (!firebaseUser) return;
      setError(null);
      try {
        const firebaseUpdates: { displayName?: string; photoURL?: string } = {};
        if (updates.name) firebaseUpdates.displayName = updates.name;
        // Only store http URLs in Firebase photoURL — base64 data URIs are too
        // large for Firebase and will silently fail or get dropped on reload.
        // Custom uploaded avatars (data:) are persisted via MongoDB instead.
        if (typeof updates.avatar === "string" && updates.avatar.startsWith("http"))
          firebaseUpdates.photoURL = updates.avatar;

        if (Object.keys(firebaseUpdates).length > 0) {
          await firebaseUpdateProfile(firebaseUser, firebaseUpdates);
        }

        // Immediately update local state for snappy UI
        setUser((prev) => (prev ? { ...prev, ...updates } : prev));

        // Sync ALL profile fields to MongoDB so they survive page reloads.
        // This is especially important for avatar (base64 images are stored
        // here since Firebase Auth photoURL can't hold them).
        const { ApiService } = await import("@/services/ApiService");
        await ApiService.post("/api/users/sync", {
          authId: firebaseUser.uid,
          ...(updates.name !== undefined && { displayName: updates.name }),
          ...(updates.username !== undefined && { username: updates.username }),
          ...(updates.upiId !== undefined && { upiId: updates.upiId }),
          ...(updates.avatar !== undefined && { avatar: updates.avatar }),
        });
      } catch (e: any) {
        setError(e?.message || "Profile update failed");
        throw e;
      }
    },
    [firebaseUser]
  );

  /** Legacy no-op kept for backward compat — real auth is in LoginPage.tsx */
  const login = useCallback(
    async (_identifier: string, _method: "email" | "google" | "phone") => { },
    []
  );

  /**
   * Exposed for ProfilePage "forgot password" or other in-app flows.
   * The main forgot-password path in LoginPage calls Firebase directly.
   */
  const sendPasswordReset = useCallback(async (_email: string) => {
    // Handled directly in LoginPage; this is a no-op stub for type compatibility.
    // Call sendPasswordResetEmail(auth, email) directly wherever needed.
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        login,
        logout,
        updateProfile,
        sendPasswordReset,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
