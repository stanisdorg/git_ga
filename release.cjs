const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UI_MANAGER_PATH = path.join(__dirname, 'ui-manager.js');
const PACKAGE_JSON_PATH = path.join(__dirname, 'package.json');

function getCommitMessage() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('❌ Error: Please provide a commit message.');
        console.log('Usage: node release.cjs "Your commit message"');
        process.exit(1);
    }
    return args.join(' ');
}

function updateVersion() {
    // 1. Update ui-manager.js
    let uiManagerContent = fs.readFileSync(UI_MANAGER_PATH, 'utf8');
    const versionRegex = /export const APP_VERSION = '(\d+)';/;
    const match = uiManagerContent.match(versionRegex);

    if (!match) {
        console.error('❌ Error: Could not find APP_VERSION in ui-manager.js');
        process.exit(1);
    }

    const currentVersion = parseInt(match[1], 10);
    const newVersion = currentVersion + 1;
    
    uiManagerContent = uiManagerContent.replace(versionRegex, `export const APP_VERSION = '${newVersion}';`);
    fs.writeFileSync(UI_MANAGER_PATH, uiManagerContent);
    console.log(`✅ Updated ui-manager.js to version ${newVersion}`);

    // 2. Update package.json (optional, but good for sync)
    // We'll just increment the patch version or match the new integer version if possible
    // For now, let's just stick to the single integer version logic requested for the UI
    
    return newVersion;
}

function runBackup(version) {
    console.log('📦 Creating backup...');
    try {
        execSync(`node backup.cjs ${version}`, { stdio: 'inherit' });
    } catch (error) {
        console.error('❌ Backup failed');
        process.exit(1);
    }
}

function runGit(version, message) {
    console.log('Git operations...');
    try {
        // Stage all changes
        execSync('git add .', { stdio: 'inherit' });
        
        // Commit
        const fullMessage = `v${version}: ${message}`;
        execSync(`git commit -m "${fullMessage}"`, { stdio: 'inherit' });
        
        console.log(`✅ Git commit successful: "${fullMessage}"`);
    } catch (error) {
        console.error('❌ Git operation failed');
        process.exit(1);
    }
}

function main() {
    const message = getCommitMessage();
    
    console.log('🚀 Starting release process...');
    
    const newVersion = updateVersion();
    
    runBackup(newVersion);
    
    runGit(newVersion, message);
    
    console.log(`🎉 Release v${newVersion} completed successfully!`);
}

main();
