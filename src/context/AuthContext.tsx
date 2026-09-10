import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  getAuth,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  limit,
  query,
  increment,
} from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfig } from '../lib/firebase';
import { AppUser, UserRole, UserStatus } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  recordCrawlUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const HARDCODED_ADMIN_EMAILS = [
  'tuan.le@robusltd.com',
  'letuanthhcm@gmail.com',
];

export const isHardcodedAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return HARDCODED_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === email.toLowerCase());
};

const DEFAULT_ADMIN_USER = 'tuan.le@robusltd.com';
const DEFAULT_ADMIN_PASS = 'Tsadssd@123*#';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Background check: Ensure default hardcoded admin exists in Firebase Auth
  useEffect(() => {
    const ensureHardcodedAdminExists = async () => {
      try {
        const tempName = `admin-init-${Date.now()}`;
        const tempApp = initializeApp(firebaseConfig, tempName);
        const tempAuth = getAuth(tempApp);
        try {
          const cred = await createUserWithEmailAndPassword(tempAuth, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
          if (cred.user) {
            await updateProfile(cred.user, { displayName: 'Tuan Le (Admin)' });
            const adminProfile: AppUser = {
              uid: cred.user.uid,
              email: DEFAULT_ADMIN_USER,
              username: 'tuan.le',
              displayName: 'Tuan Le (Admin)',
              role: 'admin',
              status: 'active',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              crawlsCount: 0,
            };
            await setDoc(doc(db, 'users', cred.user.uid), adminProfile);
          }
          await signOut(tempAuth);
        } catch (authErr: any) {
          // If already created, that's expected
        } finally {
          await deleteApp(tempApp);
        }
      } catch (e) {
        // Silent fallback
      }
    };

    ensureHardcodedAdminExists();
  }, []);

  // Sync Firebase Auth user and Firestore AppUser profile
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!fbUser) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        const isHardcodedAdmin = isHardcodedAdminEmail(fbUser.email);

        if (!userDocSnap.exists()) {
          // Check if this is the very first user in the system
          let isFirstUser = false;
          try {
            const usersQ = query(collection(db, 'users'), limit(2));
            const existingUsersSnap = await getDocs(usersQ);
            isFirstUser = existingUsersSnap.empty;
          } catch (e) {
            console.warn('Could not query users collection count:', e);
          }

          const role: UserRole = isHardcodedAdmin || isFirstUser ? 'admin' : 'user';
          const status: UserStatus = 'active';

          const isLocalDomain = fbUser.email?.endsWith('@sitemap.local');
          const extractedUsername = isLocalDomain && fbUser.email ? fbUser.email.replace('@sitemap.local', '') : undefined;

          const newProfile: AppUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            username: extractedUsername,
            displayName: fbUser.displayName || extractedUsername || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL || undefined,
            role,
            status,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            crawlsCount: 0,
          };

          await setDoc(userDocRef, newProfile);
          setAppUser(newProfile);
        } else {
          // Update last login
          const currentData = userDocSnap.data() as AppUser;
          // Ensure hardcoded admin always maintains admin role
          const updatedRole = isHardcodedAdmin ? 'admin' : currentData.role || 'user';
          
          await updateDoc(userDocRef, {
            lastLoginAt: new Date().toISOString(),
            displayName: fbUser.displayName || currentData.displayName || fbUser.email?.split('@')[0],
            role: updatedRole,
          });

          setAppUser({
            ...currentData,
            role: updatedRole,
            lastLoginAt: new Date().toISOString(),
          });
        }

        // Real-time listener for user document (handles role/status changes immediately)
        unsubscribeDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AppUser;
            setAppUser(data);
          }
        });
      } catch (err) {
        console.error('Error initializing user profile:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const isAdmin = useMemo(() => {
    if (!firebaseUser) return false;
    if (isHardcodedAdminEmail(firebaseUser.email)) return true;
    return appUser?.role === 'admin';
  }, [firebaseUser, appUser]);

  const isActive = useMemo(() => {
    if (isAdmin) return true;
    return appUser?.status === 'active';
  }, [isAdmin, appUser]);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const normalizeIdentifier = (identifier: string): string => {
    const trimmed = identifier.trim();
    if (trimmed.toLowerCase() === 'tuan.le' || trimmed.toLowerCase() === 'tuan.le@robusltd.com') {
      return 'tuan.le@robusltd.com';
    }
    if (trimmed.includes('@')) {
      return trimmed;
    }
    return `${trimmed.toLowerCase()}@sitemap.local`;
  };

  const loginWithEmail = async (identifier: string, pass: string) => {
    const emailToUse = normalizeIdentifier(identifier);
    try {
      await signInWithEmailAndPassword(auth, emailToUse, pass);
    } catch (err: any) {
      // If logging in as the hardcoded admin with predefined credentials and not yet in Firebase Auth
      const isTargetAdmin =
        emailToUse.toLowerCase() === DEFAULT_ADMIN_USER.toLowerCase() &&
        pass === DEFAULT_ADMIN_PASS;
      const isMissing =
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials';

      if (isTargetAdmin && isMissing) {
        const cred = await createUserWithEmailAndPassword(auth, emailToUse, pass);
        if (cred.user) {
          await updateProfile(cred.user, { displayName: 'Tuan Le (Admin)' });
        }
        return;
      }
      throw err;
    }
  };

  const registerWithEmail = async (identifier: string, pass: string, name: string) => {
    const emailToUse = normalizeIdentifier(identifier);
    const cred = await createUserWithEmailAndPassword(auth, emailToUse, pass);
    if (name.trim() && cred.user) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
  };

  const logout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setAppUser(null);
  };

  const recordCrawlUsage = async () => {
    if (!firebaseUser) return;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        crawlsCount: increment(1),
        lastCrawlAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not record crawl usage:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        loading,
        isAdmin,
        isActive,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        recordCrawlUsage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
