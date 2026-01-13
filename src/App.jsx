
import React, { useState, useMemo } from 'react';
import defenseData from './data/defense_stats.json';
import weeklyData from './data/weekly_defense.json';
import './index.css';

// =============================================
// RANKING COLOR SYSTEM
// Rank 1 = Best defense = HARD to score against = RED (Bad matchup for betting)
// Rank 32 = Worst defense = EASY to score against = GREEN (Good matchup for betting)
// =============================================

const getColorForRank = (rank, totalTeams = 32) => {
  // Linear interpolation from red (rank 1) to green (rank 32)
  const percentage = (rank - 1) / (totalTeams - 1);
  // Red: #ef4444, Yellow: #eab308, Green: #22c55e
  if (percentage < 0.33) {
    // Red to orange
    const r = 239;
    const g = Math.round(68 + (179 - 68) * (percentage / 0.33));
    const b = Math.round(68 + (8 - 68) * (percentage / 0.33));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (percentage < 0.66) {
    // Orange to yellow-green
    const adjustedPct = (percentage - 0.33) / 0.33;
    const r = Math.round(234 - (234 - 132) * adjustedPct);
    const g = Math.round(179 + (197 - 179) * adjustedPct);
    const b = Math.round(8 + (94 - 8) * adjustedPct);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow-green to green
    const adjustedPct = (percentage - 0.66) / 0.34;
    const r = Math.round(132 - (132 - 34) * adjustedPct);
    const g = 197;
    const b = Math.round(94 - (94 - 94) * adjustedPct);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const getRankLabel = (rank) => {
  if (rank <= 5) return 'Elite';
  if (rank <= 10) return 'Strong';
  if (rank <= 16) return 'Above Avg';
  if (rank <= 22) return 'Below Avg';
  if (rank <= 27) return 'Weak';
  return 'Very Weak';
};

// =============================================
// DATA PROCESSING WITH COMPREHENSIVE RANKINGS
// =============================================

const calculateRank = (data, getValue, ascending = true) => {
  const sorted = [...data].sort((a, b) => {
    const valA = getValue(a);
    const valB = getValue(b);
    return ascending ? valA - valB : valB - valA;
  });
  const ranks = {};
  sorted.forEach((team, idx) => {
    ranks[team.Team] = idx + 1;
  });
  return ranks;
};

// Process weekly data to aggregate stats for last N games
const processWeeklyData = (fullSeasonData, numGames) => {
  // If full season (0 or 17+), just return the original processed data
  if (!numGames || numGames >= 17) {
    return processData(fullSeasonData);
  }

  // Aggregate weekly stats for each team
  const aggregatedData = fullSeasonData.map(team => {
    const teamWeekly = weeklyData[team.Team];
    if (!teamWeekly || !teamWeekly.games) {
      return team; // Fall back to full season data
    }

    // Filter out bye weeks and get actual games, sorted by week desc, take last N
    const actualGames = teamWeekly.games
      .filter(g => g.opponent !== 'Bye Week')
      .sort((a, b) => b.week - a.week)
      .slice(0, numGames);

    if (actualGames.length === 0) {
      return team;
    }

    const gamesCount = actualGames.length;
    const seasonGames = 17;
    const gameRatio = gamesCount / seasonGames;
    
    const totals = actualGames.reduce((acc, game) => ({
      pointsAllowed: acc.pointsAllowed + game.pointsAllowed,
      totalYards: acc.totalYards + game.totalYardsAllowed,
      passYards: acc.passYards + game.passYardsAllowed,
      rushYards: acc.rushYards + game.rushYardsAllowed,
      turnovers: acc.turnovers + game.turnoversForced
    }), { pointsAllowed: 0, totalYards: 0, passYards: 0, rushYards: 0, turnovers: 0 });

    // Prorate TDs based on game ratio (we don't have per-game TD data)
    const prorateTDs = (val) => Math.round(Number(val || 0) * gameRatio);

    return {
      ...team,
      G: String(gamesCount),
      PointsAllowed: String(totals.pointsAllowed),
      TotalYardsAllowed: String(totals.totalYards),
      PassingYards: String(totals.passYards),
      RushingYards: String(totals.rushYards),
      Turnovers: String(totals.turnovers),
      // Prorate TDs (approximation since per-game TD data not available)
      PassingTDs: String(prorateTDs(team.PassingTDs)),
      RushingTDs: String(prorateTDs(team.RushingTDs)),
      // Prorate Fantasy position TDs as well
      Fantasy: team.Fantasy ? {
        WR: team.Fantasy.WR ? {
          ...team.Fantasy.WR,
          Yards: String(prorateTDs(team.Fantasy.WR.Yards)),
          TDs: String(prorateTDs(team.Fantasy.WR.TDs)),
          Receptions: String(prorateTDs(team.Fantasy.WR.Receptions)),
        } : null,
        RB: team.Fantasy.RB ? {
          ...team.Fantasy.RB,
          RushYards: String(prorateTDs(team.Fantasy.RB.RushYards)),
          RecYards: String(prorateTDs(team.Fantasy.RB.RecYards)),
          TDs: String(prorateTDs(team.Fantasy.RB.TDs)),
          Receptions: String(prorateTDs(team.Fantasy.RB.Receptions)),
        } : null,
        TE: team.Fantasy.TE ? {
          ...team.Fantasy.TE,
          Yards: String(prorateTDs(team.Fantasy.TE.Yards)),
          TDs: String(prorateTDs(team.Fantasy.TE.TDs)),
          Receptions: String(prorateTDs(team.Fantasy.TE.Receptions)),
        } : null,
        QB: team.Fantasy.QB ? {
          ...team.Fantasy.QB,
          PassYards: String(prorateTDs(team.Fantasy.QB.PassYards)),
          PassTD: String(prorateTDs(team.Fantasy.QB.PassTD)),
          RushYards: String(prorateTDs(team.Fantasy.QB.RushYards)),
        } : null,
      } : null,
      _isFiltered: true,
      _gamesUsed: gamesCount,
      _isProrated: true  // Flag to indicate TD/position stats are prorated
    };
  });

  return processData(aggregatedData);
};

const processData = (data) => {
  // Overall rankings
  const overallRanks = calculateRank(data, t => Number(t.PointsAllowed));
  const totalYdsRanks = calculateRank(data, t => Number(t.TotalYardsAllowed));
  const passYdsRanks = calculateRank(data, t => Number(t.PassingYards));
  const rushYdsRanks = calculateRank(data, t => Number(t.RushingYards));
  const passTdRanks = calculateRank(data, t => Number(t.PassingTDs));
  const rushTdRanks = calculateRank(data, t => Number(t.RushingTDs));
  const intRanks = calculateRank(data, t => Number(t.PassingInts), false); // More INTs = better defense
  const turnoverRanks = calculateRank(data, t => Number(t.Turnovers), false);

  // Position-specific rankings (Fantasy data)
  // WR Rankings
  const wrYdsRanks = calculateRank(data, t => Number(t.Fantasy?.WR?.Yards || 0));
  const wrTdsRanks = calculateRank(data, t => Number(t.Fantasy?.WR?.TDs || 0));
  const wrPtsRanks = calculateRank(data, t => Number(t.Fantasy?.WR?.PointsGame || 0));
  const wrRecRanks = calculateRank(data, t => Number(t.Fantasy?.WR?.Receptions || 0));

  // RB Rankings
  const rbRushYdsRanks = calculateRank(data, t => Number(t.Fantasy?.RB?.RushYards || 0));
  const rbRecYdsRanks = calculateRank(data, t => Number(t.Fantasy?.RB?.RecYards || 0));
  const rbTdsRanks = calculateRank(data, t => Number(t.Fantasy?.RB?.TDs || 0));
  const rbPtsRanks = calculateRank(data, t => Number(t.Fantasy?.RB?.PointsGame || 0));
  const rbRecRanks = calculateRank(data, t => Number(t.Fantasy?.RB?.Receptions || 0));

  // TE Rankings
  const teYdsRanks = calculateRank(data, t => Number(t.Fantasy?.TE?.Yards || 0));
  const teTdsRanks = calculateRank(data, t => Number(t.Fantasy?.TE?.TDs || 0));
  const tePtsRanks = calculateRank(data, t => Number(t.Fantasy?.TE?.PointsGame || 0));
  const teRecRanks = calculateRank(data, t => Number(t.Fantasy?.TE?.Receptions || 0));

  // QB Rankings
  const qbPassYdsRanks = calculateRank(data, t => Number(t.Fantasy?.QB?.PassYards || 0));
  const qbPassTdRanks = calculateRank(data, t => Number(t.Fantasy?.QB?.PassTD || 0));
  const qbRushYdsRanks = calculateRank(data, t => Number(t.Fantasy?.QB?.RushYards || 0));
  const qbPtsRanks = calculateRank(data, t => Number(t.Fantasy?.QB?.PointsGame || 0));

  return data.map(team => ({
    ...team,
    Ranks: {
      // Overall
      Overall: overallRanks[team.Team],
      TotalYards: totalYdsRanks[team.Team],
      PassYards: passYdsRanks[team.Team],
      RushYards: rushYdsRanks[team.Team],
      PassTDs: passTdRanks[team.Team],
      RushTDs: rushTdRanks[team.Team],
      Interceptions: intRanks[team.Team],
      Turnovers: turnoverRanks[team.Team],
      // WR specific
      WR: {
        Overall: wrPtsRanks[team.Team],
        Yards: wrYdsRanks[team.Team],
        TDs: wrTdsRanks[team.Team],
        Receptions: wrRecRanks[team.Team],
      },
      // RB specific
      RB: {
        Overall: rbPtsRanks[team.Team],
        RushYards: rbRushYdsRanks[team.Team],
        RecYards: rbRecYdsRanks[team.Team],
        TDs: rbTdsRanks[team.Team],
        Receptions: rbRecRanks[team.Team],
      },
      // TE specific
      TE: {
        Overall: tePtsRanks[team.Team],
        Yards: teYdsRanks[team.Team],
        TDs: teTdsRanks[team.Team],
        Receptions: teRecRanks[team.Team],
      },
      // QB specific
      QB: {
        Overall: qbPtsRanks[team.Team],
        PassYards: qbPassYdsRanks[team.Team],
        PassTDs: qbPassTdRanks[team.Team],
        RushYards: qbRushYdsRanks[team.Team],
      },
    }
  }));
};

// Full season data (pre-processed)
const fullSeasonData = processData(defenseData);

// =============================================
// REUSABLE COMPONENTS
// =============================================

const RankBadge = ({ rank, size = 'normal' }) => {
  const color = getColorForRank(rank);
  const sizeStyles = size === 'large' 
    ? { fontSize: '1.5rem', padding: '0.5rem 1rem', minWidth: '60px' }
    : { fontSize: '0.85rem', padding: '0.25rem 0.5rem', minWidth: '40px' };
  
  return (
    <span style={{
      background: color,
      color: rank <= 16 ? 'white' : '#0f172a',
      fontWeight: 'bold',
      borderRadius: '6px',
      display: 'inline-block',
      textAlign: 'center',
      textShadow: rank <= 16 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
      ...sizeStyles
    }}>
      #{rank}
    </span>
  );
};

const MatchupBar = ({ rank, height = 8, showLabel = false }) => {
  const percentage = ((rank - 1) / 31) * 100;
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        width: '100%',
        height: `${height}px`,
        background: 'linear-gradient(to right, #ef4444, #eab308, #22c55e)',
        borderRadius: '4px',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: `calc(${percentage}% - 2px)`,
          top: '-3px',
          bottom: '-3px',
          width: '4px',
          background: 'white',
          borderRadius: '2px',
          boxShadow: '0 0 6px rgba(0,0,0,0.5)'
        }} />
      </div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          <span>Tough</span>
          <span>Easy</span>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, value, rank, perGame = false, games = 17 }) => {
  const displayValue = perGame ? (Number(value) / games).toFixed(1) : value;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 70px 100px',
      alignItems: 'center',
      padding: '0.75rem',
      background: 'rgba(0,0,0,0.15)',
      borderRadius: '8px',
      borderLeft: `4px solid ${getColorForRank(rank)}`,
      marginBottom: '0.5rem'
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: '600', textAlign: 'right' }}>{displayValue}{perGame ? '/g' : ''}</span>
      <div style={{ textAlign: 'center' }}><RankBadge rank={rank} /></div>
      <MatchupBar rank={rank} height={6} />
    </div>
  );
};

const PositionCard = ({ position, team, onClick, isSelected }) => {
  const positionData = team.Fantasy?.[position];
  const rankData = team.Ranks?.[position];
  
  if (!positionData || !rankData) return null;

  const overallRank = rankData.Overall;
  const color = getColorForRank(overallRank);
  
  const positionLabels = {
    WR: 'Wide Receivers',
    RB: 'Running Backs',
    TE: 'Tight Ends',
    QB: 'Quarterbacks'
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0,0,0,0.2)',
        padding: '1.25rem',
        borderRadius: '12px',
        cursor: 'pointer',
        border: `2px solid ${isSelected ? 'var(--accent-blue)' : color}`,
        transition: 'all 0.2s ease',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        vs {positionLabels[position]}
      </div>
      <div style={{ margin: '0.75rem 0' }}>
        <RankBadge rank={overallRank} size="large" />
      </div>
      <div style={{ fontSize: '0.85rem', color: color, fontWeight: '600' }}>
        {getRankLabel(overallRank)}
      </div>
      <MatchupBar rank={overallRank} height={6} showLabel />
      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Click for details →
      </div>
    </div>
  );
};

// =============================================
// POSITION DETAIL VIEWS
// =============================================

const WRDetailView = ({ team }) => {
  const wr = team.Fantasy?.WR;
  const ranks = team.Ranks?.WR;
  const games = Number(team.G);
  
  if (!wr || !ranks) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h4 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🎯 Wide Receiver Metrics
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Defense allows...)</span>
      </h4>
      
      <StatRow label="WR Receptions" value={wr.Receptions} rank={ranks.Receptions} perGame games={games} />
      <StatRow label="WR Receiving Yards" value={wr.Yards} rank={ranks.Yards} perGame games={games} />
      <StatRow label="WR Touchdowns" value={wr.TDs} rank={ranks.TDs} />
      
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          💡 Betting Insight
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {ranks.Overall >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>SMASH SPOT:</strong> This defense ranks #{ranks.Overall} vs WRs. Target WR props (yards, receptions, TDs).
            </span>
          ) : ranks.Overall <= 8 ? (
            <span style={{ color: 'var(--degree-bad)' }}>
              <strong>CAUTION:</strong> Elite defense vs WRs (#{ranks.Overall}). Consider fading WR overs.
            </span>
          ) : (
            <span>Neutral matchup (#{ranks.Overall}). Look at specific metrics for edges.</span>
          )}
        </div>
      </div>
    </div>
  );
};

const RBDetailView = ({ team }) => {
  const rb = team.Fantasy?.RB;
  const ranks = team.Ranks?.RB;
  const games = Number(team.G);
  
  if (!rb || !ranks) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h4 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🏈 Running Back Metrics
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Defense allows...)</span>
      </h4>
      
      <StatRow label="RB Rush Yards" value={rb.RushYards} rank={ranks.RushYards} perGame games={games} />
      <StatRow label="RB Receptions" value={rb.Receptions} rank={ranks.Receptions} perGame games={games} />
      <StatRow label="RB Receiving Yards" value={rb.RecYards} rank={ranks.RecYards} perGame games={games} />
      <StatRow label="RB Touchdowns" value={rb.TDs} rank={ranks.TDs} />
      
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          💡 Betting Insight
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {ranks.RushYards >= 24 && ranks.RecYards >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>SMASH SPOT:</strong> Bad vs RBs in BOTH rushing and receiving. Full RB slate potential.
            </span>
          ) : ranks.RushYards >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>RUSH YARDS SPOT:</strong> Weak run D (#{ranks.RushYards}). Target rush yards props.
            </span>
          ) : ranks.RecYards >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>RECEIVING SPOT:</strong> Vulnerable to RB catches (#{ranks.RecYards}). Target RB rec props.
            </span>
          ) : ranks.Overall <= 8 ? (
            <span style={{ color: 'var(--degree-bad)' }}>
              <strong>CAUTION:</strong> Strong vs RBs. Consider fading RB overs.
            </span>
          ) : (
            <span>Neutral matchup. Look at specific metrics for edges.</span>
          )}
        </div>
      </div>
    </div>
  );
};

const TEDetailView = ({ team }) => {
  const te = team.Fantasy?.TE;
  const ranks = team.Ranks?.TE;
  const games = Number(team.G);
  
  if (!te || !ranks) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h4 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🎯 Tight End Metrics
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Defense allows...)</span>
      </h4>
      
      <StatRow label="TE Receptions" value={te.Receptions} rank={ranks.Receptions} perGame games={games} />
      <StatRow label="TE Receiving Yards" value={te.Yards} rank={ranks.Yards} perGame games={games} />
      <StatRow label="TE Touchdowns" value={te.TDs} rank={ranks.TDs} />
      
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          💡 Betting Insight
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {ranks.Overall >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>TE SMASH:</strong> This defense is exploitable by TEs (#{ranks.Overall}). Target TE props.
            </span>
          ) : ranks.Overall <= 8 ? (
            <span style={{ color: 'var(--degree-bad)' }}>
              <strong>CAUTION:</strong> Elite at defending TEs (#{ranks.Overall}). Consider fading TE overs.
            </span>
          ) : (
            <span>Neutral TE matchup. Check other factors before betting.</span>
          )}
        </div>
      </div>
    </div>
  );
};

const QBDetailView = ({ team }) => {
  const qb = team.Fantasy?.QB;
  const ranks = team.Ranks?.QB;
  const games = Number(team.G);
  
  if (!qb || !ranks) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h4 style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🎯 Quarterback Metrics
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Defense allows...)</span>
      </h4>
      
      <StatRow label="QB Pass Yards" value={qb.PassYards} rank={ranks.PassYards} perGame games={games} />
      <StatRow label="QB Pass TDs" value={qb.PassTD} rank={ranks.PassTDs} />
      <StatRow label="QB Rush Yards" value={qb.RushYards} rank={ranks.RushYards} perGame games={games} />
      
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          💡 Betting Insight
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {ranks.PassYards >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>PASS YARDS SPOT:</strong> Weak pass D (#{ranks.PassYards}). Target QB passing props.
            </span>
          ) : ranks.RushYards >= 24 ? (
            <span style={{ color: 'var(--degree-good)' }}>
              <strong>RUSHING QB SPOT:</strong> Vulnerable to QB runs (#{ranks.RushYards}). Target mobile QB props.
            </span>
          ) : ranks.Overall <= 8 ? (
            <span style={{ color: 'var(--degree-bad)' }}>
              <strong>CAUTION:</strong> Strong QB defense (#{ranks.Overall}). Consider fading QB overs.
            </span>
          ) : (
            <span>Neutral QB matchup. Look at specific metrics for edges.</span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN APP
// =============================================

function App() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [sortKey, setSortKey] = useState('Overall');
  const [gameFilter, setGameFilter] = useState(17); // 17 = full season

  // Process data based on game filter
  const processedData = useMemo(() => {
    return processWeeklyData(defenseData, gameFilter);
  }, [gameFilter]);

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      if (sortKey === 'Overall') {
        return a.Ranks.Overall - b.Ranks.Overall;
      }
      return Number(a[sortKey]) - Number(b[sortKey]);
    });
  }, [sortKey, processedData]);

  // Update selected team when data changes
  const currentSelectedTeam = useMemo(() => {
    if (!selectedTeam) return null;
    return processedData.find(t => t.Team === selectedTeam.Team) || null;
  }, [selectedTeam, processedData]);

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setSelectedPosition(null);
  };

  const handleBack = () => {
    if (selectedPosition) {
      setSelectedPosition(null);
    } else {
      setSelectedTeam(null);
    }
  };

  return (
    <div className="container">
      <header className="glass-header" style={{ padding: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>NFL Props Dashboard 2025</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Defensive rankings for betting analysis • <span style={{ color: '#ef4444' }}>Red = Tough</span> • <span style={{ color: '#22c55e' }}>Green = Easy</span>
            </div>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Data: Pro-Football-Reference 2025 Season
          </div>
        </div>
        
        {/* Game Filter Slider */}
        <div style={{ 
          background: 'rgba(0,0,0,0.2)', 
          padding: '0.75rem 1rem', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            📊 Sample Size:
          </span>
          <input
            type="range"
            min="4"
            max="17"
            value={gameFilter}
            onChange={(e) => setGameFilter(Number(e.target.value))}
            style={{ 
              flex: 1, 
              maxWidth: '300px',
              accentColor: 'var(--accent-blue)'
            }}
          />
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: 'bold',
            color: gameFilter < 17 ? 'var(--accent-blue)' : 'var(--text-primary)',
            minWidth: '100px'
          }}>
            {gameFilter >= 17 ? 'Full Season' : `Last ${gameFilter} Games`}
          </span>
          {gameFilter < 17 && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--accent-blue)',
              background: 'rgba(59, 130, 246, 0.2)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px'
            }}>
              Recent Form
            </span>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: currentSelectedTeam ? '380px 1fr' : '1fr', gap: '1.5rem', transition: 'all 0.3s ease' }}>

        {/* Team List */}
        <div className="glass-panel" style={{ padding: '1rem', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '0 0.5rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Defenses</h3>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              style={{ background: 'var(--bg-secondary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            >
              <option value="Overall">Overall Rank</option>
              <option value="PointsAllowed">Points Allowed</option>
              <option value="TotalYardsAllowed">Total Yards</option>
              <option value="PassingYards">Pass Yards</option>
              <option value="RushingYards">Rush Yards</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sortedData.map((team) => {
              const rank = team.Ranks.Overall;
              const isSelected = selectedTeam?.Team === team.Team;
              
              return (
                <div
                  key={team.Team}
                  onClick={() => handleTeamSelect(team)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 80px',
                    padding: '0.75rem',
                    background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(0,0,0,0.1)',
                    borderLeft: `4px solid ${getColorForRank(rank)}`,
                    cursor: 'pointer',
                    borderRadius: '8px',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  className="team-row"
                >
                  <RankBadge rank={rank} />
                  <span style={{ fontWeight: '600', marginLeft: '0.5rem' }}>{team.Team}</span>
                  <MatchupBar rank={rank} height={8} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {currentSelectedTeam && (
          <div className="glass-panel" style={{ padding: '1.5rem', animation: 'fadeIn 0.3s ease-in-out', overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
            
            {/* Header with Back Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {selectedPosition && (
                  <button
                    onClick={handleBack}
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      border: 'none', 
                      color: 'white', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    ← Back
                  </button>
                )}
                <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
                  {currentSelectedTeam.Team}
                  {selectedPosition && <span style={{ color: 'var(--accent-blue)' }}> › {selectedPosition}</span>}
                </h2>
                {gameFilter < 17 && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--accent-blue)',
                    background: 'rgba(59, 130, 246, 0.2)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    Last {gameFilter} Games
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSelectedTeam(null); setSelectedPosition(null); }}
                style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Overall Summary (always visible) */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '1rem', 
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Overall</div>
                <RankBadge rank={currentSelectedTeam.Ranks.Overall} size="large" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pass D</div>
                <RankBadge rank={currentSelectedTeam.Ranks.PassYards} size="large" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rush D</div>
                <RankBadge rank={currentSelectedTeam.Ranks.RushYards} size="large" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Turnovers</div>
                <RankBadge rank={currentSelectedTeam.Ranks.Turnovers} size="large" />
              </div>
            </div>

            {/* Position Selection or Detail View */}
            {!selectedPosition ? (
              <>
                <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginTop: '1rem' }}>
                  Defense vs Position — Click for Detailed Metrics
                  {gameFilter < 17 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}> (Full Season Data)</span>}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                  {['WR', 'RB', 'TE', 'QB'].map(pos => (
                    <PositionCard 
                      key={pos}
                      position={pos}
                      team={currentSelectedTeam}
                      onClick={() => setSelectedPosition(pos)}
                      isSelected={false}
                    />
                  ))}
                </div>

                {/* Quick Team Stats */}
                <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginTop: '2rem' }}>
                  Team Defense Stats
                  {gameFilter < 17 && <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 'normal' }}> (Last {gameFilter} Games)</span>}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-blue)' }}>Pass Defense</h4>
                    <StatRow label="Yards Allowed" value={currentSelectedTeam.PassingYards} rank={currentSelectedTeam.Ranks.PassYards} perGame games={Number(currentSelectedTeam.G)} />
                    <StatRow label="Pass TDs Allowed" value={currentSelectedTeam.PassingTDs} rank={currentSelectedTeam.Ranks.PassTDs} />
                    <StatRow label="Interceptions" value={currentSelectedTeam.PassingInts} rank={currentSelectedTeam.Ranks.Interceptions} />
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-blue)' }}>Rush Defense</h4>
                    <StatRow label="Yards Allowed" value={currentSelectedTeam.RushingYards} rank={currentSelectedTeam.Ranks.RushYards} perGame games={Number(currentSelectedTeam.G)} />
                    <StatRow label="Rush TDs Allowed" value={currentSelectedTeam.RushingTDs} rank={currentSelectedTeam.Ranks.RushTDs} />
                    <StatRow label="Yards Per Carry" value={currentSelectedTeam.RushingYPC} rank={currentSelectedTeam.Ranks.RushYards} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {selectedPosition === 'WR' && <WRDetailView team={currentSelectedTeam} />}
                {selectedPosition === 'RB' && <RBDetailView team={currentSelectedTeam} />}
                {selectedPosition === 'TE' && <TEDetailView team={currentSelectedTeam} />}
                {selectedPosition === 'QB' && <QBDetailView team={currentSelectedTeam} />}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .team-row:hover {
          background: rgba(59, 130, 246, 0.15) !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;
