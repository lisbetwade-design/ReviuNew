# GitHub Repository Scopes Configuration

This document provides the exact scope configuration required for the `lisbetwade-design/ReviuNew` GitHub repository integration.

> **Note**: The requirement names (e.g., "current_user:read") are descriptive labels from the original requirements. Each requirement maps to specific GitHub OAuth scopes or GitHub App permissions, which are listed under each section.

## Required Scopes

### 1. Requirement: current_user:read
**GitHub OAuth Scope**: `read:user`
**GitHub App Permission**: User: Email addresses (read)

**Description**: Needed to read the current user's name, email, and profile image.

**API Endpoints Used**:
- `GET /user` - Get the authenticated user
- `GET /user/emails` - List email addresses for the authenticated user

**Permissions Required**:
- User: Email addresses (read)
- User: Profile information (read)

---

### 2. Requirement: file_comments:read
**GitHub OAuth Scope**: `repo` (for private repos) or `public_repo` (for public repos only)
**GitHub App Permission**: Repository: Contents (read), Pull Requests (read)

**Description**: Needed to read comments in accessible files.

**API Endpoints Used**:
- `GET /repos/{owner}/{repo}/comments` - List commit comments
- `GET /repos/{owner}/{repo}/comments/{comment_id}` - Get a commit comment
- `GET /repos/{owner}/{repo}/pulls/{pull_number}/comments` - List review comments on a pull request

**Permissions Required**:
- Repository: Contents (read)
- Repository: Pull requests (read)

---

### 3. Requirement: projects:read
**GitHub OAuth Scope**: `read:project`
**GitHub App Permission**: Organization: Projects (read)

**Description**: Needed to read team project structure, even for private projects.

**API Endpoints Used**:
- `GET /repos/{owner}/{repo}/projects` - List repository projects
- `GET /orgs/{org}/projects` - List organization projects
- `GET /projects/{project_id}` - Get a project
- `GET /projects/{project_id}/columns` - List project columns
- `GET /projects/columns/{column_id}/cards` - List project cards

**Permissions Required**:
- Organization: Projects (read)
- Repository: Projects (read)

---

### 4. Webhooks Scopes

#### Requirement: webhooks:read
**GitHub OAuth Scope**: `read:repo_hook` or `read:org_hook`
**GitHub App Permission**: Repository/Organization Administration (read is included in write)

**Description**: Required to read and list webhooks.

**API Endpoints Used**:
- `GET /repos/{owner}/{repo}/hooks` - List repository webhooks
- `GET /repos/{owner}/{repo}/hooks/{hook_id}` - Get a repository webhook
- `GET /orgs/{org}/hooks` - List organization webhooks
- `GET /orgs/{org}/hooks/{hook_id}` - Get an organization webhook

**Permissions Required**:
- Repository: Webhooks (read)
- Organization: Webhooks (read)

---

#### Requirement: webhooks:write
**GitHub OAuth Scope**: `admin:repo_hook` or `admin:org_hook`
**GitHub App Permission**: Repository/Organization Administration (write)

**Description**: Required to create, modify, and delete webhooks.

**API Endpoints Used**:
- `POST /repos/{owner}/{repo}/hooks` - Create a repository webhook
- `PATCH /repos/{owner}/{repo}/hooks/{hook_id}` - Update a repository webhook
- `DELETE /repos/{owner}/{repo}/hooks/{hook_id}` - Delete a repository webhook
- `POST /orgs/{org}/hooks` - Create an organization webhook
- `PATCH /orgs/{org}/hooks/{hook_id}` - Update an organization webhook
- `DELETE /orgs/{org}/hooks/{hook_id}` - Delete an organization webhook
- `POST /repos/{owner}/{repo}/hooks/{hook_id}/tests` - Test a repository webhook
- `POST /repos/{owner}/{repo}/hooks/{hook_id}/pings` - Ping a repository webhook

**Permissions Required**:
- Repository: Webhooks (read & write)
- Organization: Webhooks (read & write)

---

## Complete Scope Configuration

### For GitHub Apps:

Configure the following permissions in your GitHub App:

**Repository Permissions:**
```json
{
  "contents": "read",
  "issues": "read",
  "metadata": "read",
  "pull_requests": "read",
  "administration": "write"
}
```

**Organization Permissions:**
```json
{
  "members": "read",
  "organization_administration": "write"
}
```

**User Permissions:**
```json
{
  "email": "read"
}
```

### For Personal Access Tokens (Classic):

Select the following scopes:
- ✅ `repo` - Full control of private repositories
  - ✅ `repo:status` - Access commit status
  - ✅ `repo_deployment` - Access deployment status
  - ✅ `public_repo` - Access public repositories
  - ✅ `repo:invite` - Access repository invitations
  - ✅ `security_events` - Read and write security events
- ✅ `admin:repo_hook` - Full control of repository hooks
  - ✅ `write:repo_hook` - Write repository hooks
  - ✅ `read:repo_hook` - Read repository hooks
- ✅ `admin:org_hook` - Full control of organization hooks (if using organization webhooks)
- ✅ `read:user` - Read all user profile data
  - ✅ `user:email` - Access user email addresses
- ✅ `read:org` - Read org and team membership, read org projects
- ✅ `read:project` - Read access of projects

### For OAuth Apps:

Request the following scopes during OAuth authorization:
```
repo read:user read:org admin:repo_hook read:project
```

Or as a comma-separated list:
```
repo,read:user,read:org,admin:repo_hook,read:project
```

---

## Verification Checklist

After configuring the scopes, verify that the following actions work:

- [ ] Can retrieve authenticated user's name and email
- [ ] Can read profile image URL for the authenticated user
- [ ] Can list and read commit comments
- [ ] Can list and read pull request review comments
- [ ] Can access repository projects (both public and private)
- [ ] Can access organization projects (if applicable)
- [ ] Can list existing webhooks
- [ ] Can read webhook configuration details
- [ ] Can create new webhooks
- [ ] Can update existing webhooks
- [ ] Can delete webhooks
- [ ] Can test/ping webhooks

---

## Security Best Practices

1. **Principle of Least Privilege**: Only enable the specific scopes needed for your use case
2. **Scope Auditing**: Regularly review and audit the scopes your application uses
3. **Token Rotation**: Implement regular token rotation policies
4. **Secure Storage**: Store tokens and secrets in secure, encrypted storage (e.g., Supabase Secrets)
5. **Webhook Validation**: Always validate webhook signatures to ensure authenticity
6. **Rate Limiting**: Implement proper rate limiting and respect GitHub's API rate limits
7. **Error Handling**: Implement proper error handling for permission-related errors
8. **Logging**: Log all API calls and webhook events for audit purposes

---

## Troubleshooting

### "Resource not accessible by integration" Error
- Verify that the required scope is enabled
- Check that the GitHub App is installed on the repository/organization
- Ensure the user has authorized the OAuth app with the necessary scopes

### "Not Found" Error
- Verify the repository/organization exists and the token has access
- Check that the resource (project, webhook, etc.) exists
- Ensure the metadata/contents permission is enabled

### "Bad credentials" Error
- Verify the token is valid and not expired
- Check that the token is being sent correctly in the Authorization header
- For GitHub Apps, ensure the JWT is generated correctly

### Webhook Not Triggering
- Verify webhook URL is accessible from GitHub's servers
- Check webhook secret is configured correctly
- Review webhook delivery logs in GitHub repository settings
- Ensure webhook events are properly subscribed

---

## References

- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub OAuth Scopes](https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub App Permissions](https://docs.github.com/en/developers/apps/building-github-apps/setting-permissions-for-github-apps)
- [Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
