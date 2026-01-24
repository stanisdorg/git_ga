
const url = "https://zaytawcqkmpbrzvnrlnv.supabase.co";
const key = "sb_publishable_DqatNMk7ZWZVUMzPFRdvsQ_2ZUCossu";

async function checkProgress() {
    try {
        // We are looking for progress for user 'admin'
        // Since we created 'admin' user with an ID, we need to check if progress is saved with username or ID.
        // Let's first fetch the admin user ID again to be sure.
        let userId = 'admin';
        
        const userRes = await fetch(`${url}/rest/v1/users?username=eq.admin&select=id`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        
        if (userRes.ok) {
            const users = await userRes.json();
            if (users.length > 0) {
                console.log('Admin User ID found:', users[0].id);
                // We should check both username 'admin' and the UUID just in case
            }
        }

        console.log(`Checking progress for user 'admin'...`);
        
        // Check card_progress table
        // We'll check for user_id = 'admin' AND user_id = <UUID> if we found it.
        // But for simplicity let's just list latest modified rows in card_progress
        
        const response = await fetch(`${url}/rest/v1/card_progress?select=*&order=last_reviewed.desc&limit=5`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Latest 5 progress entries:`);
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`Error fetching progress: ${response.status}`);
        }
        
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}

checkProgress();
