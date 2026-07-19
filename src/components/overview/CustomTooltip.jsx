/**
 * CustomTooltip Component
 * Custom tooltip for Recharts charts
 */

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1a1a25',
        border: '1px solid #2a2a3d',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      }}>
        <p style={{ color: '#e8e8f0', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          {payload[0].name || payload[0].payload.name}
        </p>
        <p style={{ color: '#00d4ff', fontSize: '1rem', fontWeight: '600', fontFamily: 'JetBrains Mono, monospace' }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default CustomTooltip;

