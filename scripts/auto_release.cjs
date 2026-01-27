const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Paths
const projectRoot = path.join(__dirname, '..');
const uiManagerPath = path.join(projectRoot, 'ui-manager.js');
const indexHtmlPath = path.join(projectRoot, 'index.html');

console.log('--- AUTO-RELEASE SCRIPT STARTED ---');

try {
    // 0. Run tests
    console.log('Running tests...');
    execSync('npm test', { cwd: projectRoot, stdio: 'inherit' });
    console.log('Tests passed!');

    // 1. Read current version from ui-manager.js
    let uiManagerContent = fs.readFileSync(uiManagerPath, 'utf8');
    const versionMatch = uiManagerContent.match(/export const APP_VERSION = '(\d+(\.\d+)?)';/);

    if (!versionMatch) {
        throw new Error('Could not find APP_VERSION in ui-manager.js');
    }

    const currentVersion = versionMatch[1];
    let newVersion;

    if (currentVersion.includes('.')) {
        const parts = currentVersion.split('.');
        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);
        newVersion = `${major}.${minor + 1}`;
    } else {
        // Fallback for integer versions (should verify this logic)
        newVersion = `${parseInt(currentVersion, 10)}.1`;
    }
    
    console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

    // 2. Update ui-manager.js
    // Update the constant
    uiManagerContent = uiManagerContent.replace(
        `export const APP_VERSION = '${currentVersion}';`,
        `export const APP_VERSION = '${newVersion}';`
    );
    // Update all query parameters (cache busters)
    // Supports v=1.0, v=1.1, v=40, etc.
    uiManagerContent = uiManagerContent.replace(/v=[\d\.]+/g, `v=${newVersion}`);
    fs.writeFileSync(uiManagerPath, uiManagerContent);
    console.log('Updated ui-manager.js');

    // 3. Update index.html
    let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    // Update all query parameters (cache busters)
    indexHtmlContent = indexHtmlContent.replace(/v=[\d\.]+/g, `v=${newVersion}`);
    fs.writeFileSync(indexHtmlPath, indexHtmlContent);
    console.log('Updated index.html');

    // 4. Git operations
    console.log('Executing git add .');
    execSync('git add .', { cwd: projectRoot, stdio: 'inherit' });

    // Get commit message from args or use default
    // Note: args start from index 2 in Node.js
    const userMsg = process.argv[2];
    const commitMsg = userMsg ? userMsg : `Release v${newVersion}: Auto-update`;
    
    console.log(`Executing git commit -m "${commitMsg}"`);
    execSync(`git commit -m "${commitMsg}"`, { cwd: projectRoot, stdio: 'inherit' });

    console.log('Executing git push');
    execSync('git push', { cwd: projectRoot, stdio: 'inherit' });

    console.log('--- SUCCESS: Version bumped and pushed! ---');

} catch (error) {
    console.error('!!! ERROR !!!');
    console.error(error.message);
    process.exit(1);
}
