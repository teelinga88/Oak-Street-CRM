import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F7F6F3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, border: '0.5px solid #E5E4DF',
        padding: '40px 36px', width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>🚚</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Oak Street Logistics LLC</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>Sales CRM</div>
          </div>
        </div>

        <div style={{ height: 1, background: '#E5E4DF', margin: '20px 0' }} />

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Sign in</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Use your Oak Street email and password</p>

        {error && (
          <div style={{
            background: '#FCEBEB', color: '#A32D2D', border: '0.5px solid #F09595',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@oakstreet-logistics.com"
              required
              style={{
                width: '100%', padding: '9px 12px', fontSize: 13,
                border: '0.5px solid #D5D4CF', borderRadius: 8,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '9px 12px', fontSize: 13,
                border: '0.5px solid #D5D4CF', borderRadius: 8,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px', fontSize: 14, fontWeight: 500,
              background: loading ? '#888' : '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 20 }}>
          Contact Alex or Bobby if you need access.
        </p>
      </div>
    </div>
  );
}
