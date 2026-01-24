
const url = "https://zaytawcqkmpbrzvnrlnv.supabase.co";
const key = "sb_publishable_DqatNMk7ZWZVUMzPFRdvsQ_2ZUCossu";

async function checkTable(tableName) {
    try {
        const response = await fetch(`${url}/rest/v1/${tableName}?select=*&limit=5`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Table '${tableName}' exists. Rows found: ${data.length}`);
            if (data.length > 0) {
                console.log('Sample data:', JSON.stringify(data[0], null, 2));
            }
        } else {
            console.log(`❌ Table '${tableName}' error: ${response.status} ${response.statusText}`);
            // Often 404 means table doesn't exist or 401 means permission denied
        }
    } catch (e) {
        console.error(`Error checking ${tableName}:`, e.message);
    }
}

async function check() {
    console.log('Checking Supabase tables...');
    await checkTable('users');
    await checkTable('daily_stats');
    await checkTable('card_progress');
    // Also try to check standard auth users? 
    // Usually not accessible via REST API with anon key directly from /auth/v1/user
    // But we can check if the 'users' table (public) has data.
}

check();
