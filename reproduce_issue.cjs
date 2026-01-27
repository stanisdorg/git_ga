
const fs = require('fs');
const path = require('path');

// 1. Read the file
const filePath = path.join(__dirname, 'data', 'questions_no_anki.json');
console.log(`Reading file: ${filePath}`);

try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Normalize structure if needed (based on load-json-data.js)
    let questions = [];
    if (data.questions && Array.isArray(data.questions)) {
        questions = data.questions;
    } else if (Array.isArray(data)) {
        questions = data;
    } else {
        console.error('Unknown data structure');
        process.exit(1);
    }
    
    console.log(`Loaded ${questions.length} questions.`);

    // 2. Simulate the search logic
    const query = 'вп';
    const lowerQuery = query.toLowerCase();
    
    console.log(`Searching for: "${query}"`);

    const filteredData = questions.filter(item => {
        const inQuestion = item.question && item.question.toLowerCase().includes(lowerQuery);
        const inAnswer = item.answer && item.answer.toLowerCase().includes(lowerQuery);
        const inCategory = item.category && item.category.toLowerCase().includes(lowerQuery);
        const inSubcategory = item.subcategory && item.subcategory.toLowerCase().includes(lowerQuery);
        
        if (inAnswer) {
            // console.log(`Found match in answer: ID ${item.id}`);
        }
        
        return inQuestion || inAnswer || inCategory || inSubcategory;
    });

    console.log(`Found ${filteredData.length} matches.`);
    
    if (filteredData.length > 0) {
        console.log('First 3 matches:');
        filteredData.slice(0, 3).forEach(item => {
            console.log(`- ID: ${item.id}`);
            console.log(`  Question: ${item.question}`);
            // console.log(`  Answer snippet: ${item.answer.substring(0, 50)}...`);
        });
    } else {
        console.error('FAIL: No matches found in Node.js environment!');
    }

} catch (err) {
    console.error('Error:', err);
}
