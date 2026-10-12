export default function ComingSoon({ title }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 44 }}>🚧</div>
      <h2 style={{ margin: '8px 0' }}>{title}</h2>
      <p style={{ color: 'var(--muted)' }}>This page will be built next.</p>
    </div>
  );
}