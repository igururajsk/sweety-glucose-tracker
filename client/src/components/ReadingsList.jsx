import { useState } from 'react';
import ReadingForm from './ReadingForm.jsx';

export default function ReadingsList({ data, page, onPage, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  if (!data) return <p className="muted">Loading...</p>;

  return (
    <section className="card">
      <h3>Your readings</h3>
      {data.readings.length === 0 ? (
        <p className="muted">No readings yet. Add your first one above.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Date</th><th>Slot</th><th>mg/dl</th><th /></tr>
          </thead>
          <tbody>
            {data.readings.map((r) =>
              editingId === r.id ? (
                <tr key={r.id}>
                  <td colSpan={4}>
                    <ReadingForm
                      initial={r}
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (v) => {
                        await onUpdate(r.id, v);
                        setEditingId(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.slotLabel}</td>
                  <td>{r.value}</td>
                  <td className="actions">
                    <button className="secondary" onClick={() => setEditingId(r.id)}>Edit</button>
                    <button className="danger" onClick={() => window.confirm('Delete this reading?') && onDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
      {data.totalPages > 1 && (
        <div className="pager">
          <button className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button className="secondary" disabled={page >= data.totalPages} onClick={() => onPage(page + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
