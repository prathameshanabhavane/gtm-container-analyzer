/**
 * StatCard Component
 * Displays a statistic with icon, label and value
 */

const StatCard = ({ icon: Icon, label, value, color, onClick }) => (
  <div 
    className={`stat-card ${color} ${onClick ? 'clickable' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
  >
    <div className="stat-icon">
      <Icon size={24} strokeWidth={1.8} />
    </div>
    <div className="stat-content">
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

export default StatCard;

