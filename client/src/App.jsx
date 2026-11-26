import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import ReadingForm from './components/ReadingForm.jsx';
import ReadingsList from './components/ReadingsList.jsx';
import Reports from './components/Reports.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setChecking(false));
  }, []);

  const load = useCallback(async () => {
    const res = await api.listReadings({ page, limit: 10 });
    // If the last item on a page was deleted, step back a page.
    if (res.readings.length === 0 && page > 1) return setPage(page - 1);
    setData(res);
  }, [page]);

  useEffect(() => {
    if (user) load().catch(() => {});
  }, [user, load]);

  const changed = async () => {
    await load();
    setRefreshKey((k) => k + 1);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setData(null);
    setPage(1);
  };

  if (checking) return <p className="muted center">Loading...</p>;

  return (
    <div className="app">
      <header>
        <h1>Sweety</h1>
        <span className="tagline">Blood glucose tracker</span>
        {user && (
          <span className="who">
            {user.name} <button className="secondary" onClick={logout}>Log out</button>
          </span>
        )}
      </header>
      {!user ? (
        <AuthForm onAuthed={setUser} />
      ) : (
        <main>
          <ReadingForm onSubmit={async (v) => { await api.createReading(v); setPage(1); await changed(); }} />
          <Reports refreshKey={refreshKey} />
          <ReadingsList
            data={data}
            page={page}
            onPage={setPage}
            onUpdate={async (id, v) => { await api.updateReading(id, v); await changed(); }}
            onDelete={async (id) => { await api.deleteReading(id); await changed(); }}
          />
        </main>
      )}
    </div>
  );
}
