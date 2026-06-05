import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Team roster — maps email to rep info
export const TEAM_ROSTER = {
  'alex@oakstreetlogistics.com':   { name: 'Alex Teeling',    initials: 'AT', isManager: true,  color: ['#E6F1FB','#0C447C'] },
  'bobby@oakstreetlogistics.com':  { name: "Bobby O'Brien",   initials: 'BO', isManager: true,  color: ['#E1F5EE','#085041'] },
  'bryan@oakstreetlogistics.com':  { name: 'Bryan Clifford',  initials: 'BC', isManager: false, color: ['#EEEDFE','#3C3489'] },
  'charles@oakstreetlogistics.com':{ name: 'Charles Tolson',  initials: 'CT', isManager: false, color: ['#FAEEDA','#633806'] },
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [repProfile, setRepProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Look up rep profile by email
        const profile = TEAM_ROSTER[user.email.toLowerCase()];
        setRepProfile(profile || null);
      } else {
        setRepProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = { currentUser, repProfile, login, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
