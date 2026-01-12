
import axios from 'axios';
import * as cheerio from 'cheerio';

async function inspect() {
    const { data } = await axios.get('https://www.pro-football-reference.com/years/2025/opp.htm', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    const row = $('#team_stats tbody tr').first();
    row.find('td, th').each((i, el) => {
        console.log($(el).attr('data-stat'), $(el).text());
        // Also print text to verify content
    });
}
inspect();
