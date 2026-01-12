
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const BASE_URL = 'https://www.pro-football-reference.com/years/2025';

const TEAMS_MAP = {};
// Will store: "Seattle Seahawks": { ...stats }

async function fetchPage(url) {
    console.log(`Fetching ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        return data;
    } catch (err) {
        console.error(`Error fetching ${url}:`, err.message);
        return null;
    }
}

function parseTable($html, selector, callback) {
    // PFR sometimes comments out tables. We need to find the comment containing the table id if the selector isn't found.
    // However, cheerio might find it if we preprocess.
    // Simple approach: load body, but if table is inside comment, regex replace comments.

    // Instead of regex replacing everything (slow/risky), let's look for known commented tables if selector yields nothing.

    let $ = cheerio.load($html);
    let table = $(selector);

    if (table.length === 0) {
        // Try to find it in comments
        const comments = $html.match(/<!--[\s\S]*?-->/g) || [];
        for (const comment of comments) {
            if (comment.includes(`id="${selector.replace('#', '')}"`)) {
                const uncommented = comment.replace('<!--', '').replace('-->', '');
                $ = cheerio.load(uncommented);
                table = $(selector);
                break;
            }
        }
    }

    if (table.length === 0) {
        console.warn(`Table ${selector} not found.`);
        return;
    }

    console.log(`Found table ${selector}. Parsing rows...`);
    const rows = table.find('tbody tr').not('.thead');

    rows.each((i, el) => {
        const row = $(el);
        // Helper to get text by data-stat
        const getStat = (stat) => {
            const cell = row.find(`[data-stat="${stat}"]`);
            // Remove asterisks/pluses from names
            return cell.text().trim().replace(/[*+]/g, '');
        };

        callback(getStat, row);
    });
}

async function scrape() {
    // 1. Team Defense (General)
    const oppHtml = await fetchPage(`${BASE_URL}/opp.htm`);
    if (oppHtml) {
        parseTable(oppHtml, '#team_stats', (getStat) => {
            const team = getStat('team');
            if (!team || team === 'Avg Team' || team === 'League Total' || team === "") return;

            if (!TEAMS_MAP[team]) TEAMS_MAP[team] = { Team: team };

            Object.assign(TEAMS_MAP[team], {
                G: getStat('g'),
                PointsAllowed: getStat('points'),
                TotalYardsAllowed: getStat('total_yards'),
                YardsPerPlay: getStat('yds_per_play_offense'),
                Turnovers: getStat('turnovers'),
                PassingYards: getStat('pass_yds'),
                PassingTDs: getStat('pass_td'),
                PassingInts: getStat('pass_int'),
                RushingYards: getStat('rush_yds'),
                RushingTDs: getStat('rush_td'),
                RushingYPC: getStat('rush_yds_per_att'),
                ScoringPct: getStat('score_pct'),
                FirstDowns: getStat('first_down')
            });
        });
    }

    // 2. Fantasy Points
    const positions = ['QB', 'RB', 'WR', 'TE'];

    for (const pos of positions) {
        const url = `${BASE_URL}/fantasy-points-against-${pos}.htm`;
        // Delay to be nice
        await new Promise(r => setTimeout(r, 1000));

        const html = await fetchPage(url);
        if (!html) continue;

        parseTable(html, '#fantasy_def', (getStat) => {
            const team = getStat('team');
            if (!team || !TEAMS_MAP[team]) return; // Match existing team

            if (!TEAMS_MAP[team].Fantasy) TEAMS_MAP[team].Fantasy = {};

            TEAMS_MAP[team].Fantasy[pos] = {
                PointsGame: getStat('fantasy_points_per_game'),
                Rank: getStat('ranker'),
                Yards: getStat('rec_yds') || getStat('pass_yds') || getStat('rush_yds'),
                TDs: getStat('rec_td') || getStat('pass_td') || getStat('rush_td'),
                Receptions: getStat('rec') || '0',
                Targets: getStat('targets') || '0'
            };

            if (pos === 'QB') {
                TEAMS_MAP[team].Fantasy[pos].PassYards = getStat('pass_yds');
                TEAMS_MAP[team].Fantasy[pos].PassTD = getStat('pass_td');
                TEAMS_MAP[team].Fantasy[pos].RushYards = getStat('rush_yds');
                TEAMS_MAP[team].Fantasy[pos].Completions = getStat('pass_cmp');
                TEAMS_MAP[team].Fantasy[pos].Attempts = getStat('pass_att');
            } else if (pos === 'RB') {
                TEAMS_MAP[team].Fantasy[pos].RushYards = getStat('rush_yds');
                TEAMS_MAP[team].Fantasy[pos].RecYards = getStat('rec_yds');
                TEAMS_MAP[team].Fantasy[pos].Receptions = getStat('rec');
            } else if (pos === 'WR') {
                TEAMS_MAP[team].Fantasy[pos].Receptions = getStat('rec');
                TEAMS_MAP[team].Fantasy[pos].Targets = getStat('targets');
            } else if (pos === 'TE') {
                TEAMS_MAP[team].Fantasy[pos].Receptions = getStat('rec');
                TEAMS_MAP[team].Fantasy[pos].Targets = getStat('targets');
            }
        });
    }

    // Convert map to list
    const defenseStats = Object.values(TEAMS_MAP);

    fs.mkdirSync('src/data', { recursive: true });
    fs.writeFileSync('src/data/defense_stats.json', JSON.stringify(defenseStats, null, 2));
    console.log("Saved src/data/defense_stats.json with", defenseStats.length, "teams.");
}

scrape();
