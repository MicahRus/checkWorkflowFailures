# Check Workflow Failures

A GitHub Action that checks whether a targeted workflow has been in a failed state for a set period of time. This action is useful for monitoring workflow health and identifying workflows that have been consistently failing. It can be combined with an alert system to report to the team.

## Features

- 🔍 **Workflow Failure Detection**: Identifies workflows that have been failing for extended periods
- ⏰ **Time-based Analysis**: Checks if failures have persisted for 7 days or more
- 🎯 **Flexible Targeting**: Can check any workflow in any repository and branch
- 📊 **Configurable Scope**: Adjustable number of workflow runs to analyze
- 🚀 **Easy Integration**: Simple setup with minimal configuration required
- 🧪 **Local Testing**: Built-in test script for development and debugging

## Use Cases

- **CI/CD Pipeline Monitoring**: Detect when your release or deployment workflows are consistently failing
- **Quality Assurance**: Ensure workflow reliability over time
- **Automated Alerts**: Trigger notifications when workflows have been failing for too long
- **Maintenance Scheduling**: Identify workflows that need attention or debugging

## Inputs

Input                   | Description                            | Required | Default
----------------------- | -------------------------------------- | -------- | ------------------------
`workflow_id`           | The workflow to check (filename or ID) | ✅ Yes    | `release.yml`
`github_token`          | GitHub token for API access            | ✅ Yes    | `${{ github.token }}`
`branch`                | The branch to check                    | ❌ No     | `main`
`per_page`              | Number of workflow runs to check       | ❌ No     | `50`
`days_to_look_back`     | Time period to look back in days       | ❌ No     | `7`
`check_outside_window`  | Check most recent run when no runs found within lookback window (only `true` or `false`) | ❌ No | `true`
`owner`                 | Repository owner                       | ❌ No     | Current repository owner
`repo`                  | Repository name                        | ❌ No     | Current repository

## Outputs

Output                 | Description
---------------------- | ------------------------------------------------------------------
`has_previous_failure` | `true` if workflow has been failing for 7+ days, `false` otherwise

## Usage

### Basic Example

```yaml
name: Check Workflow Health

on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM
  workflow_dispatch:

jobs:
  check-failures:
    runs-on: ubuntu-latest
    steps:
      - name: Check for Active Workflow Failures
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'release.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: Handle Persistent Failures
        if: steps.check-failures.outputs.has_previous_failure == 'true'
        run: |
          echo "Workflow has been failing for 7+ days!"
          # Add your failure handling logic here
```

### Advanced Example

```yaml
name: Monitor Multiple Workflows

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  check-release-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Check Release Workflow
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'release.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          per_page: 100
          owner: 'my-org'
          repo: 'my-repo'

  check-test-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Check Test Workflow
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'test.yml'
          branch: 'develop'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          per_page: 25
```

### Custom Lookback Period Example

```yaml
name: Monitor with Custom Time Periods

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours

jobs:
  check-critical-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Check Critical Workflow (1 day lookback)
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'critical-deploy.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          days_to_look_back: 1  # 1 day

  check-standard-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Check Standard Workflow (3 day lookback)
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'standard-deploy.yml'
          branch: 'main' 
          github_token: ${{ secrets.GITHUB_TOKEN }}
          days_to_look_back: 3  # 3 days

  check-non-critical-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Check Non-Critical Workflow (14 day lookback)
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'docs-deploy.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          days_to_look_back: 14  # 14 days
```

#### Common Time Periods (in days)

Time Period | Days
----------- | ----
0.25 hours  | `0.01`
6 hours     | `0.25`
12 hours    | `0.5`
1 day       | `1`
3 days      | `3`
7 days      | `7` (default)
14 days     | `14`
30 days     | `30`

### Outside Window Check Examples

```yaml
name: Strict Window Monitoring

on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours

jobs:
  strict-monitoring:
    runs-on: ubuntu-latest
    steps:
      - name: Check Workflow (Strict - only within window)
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'critical-deploy.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          days_to_look_back: 1             # 1 day
          check_outside_window: false      # Don't check outside the 1-day window

  lenient-monitoring:
    runs-on: ubuntu-latest
    steps:
      - name: Check Workflow (Lenient - fallback to most recent)
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'standard-deploy.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          days_to_look_back: 1             # 1 day
          check_outside_window: true       # Check most recent run if no runs in 1 day (default)
```

#### Use Cases for `check_outside_window`:

- **`true` (default)**: Good for general monitoring where you want to know about any workflow issues
- **`false`**: Useful when you only care about recent activity and want to ignore old failures

**Note**: Only the values `true` and `false` (case-insensitive) are accepted.

```yaml
name: Monitor workflow with alerting

on: schedule:

- cron: '0 9 * * *'  # Daily at 9 AM

workflow_dispatch:

jobs: check-failures: runs-on: ubuntu-latest steps:

- name: Check for Active Workflow Failures
    uses: MicahRus/check-workflow-failures@v0.0.0
    with:
      workflow_id: 'release.yml'
      github_token: ${{ secrets.GITHUB_TOKEN }}

  slack-notification:
    name: HostedScanService CI Notification
    needs: deploy
    runs-on: ubuntu-latest
    permissions:
      checks: read
      contents: read
      actions: read
    if: failure()
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Slack Notification
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_TITLE: Failed commit message
          SLACK_COLOR: "#FF0000"
          SLACK_FOOTER: Slack Alert
```

### Branch-Specific Example

```yaml
name: Monitor Different Branches

on:
  schedule:
    - cron: '0 */12 * * *'  # Every 12 hours

jobs:
  check-main-branch:
    runs-on: ubuntu-latest
    steps:
      - name: Check Main Branch Workflow
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'deploy.yml'
          branch: 'main'
          github_token: ${{ secrets.GITHUB_TOKEN }}

  check-develop-branch:
    runs-on: ubuntu-latest
    steps:
      - name: Check Develop Branch Workflow
        uses: MicahRus/check-workflow-failures@v0.0.0
        with:
          workflow_id: 'deploy.yml'
          branch: 'develop'
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How It Works

1. **Workflow Analysis**: The action fetches the specified number of recent workflow runs from the specified branch
2. **Failure Detection**: It examines each run's conclusion and start time
3. **Time Calculation**: If a workflow has failed, it checks if the failure has persisted for 7 days or more
4. **Output Generation**: Returns `true` if there's a persistent failure, `false` otherwise

### Logic Flow

- ✅ **Success Found**: If any recent run succeeded, returns `false` (no persistent failure)
- ❌ **Recent Failure**: If failure is less than 7 days old, continues checking
- ⏰ **Persistent Failure**: If failure is 7+ days old, returns `true`
- 🔍 **Default**: If no clear pattern, returns `false`

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/MicahRus/check-workflow-failures.git
cd check-workflow-failures

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Project Structure

### Test Script Usage

The `scripts/test.ts` script allows you to test the GitHub Action locally without needing to push to a repository. This is useful for development and debugging.

**⚠️ Important: GitHub Token Required**

To use the test script, you need to add your GitHub token to the script. The script requires workflow permissions to access the GitHub API.

1. **Get a GitHub Token:**

  - Go to GitHub Settings → Developer settings → Personal access tokens
  - Generate a new token with the following permissions:

    - `workflow` (Update GitHub Action workflows)

2. **Update the Test Script:**

  ```typescript
  // In scripts/test.ts, update this line:
  process.env.GITHUB_TOKEN = 'your_github_token_here';
  ```

3. **Run the Test:**

  ```bash
  pnpm run test:local
  ```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues or have questions:

- 📖 Check the [documentation](https://github.com/MicahRus/check-workflow-failures)
- 🐛 Report bugs via [GitHub Issues](https://github.com/MicahRus/check-workflow-failures/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/MicahRus/check-workflow-failures/discussions)

--------------------------------------------------------------------------------

**Note**: This action is designed to help monitor workflow health over time. It's particularly useful for identifying workflows that may need maintenance or debugging attention.
