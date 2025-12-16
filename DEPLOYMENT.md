# Deployment Guide

This guide explains how to deploy the XRPL Transaction Test Generator to GitHub Pages.

## Prerequisites

- A GitHub account
- Git installed on your local machine
- This repository cloned or forked

## Automatic Deployment with GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages on every push to the `main` branch.

### Step-by-Step Setup

#### 1. Push Your Code to GitHub

If you haven't already, initialize and push your repository:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: XRPL Transaction Test Generator"

# Add remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/xrpl-quark.git

# Push to main branch
git push -u origin main
```

#### 2. Configure GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top menu)
3. In the left sidebar, click **Pages** (under "Code and automation")
4. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions** (not "Deploy from a branch")
5. Save the settings

#### 3. Verify Deployment

1. Go to the **Actions** tab in your repository
2. You should see a workflow run called "Deploy to GitHub Pages"
3. Wait for it to complete (usually takes 1-2 minutes)
4. Once complete, your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/xrpl-quark/
   ```

### Manual Deployment Trigger

You can manually trigger a deployment:

1. Go to the **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow** button
4. Select the `main` branch
5. Click **Run workflow**

## Workflow Details

The GitHub Actions workflow (`.github/workflows/deploy.yml`) performs these steps:

1. **Checkout**: Clones the repository code
2. **Setup Pages**: Configures GitHub Pages settings
3. **Upload artifact**: Packages all files for deployment
4. **Deploy**: Publishes to GitHub Pages

### Workflow Triggers

- **Automatic**: Triggers on every push to `main` branch
- **Manual**: Can be triggered via `workflow_dispatch` in the Actions tab

### Permissions

The workflow requires these permissions (already configured):
- `contents: read` - Read repository contents
- `pages: write` - Write to GitHub Pages
- `id-token: write` - Required for deployment

## Troubleshooting

### Deployment Failed

If deployment fails:

1. Check the Actions tab for error messages
2. Ensure GitHub Pages is enabled in repository settings
3. Verify the source is set to "GitHub Actions"
4. Check that the workflow file is in `.github/workflows/deploy.yml`

### 404 Error After Deployment

If you get a 404 error:

1. Wait a few minutes - deployment can take time to propagate
2. Check the Actions tab to ensure deployment completed successfully
3. Verify the URL format: `https://USERNAME.github.io/REPO-NAME/`
4. Clear your browser cache

### Changes Not Appearing

If your changes don't appear after pushing:

1. Check the Actions tab to see if the workflow ran
2. Wait for the workflow to complete
3. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
4. Check that you pushed to the `main` branch

## Custom Domain (Optional)

To use a custom domain:

1. Go to repository **Settings** → **Pages**
2. Under "Custom domain", enter your domain
3. Add a CNAME record in your DNS settings pointing to:
   ```
   YOUR_USERNAME.github.io
   ```
4. Wait for DNS propagation (can take up to 24 hours)

## Local Testing

Before deploying, test locally:

```bash
# Start a local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

## Updating the Site

To update the deployed site:

```bash
# Make your changes
# ...

# Commit and push
git add .
git commit -m "Description of changes"
git push origin main

# GitHub Actions will automatically deploy
```

## Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Configuring a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

