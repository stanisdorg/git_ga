
function getUserId() {
    try {
        const raw = localStorage.getItem('qaSessionUser') || '';
        if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.id || u.email || u.username)) return u.id || u.email || u.username;
        }
    } catch {}
    let id = localStorage.getItem('deviceId');
    if (!id) {
        id = 'device_' + Math.random().toString(36).slice(2);
        localStorage.setItem('deviceId', id);
    }
    return id;
}

export async function generateTestStats() {
    const client = window.__supabaseClient;
    if (!client) {
        alert('Supabase клиент не инициализирован. Убедитесь, что вы подключены к интернету и настройки Supabase корректны.');
        return;
    }

    const userId = getUserId();
    console.log('Generating Supabase stats for user:', userId);

    const dailyStatsPayload = [];
    const today = new Date();
    const monthsBack = 6;
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - monthsBack);
    
    let currentStreak = 0;
    
    // Iterate from start date to today
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Random chance to skip a day (to break streaks)
        if (Math.random() > 0.3) { // 70% chance to have activity
            // Generate random XP (10-100)
            const xp = Math.floor(Math.random() * 90) + 10;
            currentStreak++;
            
            dailyStatsPayload.push({
                user_id: userId,
                date: dateStr,
                xp: xp,
                bonus: 0,
                day_bonus: 0,
                streak: currentStreak
            });
        } else {
            currentStreak = 0;
        }
    }

    if (dailyStatsPayload.length === 0) {
        alert('Нет данных для отправки.');
        return;
    }

    try {
        console.log(`Sending ${dailyStatsPayload.length} records to Supabase...`);
        // Supabase upsert
        const { error } = await client.from('daily_stats').upsert(dailyStatsPayload, { onConflict: 'user_id,date' });
        
        if (error) {
            console.error('Supabase error:', error);
            alert('Ошибка при отправке данных в Supabase: ' + error.message);
        } else {
            console.log('Successfully uploaded test stats to Supabase');
            alert('Тестовые данные успешно загружены в Supabase! Обновите страницу для синхронизации.');
            location.reload();
        }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('Произошла ошибка: ' + e.message);
    }
}
