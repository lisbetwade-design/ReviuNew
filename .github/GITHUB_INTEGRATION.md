# GitHub Integration Configuration

This document describes the required GitHub scopes and permissions for the Reviu application.

## Required Scopes

The following scopes must be configured for the GitHub integration to function properly:

### 1. current_user:read
- **Purpose**: Read the current user's name, email, and profile image
- **Usage**: Display user information in the application UI and associate actions with the correct user
- **Required for**: User profile display, authentication, and user identification

### 2. file_comments:read
- **Purpose**: Read comments in accessible files
- **Usage**: Retrieve and display file-level comments from GitHub repositories
- **Required for**: Comment synchronization and review features

### 3. projects:read
- **Purpose**: Read team project structure, including private projects
- **Usage**: Access and display GitHub Projects data within the Reviu interface
- **Required for**: Project management integration and board synchronization

### 4. Webhooks Scopes

#### webhooks:read
- **Purpose**: Read and list webhooks
- **Usage**: Verify webhook configuration and display webhook status
- **Required for**: Webhook management and monitoring

#### webhooks:write
- **Purpose**: Create, modify, and delete webhooks
- **Usage**: Automatically configure webhooks for repository events
- **Required for**: Automated webhook setup and maintenance

## Configuration Options

### Option 1: GitHub App (Recommended)

Create a GitHub App with the following permissions:

**Repository Permissions:**
- Contents: Read
- Issues: Read
- Pull Requests: Read
- Administration: Write (provides webhook management)
- Metadata: Read

**Organization Permissions:**
- Members: Read
- Administration: Write (provides webhook management and access to organization projects)

**User Permissions:**
- Email addresses: Read

**Note:** The `organization_administration: write` permission provides access to both organization webhooks and organization projects, fulfilling the `projects:read` and `webhooks:read/write` requirements for organization-level resources.

**Subscribe to events:**
- Issues
- Issue comments
- Pull requests
- Pull request reviews
- Pull request review comments

### Option 2: Personal Access Token

Create a Personal Access Token with the following scopes:
- `repo` (Full control of private repositories)
- `read:user` (Read user profile data)
- `read:org` (Read org and team membership, read org projects)
- `admin:repo_hook` (Full control of repository hooks)

### Option 3: OAuth App

Create an OAuth App with the following scopes:
- `repo`
- `read:user`
- `read:org`
- `admin:repo_hook`
- `read:project`

## Setup Instructions

### For GitHub App:

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Use the manifest file at `.github/github-app-manifest.json` or manually configure:
   - Set the callback URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/github-oauth-callback`
   - Set the webhook URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/github-webhook`
   - Configure permissions as listed above
4. Generate a private key for the app
5. Install the app on the target repository or organization

### For Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select the scopes listed above
4. Generate the token and save it securely

### For OAuth App:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set the Authorization callback URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/github-oauth-callback`
4. Register the application
5. Note the Client ID and generate a Client Secret

## Required Secrets

Add the following secrets to your Supabase project:

- `GITHUB_CLIENT_ID` - Your GitHub OAuth app or GitHub App client ID
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth app or GitHub App client secret
- `GITHUB_APP_ID` - (If using GitHub App) Your GitHub App ID
- `GITHUB_PRIVATE_KEY` - (If using GitHub App) Your GitHub App private key
- `GITHUB_WEBHOOK_SECRET` - Secret for validating webhook payloads

## Frontend Environment Variables

Add to `.env`:
- `VITE_GITHUB_CLIENT_ID` - Same as GITHUB_CLIENT_ID above

## Webhook Events

The application should subscribe to the following webhook events:
- `issues` - Issue opened, edited, closed, etc.
- `issue_comment` - Comments added to issues
- `pull_request` - Pull request opened, edited, closed, merged, etc.
- `pull_request_review` - Reviews submitted on pull requests
- `pull_request_review_comment` - Comments on pull request diffs

## Security Considerations

1. **Store secrets securely**: Never commit secrets to version control
2. **Validate webhooks**: Always verify webhook signatures using the webhook secret
3. **Minimize permissions**: Only request the minimum scopes necessary for functionality
4. **Rotate tokens**: Regularly rotate access tokens and secrets
5. **Monitor usage**: Keep track of API rate limits and usage

## Testing

To test the GitHub integration:

1. Configure the required secrets in Supabase
2. Install the GitHub App or authorize the OAuth app
3. Trigger test events (create an issue, open a pull request)
4. Verify that webhooks are received and processed correctly
5. Confirm that user data and project information are correctly displayed

## Troubleshooting

### Common Issues:

**Missing Permissions Error:**
- Verify that all required scopes are enabled
- Re-authorize the application if scopes were added after initial authorization

**Webhook Not Received:**
- Check webhook configuration URL
- Verify webhook secret is correctly configured
- Check Supabase function logs for errors

**API Rate Limit Exceeded:**
- Consider implementing caching
- Use conditional requests where possible
- Monitor rate limit headers in responses

For additional support, refer to the [GitHub API Documentation](https://docs.github.com/en/rest).
