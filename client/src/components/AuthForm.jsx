import { useState } from 'react';
import { api, setToken, ApiError } from '../api.js';

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = mode === 'login' ? await api.login({ email: form.email, password: form.password }) : await api.signup(form);
      setToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
      {mode === 'signup' && (
        <label>
          Name
          <input value={form.name} onChange={set('name')} autoComplete="name" required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
      </label>
      <label>
        Password
        <input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      <p className="muted">
        {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </button>
      </p>
    </form>
  );
}
