/**
 * OverviewSection Component
 * Dashboard overview with stats cards and chart
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Tags, Zap, Variable, Layers, 
  PlayCircle, PauseCircle, 
  ChevronUp, ChevronDown, BarChart3 
} from 'lucide-react';
import { StatCard } from '../common';
import CustomTooltip from './CustomTooltip';
import { CHART_COLORS } from '../../constants';

const OverviewSection = ({ 
  stats, 
  chartData, 
  showOverview, 
  setShowOverview,
  onNavigate 
}) => {
  return (
    <div className="overview-section">
      <button 
        className={`overview-toggle ${showOverview ? 'expanded' : 'collapsed'}`}
        onClick={() => setShowOverview(!showOverview)}
      >
        <BarChart3 size={16} />
        <span>Overview</span>
        <div className="overview-toggle-stats">
          <span className="mini-stat">{stats.totalTags} Tags</span>
          <span className="mini-stat-divider">•</span>
          <span className="mini-stat">{stats.totalTriggers} Triggers</span>
        </div>
        {showOverview ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      
      {showOverview && (
        <div className="stats-chart-container">
          <div className="stats-grid">
            <StatCard 
              icon={Tags} 
              label="Total Tags" 
              value={stats.totalTags} 
              color="cyan" 
              onClick={() => onNavigate('tags')}
            />
            <StatCard 
              icon={PlayCircle} 
              label="Active" 
              value={stats.activeTags} 
              color="green" 
              onClick={() => onNavigate('tags', { status: 'active' })}
            />
            <StatCard 
              icon={PauseCircle} 
              label="Paused" 
              value={stats.pausedTags} 
              color="orange" 
              onClick={() => onNavigate('tags', { status: 'paused' })}
            />
            <StatCard 
              icon={Zap} 
              label="Triggers" 
              value={stats.totalTriggers} 
              color="purple" 
              onClick={() => onNavigate('triggers')}
            />
            <StatCard 
              icon={Variable} 
              label="Variables" 
              value={stats.totalVariables} 
              color="magenta" 
              onClick={() => onNavigate('variables')}
            />
            <StatCard 
              icon={Layers} 
              label="Tag Types" 
              value={Object.keys(stats.tagsByType).length} 
              color="blue" 
            />
          </div>
          
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Tags Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {chartData.slice(0, 5).map((item, index) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-dot" style={{ background: CHART_COLORS[index] }} />
                  <span className="legend-text">{item.name}</span>
                  <span className="legend-count">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewSection;

