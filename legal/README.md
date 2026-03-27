# ByteCards Legal Documents

This folder contains legal documents for ByteCards application.

## Files

- `privacy.html` - Privacy Policy (HTML version for web)
- `privacy.md` - Privacy Policy (Markdown version)
- `terms.html` - Terms of Service (HTML version for web)
- `terms.md` - Terms of Service (Markdown version)

## How to Publish on GitHub Pages

### Option 1: Create a new repository (Recommended)

1. **Create a new repository:**
   - Name: `bytecards-legal`
   - Visibility: Public
   - Initialize with README: No

2. **Upload files:**
   ```bash
   cd legal
   git init
   git remote add origin https://github.com/stanisdorg/bytecards-legal.git
   git add .
   git commit -m "Initial commit: Privacy Policy and Terms of Service"
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to repository Settings
   - Scroll to "Pages"
   - Source: Deploy from branch
   - Branch: main
   - Folder: / (root)
   - Click Save

4. **Get your URLs:**
   - Privacy Policy: `https://stanisdorg.github.io/bytecards-legal/privacy.html`
   - Terms of Service: `https://stanisdorg.github.io/bytecards-legal/terms.html`

### Option 2: Use existing repository

1. **Create a gh-pages branch:**
   ```bash
   cd legal
   git init
   git remote add origin https://github.com/stanisdorg/git_ga.git
   git add .
   git commit -m "Add legal documents"
   git subtree push --prefix legal origin gh-pages
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: gh-pages
   - Folder: /
   - Click Save

3. **Get your URLs:**
   - Privacy Policy: `https://stanisdorg.github.io/git_ga/privacy.html`
   - Terms of Service: `https://stanisdorg.github.io/git_ga/terms.html`

## Add URLs to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **ByteCards**
3. Go to **APIs & Services** → **OAuth consent screen**
4. Fill in:
   - **Privacy Policy URL:** `https://stanisdorg.github.io/bytecards-legal/privacy.html`
   - **Terms of Service URL:** `https://stanisdorg.github.io/bytecards-legal/terms.html`
5. Click **Save**

## Next Steps

1. ✅ Publish documents on GitHub Pages
2. ✅ Add URLs to Google Cloud Console
3. ✅ Submit app for verification (optional, when you approach 100 users)

## Notes

- These documents were generated with AI assistance
- Consider having them reviewed by a legal professional
- Update the email address if needed (currently: stasdoroganov@gmail.com)
