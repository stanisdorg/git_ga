
const url = "https://zaytawcqkmpbrzvnrlnv.supabase.co";
const key = "sb_publishable_DqatNMk7ZWZVUMzPFRdvsQ_2ZUCossu";

async function upsertUser(username, password, role) {
    try {
        // First try to select to see if exists (since we don't know the primary key for sure, probably id or username)
        // But upsert is better if we have a unique constraint on username.
        // Let's try simple insert first, if it fails, we might need to know the structure better.
        // Actually, let's try to just insert.
        
        const userData = {
            username: username,
            password: password,
            role: role
        };

        const response = await fetch(`${url}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation' // To get back the created row
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ User '${username}' created/updated successfully.`);
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`❌ Failed to create user '${username}': ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log('Response:', text);
        }
    } catch (e) {
        console.error(`Error creating ${username}:`, e.message);
    }
}

async function run() {
    console.log('Creating users...');
    await upsertUser('stas', 'admin', 'user');
    await upsertUser('admin', 'admin', 'admin');
}

run();
