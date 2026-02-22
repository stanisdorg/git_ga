// MSK Timezone Migration Script
// Запустите в консоли браузера на https://qa.crispcode.ru

(function() {
    console.log('=== MSK MIGRATION START ===');
    console.log('Current UTC:', new Date().toISOString());
    console.log('Current MSK:', new Date().toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'}));
    
    // dailyPoints
    const dailyPoints = JSON.parse(localStorage.getItem('dailyPoints') || '{}');
    if (dailyPoints['2026-02-22'] !== undefined && dailyPoints['2026-02-23'] === undefined) {
        console.log('Migrating dailyPoints: 2026-02-22 -> 2026-02-23');
        dailyPoints['2026-02-23'] = dailyPoints['2026-02-22'];
        delete dailyPoints['2026-02-22'];
        localStorage.setItem('dailyPoints', JSON.stringify(dailyPoints));
    }
    console.log('dailyPoints:', dailyPoints);
    
    // dailyBonusPoints
    const bonus = JSON.parse(localStorage.getItem('dailyBonusPoints') || '{}');
    if (bonus['2026-02-22'] !== undefined && bonus['2026-02-23'] === undefined) {
        console.log('Migrating dailyBonusPoints: 2026-02-22 -> 2026-02-23');
        bonus['2026-02-23'] = bonus['2026-02-22'];
        delete bonus['2026-02-22'];
        localStorage.setItem('dailyBonusPoints', JSON.stringify(bonus));
    }
    console.log('dailyBonusPoints:', bonus);
    
    // dailyDayBonusPoints
    const dayBonus = JSON.parse(localStorage.getItem('dailyDayBonusPoints') || '{}');
    if (dayBonus['2026-02-22'] !== undefined && dayBonus['2026-02-23'] === undefined) {
        console.log('Migrating dailyDayBonusPoints: 2026-02-22 -> 2026-02-23');
        dayBonus['2026-02-23'] = dayBonus['2026-02-22'];
        delete dayBonus['2026-02-22'];
        localStorage.setItem('dailyDayBonusPoints', JSON.stringify(dayBonus));
    }
    console.log('dailyDayBonusPoints:', dayBonus);
    
    // studyStreak
    const streak = JSON.parse(localStorage.getItem('studyStreak') || '{}');
    if (streak.lastDate === '2026-02-22') {
        console.log('Migrating studyStreak: 2026-02-22 -> 2026-02-23');
        streak.lastDate = '2026-02-23';
        localStorage.setItem('studyStreak', JSON.stringify(streak));
    }
    console.log('studyStreak:', streak);
    
    // srsProgress
    const progress = JSON.parse(localStorage.getItem('srsProgress') || '{}');
    let progressChanged = false;
    Object.values(progress).forEach(p => {
        if (p.lastReviewed === '2026-02-22') {
            p.lastReviewed = '2026-02-23';
            progressChanged = true;
        }
    });
    if (progressChanged) {
        console.log('Migrating srsProgress: 2026-02-22 -> 2026-02-23');
        localStorage.setItem('srsProgress', JSON.stringify(progress));
    }
    
    console.log('=== MSK MIGRATION COMPLETE ===');
    console.log('Reload page to see changes');
})();
