import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Eye, EyeOff, LogIn, Lock, Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { authApi, mapLoginResponse } from '../services/api';
import { useApp } from '../context/useApp';

const PARTICLES = ['🍛', '🎂', '🍔', '🍕', '🥩', '🍜', '🥐', '🍰', '🍗', '🫕'];

function generateParticles(count = 18) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: PARTICLES[i % PARTICLES.length],
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 6}s`,
      animationDuration: `${8 + Math.random() * 10}s`,
      fontSize: `${1.1 + Math.random() * 1.4}rem`,
      opacity: 0.07 + Math.random() * 0.09,
    },
  }));
}

const getRedirectMode = (role) => {
  if (role === 'Chef') return 'kds';
  if (role === 'Admin' || role === 'SuperAdmin' || role === 'BranchManager') return 'admin';
  return 'pos';
};

export default function LoginPage({ onBack }) {
  const { saveAuthSession, setCurrentMode, authUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [particles] = useState(() => generateParticles(18));
  const emailRef = useRef(null);

  useEffect(() => {
    if (authUser) setCurrentMode(getRedirectMode(authUser.role));
  }, [authUser, setCurrentMode]);

  useEffect(() => { emailRef.current?.focus(); }, [isResetMode]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const data = await authApi.login(email.trim(), password);
      const session = mapLoginResponse(data);
      saveAuthSession(session);
      setSuccess(true);
      setTimeout(() => setCurrentMode(getRedirectMode(session.user.role)), 800);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 400) { setError('Invalid email or password. Please try again.'); }
      else if (status === 403) { setError('Your account has been disabled. Contact your manager.'); }
      else {
        setError('Server unavailable. Staff access requires a successful server login.');
      }
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (!resetEmail.trim() || !newPassword.trim()) {
      setError('Please provide your registered email/phone and new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must contain at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please recheck.');
      return;
    }
    setLoading(true);
    setError('');
    setResetSuccess('');
    try {
      const res = await authApi.resetPassword(resetEmail.trim(), newPassword.trim());
      setResetSuccess(res?.message || 'Password reset successful! You can now sign in.');
      setEmail(resetEmail.trim());
      setPassword(newPassword.trim());
      setTimeout(() => {
        setIsResetMode(false);
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Password reset failed. Please ensure the email is registered.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root" id="login-page">
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-bg__gradient" />
        {particles.map(p => (
          <span key={p.id} className="lp-particle" style={p.style} aria-hidden="true">{p.emoji}</span>
        ))}
      </div>
      <button className="lp-back" onClick={onBack ?? (() => setCurrentMode('customer'))}>
        <ArrowLeft size={16} /> Back to menu
      </button>
      <div className="lp-card" role="main">
        <div className="lp-logo">
          <span className="lp-logo__mark"><ChefHat size={30} /></span>
          <div><strong>Kabir's Kitchen</strong><small>Staff Portal</small></div>
        </div>
        <h1 className="lp-heading">{isResetMode ? 'Reset Password' : 'Welcome back'}</h1>
        <p className="lp-subheading">{isResetMode ? 'Enter your registered email and a new password' : 'Sign in to access the staff dashboard'}</p>
        
        {success && (
          <div className="lp-success"><CheckCircle2 size={22} /><span>Login successful! Redirecting…</span></div>
        )}
        {resetSuccess && (
          <div className="lp-success"><CheckCircle2 size={22} /><span>{resetSuccess}</span></div>
        )}
        {error && !success && (
          <div className="lp-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>
        )}

        {!success && !isResetMode && (
          <form className="lp-form" onSubmit={handleLogin} noValidate>
            <div className="lp-field">
              <label htmlFor="lp-email">Email address</label>
              <div className="lp-field__input-wrap">
                <Mail size={17} className="lp-field__icon" />
                <input ref={emailRef} id="lp-email" type="email" autoComplete="username email" placeholder="your@email.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} disabled={loading} required />
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="lp-password">
                Password
                <a href="#" className="lp-forgot" tabIndex={-1} onClick={e => { e.preventDefault(); setError(''); setResetEmail(email); setIsResetMode(true); }}>Forgot password?</a>
              </label>
              <div className="lp-field__input-wrap">
                <Lock size={17} className="lp-field__icon" />
                <input id="lp-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} disabled={loading} required />
                <button type="button" className="lp-field__toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button id="lp-submit" type="submit" className="lp-submit" disabled={loading}>
              {loading ? <><Loader2 size={18} className="lp-spin" /> Signing in…</> : <><LogIn size={18} /> Sign In</>}
            </button>
          </form>
        )}

        {!success && isResetMode && (
          <form className="lp-form" onSubmit={handleResetPassword} noValidate>
            <div className="lp-field">
              <label htmlFor="rp-email">Registered Email address or Phone</label>
              <div className="lp-field__input-wrap">
                <Mail size={17} className="lp-field__icon" />
                <input ref={emailRef} id="rp-email" type="email" placeholder="marruffhossain@gmail.com" value={resetEmail} onChange={e => { setResetEmail(e.target.value); setError(''); }} disabled={loading} required />
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="rp-password">New Password (at least 6 characters)</label>
              <div className="lp-field__input-wrap">
                <Lock size={17} className="lp-field__icon" />
                <input id="rp-password" type={showPassword ? 'text' : 'password'} placeholder="New secure password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(''); }} disabled={loading} required />
                <button type="button" className="lp-field__toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="rp-confirm-password">Confirm New Password</label>
              <div className="lp-field__input-wrap">
                <Lock size={17} className="lp-field__icon" />
                <input id="rp-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="Re-enter new password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }} disabled={loading} required />
              </div>
            </div>
            <button id="rp-submit" type="submit" className="lp-submit" disabled={loading}>
              {loading ? <><Loader2 size={18} className="lp-spin" /> Updating Password…</> : <><CheckCircle2 size={18} /> Update Password</>}
            </button>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <a href="#" className="lp-forgot" onClick={e => { e.preventDefault(); setError(''); setIsResetMode(false); }}>
                ← Back to Sign In
              </a>
            </div>
          </form>
        )}

        <p className="lp-security"><Lock size={12} /> Secured · Staff access only · All sessions are logged</p>
      </div>
    </div>
  );
}
