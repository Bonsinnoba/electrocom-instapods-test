export default function StatusCard({ title, value, icon, trend }) {
  return (
    <div className="status-card glass">
      <div className="status-icon">{icon}</div>
      <div className="status-details">
        <p>{title}</p>
        <h3>{value}</h3>
        <span className="trend">{trend}</span>
      </div>
    </div>
  );
}