
import fs from 'fs';

async function fetchData() {
    try {
        console.log("Fetching Teams...");
        const teamsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32');
        const teamsData = await teamsResponse.json();

        const teams = teamsData.sports[0].leagues[0].teams;
        console.log(`Found ${teams.length} teams.`);

        const allStats = [];

        for (const t of teams) {
            const team = t.team;
            console.log(`Fetching stats for ${team.displayName} (ID: ${team.id})...`);

            const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/statistics`;
            const statsResponse = await fetch(statsUrl);
            const statsData = await statsResponse.json();

            // Structure checks
            if (statsData && statsData.results) {
                allStats.push({
                    team: team,
                    stats: statsData.results
                });
            } else {
                console.warn(`No stats found for ${team.displayName}`);
            }
        }

        if (!fs.existsSync('src/data')) {
            fs.mkdirSync('src/data');
        }

        fs.writeFileSync('src/data/espn_stats.json', JSON.stringify(allStats, null, 2));
        console.log("Saved src/data/espn_stats.json");

    } catch (error) {
        console.error("Error:", error);
    }
}

fetchData();
