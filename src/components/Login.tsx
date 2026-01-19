import React, { useState } from 'react';
import {
  useSignInWithGoogle,
  useSignInWithEmailPassword,
  usePasswordReset,
} from '../queries/authQueries';
import '../styles/main.css';

const CLASS_NAMES = {
  login: 'login',
  loginContainer: 'login-container',
  button: 'login-button',
  logo: 'login-logo',
  title: 'login-title',
  leftPanel: 'login-left-panel',
  rightPanel: 'login-right-panel',
  greeting: 'login-greeting',
  quote: 'login-quote',
  formGroup: 'form-group',
  input: 'login-input',
  formContainer: 'login-form-container',
  divider: 'login-divider'
};

export const Login: React.FC = () => {
  const googleLogin = useSignInWithGoogle();
  const emailLogin = useSignInWithEmailPassword();
  const passwordReset = usePasswordReset();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const loading = googleLogin.isPending || emailLogin.isPending;
  const error =
    (googleLogin.error as Error)?.message ||
    (emailLogin.error as Error)?.message ||
    null;

  const handleGoogleLogin = () => {
    googleLogin.mutate();
  };

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    emailLogin.mutate({ email, password });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    passwordReset.mutate(resetEmail, {
      onSuccess: () => {
        setResetSuccess(true);
      },
    });
  };

  return (
    <div className={CLASS_NAMES.login}>
      <div className={CLASS_NAMES.loginContainer}>
        <div className={CLASS_NAMES.leftPanel}>
          <h2 className={CLASS_NAMES.greeting}>Asalamu' Alaykum!</h2>
          <p className={CLASS_NAMES.quote}>
            The prophet ﷺ stated that "Seeking knowledge is an obligation upon every muslim"
            <br />
            <span className="quote-source">(Sunan Ibn Majah 224)</span>
          </p>
        </div>

        <div className={CLASS_NAMES.rightPanel}>
          <img
            src="/logo.webp"
            alt="Tanwir Logo"
            className={CLASS_NAMES.logo}
          />

          {!showResetForm ? (
            <>
              <form onSubmit={handleEmailPasswordLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />

                <button className="login-button" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowResetForm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4A90E2',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginTop: '10px',
                  textDecoration: 'underline',
                }}
              >
                Forgot Password?
              </button>

              <div className="login-divider">OR</div>

              <button
                className="login-button google-button"
                onClick={handleGoogleLogin}
                disabled={loading}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>

              {error && <div className="login-error">{error}</div>}
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>
                Reset Password
              </h3>
              
              {resetSuccess ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#4CAF50', marginBottom: '20px' }}>
                    Password reset email sent! Check your inbox.
                  </p>
                  <button
                    className="login-button"
                    onClick={() => {
                      setShowResetForm(false);
                      setResetSuccess(false);
                      setResetEmail('');
                    }}
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset}>
                  <p style={{ fontSize: '14px', marginBottom: '15px', color: '#666' }}>
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <input
                    type="email"
                    placeholder="Email"
                    className="login-input"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={passwordReset.isPending}
                    required
                  />

                  <button
                    className="login-button"
                    disabled={passwordReset.isPending}
                  >
                    {passwordReset.isPending ? 'Sending…' : 'Send Reset Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4A90E2',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginTop: '10px',
                      textDecoration: 'underline',
                    }}
                  >
                    Back to Login
                  </button>

                  {passwordReset.error && (
                    <div className="login-error">
                      {(passwordReset.error as Error)?.message}
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
