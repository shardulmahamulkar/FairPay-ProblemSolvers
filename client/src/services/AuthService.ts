/**
 * AuthService — thin wrapper around Firebase Auth operations.
 * The heavy lifting (state management, persistence) lives in AuthContext.tsx.
 * Use this service from places that don't have React context access.
 */
import {
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  deleteUser,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export const AuthService = {
  /** Send a password reset email to the given address */
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  /** Returns the list of sign-in methods for an email address */
  async getSignInMethods(email: string): Promise<string[]> {
    return fetchSignInMethodsForEmail(auth, email);
  },

  /** Permanently delete the current Firebase user account */
  async deleteAccount(user: FirebaseUser): Promise<void> {
    await deleteUser(user);
  },

  /** Get the currently signed-in Firebase user (synchronous snapshot) */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },
};
