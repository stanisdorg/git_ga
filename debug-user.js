// Debug script - выполните в консоли после загрузки страницы

console.log('=== DEBUG USER SYSTEM ===');
console.log('1. window.UserSystem exists:', !!window.UserSystem);

if (window.UserSystem) {
    const user = window.UserSystem.getCurrentUser();
    console.log('2. Current user:', user);
    console.log('3. User prefix:', user ? `user_${user.username}_` : '(empty)');
    
    const userCards = window.UserSystem.getUserCards();
    console.log('4. User cards count:', userCards ? userCards.length : 0);
}

console.log('5. LocalStorage keys:');
const keys = Object.keys(localStorage);
keys.forEach(k => {
    if (k.includes('qaAdmin') || k.includes('qaNew') || k.includes('qaDeleted') || k.includes('user_')) {
        const val = localStorage.getItem(k);
        console.log(`   ${k}: ${val ? val.substring(0, 100) + '...' : 'EMPTY'}`);
    }
});

console.log('6. qaSessionUser:', localStorage.getItem('qaSessionUser'));
