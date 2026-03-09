// Browser console test - copy paste this to browser console
// F12 -> Console -> Paste -> Enter

console.log('=== BROWSER DIAGNOSTIC TEST ===\n');

// Test 1: Check if uniqueQaData is loaded
console.log('Test 1: Checking uniqueQaData...');
console.log('   uniqueQaData:', typeof uniqueQaData !== 'undefined' ? uniqueQaData.length : 'NOT DEFINED');

// Test 2: Check if initTabsNavigation exists
console.log('\nTest 2: Checking initTabsNavigation...');
console.log('   initTabsNavigation:', typeof initTabsNavigation !== 'undefined' ? 'EXISTS' : 'NOT DEFINED');

// Test 3: Check DOM elements
console.log('\nTest 3: Checking DOM elements...');
console.log('   .container:', document.querySelector('.container') ? 'EXISTS' : 'MISSING');
console.log('   .search-container:', document.querySelector('.search-container') ? 'EXISTS' : 'MISSING');
console.log('   #search-input:', document.querySelector('#search-input') ? 'EXISTS' : 'MISSING');
console.log('   #results-list:', document.querySelector('#results-list') ? 'EXISTS' : 'MISSING');

// Test 4: Check loaded scripts
console.log('\nTest 4: Checking loaded scripts...');
const scripts = document.querySelectorAll('script[src]');
scripts.forEach(s => {
    console.log(`   ${s.src}: ${s.src.includes('v=') ? 'VERSIONED' : 'NO VERSION'}`);
});

// Test 5: Check for errors
console.log('\nTest 5: Recent errors:');
console.log('   Check Console tab for red errors');

console.log('\n=== DIAGNOSTIC COMPLETE ===');
console.log('\n📋 NEXT: Copy this output and send to developer');
