const https = require('https');

const url = 'https://bcwxgrgbliwwgvfhzwqu.supabase.co/rest/v1';
const key = 'sb_publishable_rlF5B-dsogw9D4ZkoTfg_g_wfeRsYWN';

function get(table) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        };
        https.get(`${url}/${table}`, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function check() {
    try {
        const bets = await get('bets');
        console.log('--- Bets Data in Database ---');
        bets.forEach(b => {
            console.log(`ID: ${b.id}, Match: ${b.match_name}, Status: ${b.status}, Amount: ${b.amount}`);
            console.log('Bettors:', JSON.stringify(b.bettors, null, 2));
        });

        const members = await get('members');
        console.log('--- Members Data in Database ---');
        console.log(JSON.stringify(members, null, 2));
    } catch (e) {
        console.error('Execution error:', e);
    }
}

check();
