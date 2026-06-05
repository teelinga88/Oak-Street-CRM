import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import CRM from './pages/CRM';

function AppInner() {
  const { currentUser, repProfile } = useAuth();

  if (!currentUser) return <Login />;
  if (!repProfile) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', color: '#666', fontSize: 14
      }}>
        Your account is not set up yet. Contact Alex or Bobby.
      </div>
    );
  }

  return <CRM />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
