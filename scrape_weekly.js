
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

// Team abbreviations for PFR URLs
const TEAM_ABBREVS = {
  'Arizona Cardinals': 'crd',
  'Atlanta Falcons': 'atl',
  'Baltimore Ravens': 'rav',
  'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car',
  'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin',
  'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den',
  'Detroit Lions': 'det',
  'Green Bay Packers': 'gnb',
  'Houston Texans': 'htx',
  'Indianapolis Colts': 'clt',
  'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kan',
  'Las Vegas Raiders': 'rai',
  'Los Angeles Chargers': 'sdg',
  'Los Angeles Rams': 'ram',
  'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min',
  'New England Patriots': 'nwe',
  'New Orleans Saints': 'nor',
  'New York Giants': 'nyg',
  'New York Jets': 'nyj',
  'Philadelphia Eagles': 'phi',
  'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sfo',
  'Seattle Seahawks': 'sea',
  'Tampa Bay Buccaneers': 'tam',
  'Tennessee Titans': 'oti',
  'Washington Commanders': 'was'
};

async function fetchPage(url) {
  console.log(`Fetching ${url}...`);
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    return data;
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    return null;
  }
}

async function scrapeTeamGameLogs() {
  const weeklyData = {};
  
  for (const [teamName, abbrev] of Object.entries(TEAM_ABBREVS)) {
    console.log(`\nScraping ${teamName}...`);
    weeklyData[teamName] = { games: [] };
    
    // Fetch team main page which has game schedule/results
    const url = `https://www.pro-football-reference.com/teams/${abbrev}/2025.htm`;
    
    await new Promise(r => setTimeout(r, 1500)); // Rate limit
    
    const html = await fetchPage(url);
    if (!html) continue;
    
    let $ = cheerio.load(html);
    
    // The games table might be in a comment, so we need to uncomment it
    const comments = html.match(/<!--[\s\S]*?-->/g) || [];
    for (const comment of comments) {
      if (comment.includes('id="games"')) {
        const uncommented = comment.replace('<!--', '').replace('-->', '');
        $ = cheerio.load(uncommented);
        break;
      }
    }
    
    // Find the games schedule table
    const gamesTable = $('#games');
    
    if (gamesTable.length === 0) {
      console.warn(`No games table found for ${teamName}`);
      continue;
    }
    
    gamesTable.find('tbody tr').each((i, el) => {
      const row = $(el);
      if (row.hasClass('thead') || row.hasClass('divider')) return;
      
      const getStat = (stat) => {
        const cell = row.find(`[data-stat="${stat}"]`);
        return cell.text().trim();
      };
      
      const week = getStat('week_num');
      if (!week || week === '' || week === 'Week') return;
      
      // For DEFENSIVE stats, we need the "_def" columns which show what the opponent did
      // pts_def = Points scored by opponent (points allowed)
      // yards_def = Yards gained by opponent (yards allowed)
      // pass_yds_def = Pass yards by opponent
      // rush_yds_def = Rush yards by opponent
      // to_def = Turnovers forced by our defense
      const gameData = {
        week: parseInt(week),
        opponent: getStat('opp'),
        result: getStat('game_outcome'),
        pointsAllowed: parseInt(getStat('pts_def')) || 0,
        pointsScored: parseInt(getStat('pts_off')) || 0,
        totalYardsAllowed: parseInt(getStat('yards_def')) || 0,
        totalYardsGained: parseInt(getStat('yards_off')) || 0,
        passYardsAllowed: parseInt(getStat('pass_yds_def')) || 0,
        rushYardsAllowed: parseInt(getStat('rush_yds_def')) || 0,
        turnoversForced: parseInt(getStat('to_def')) || 0
      };
      
      // Only add if it looks like a real game week
      if (gameData.week > 0 && gameData.week <= 18) {
        weeklyData[teamName].games.push(gameData);
      }
    });
    
    console.log(`  Found ${weeklyData[teamName].games.length} games for ${teamName}`);
  }
  
  // Save the weekly data
  fs.mkdirSync('src/data', { recursive: true });
  fs.writeFileSync('src/data/weekly_defense.json', JSON.stringify(weeklyData, null, 2));
  console.log('\nSaved src/data/weekly_defense.json');
  
  return weeklyData;
}

scrapeTeamGameLogs();
