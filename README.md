# Check Workflow Failures

A GitHub Action that checks whether a targeted workflow has been in a failed state for a set period of time. This action is useful for monitoring workflow health and identifying workflows that have been consistently failing. It can be combined with an alert system to report to the team.

## Features

- 🔍 **Workflow Failure Detection**: Identifies workflows that have been failing for extended periods
- ⏰ **Time-based Analysis**: Checks if failures have persisted for 7 days or more
- 🎯 **Flexible Targeting**: Can check any workflow in any repository and branch
- 📊 **Configurable Scope**: Adjustable number of workflow runs to analyze
- 🚀 **Easy Integration**: Simple setup with minimal configuration required

## Use Cases

- **CI/CD Pipeline Monitoring**: Detect when your release or deployment workflows are consistently failing
- **Quality Assurance**: Ensure workflow reliability over time
- **Automated Alerts**: Trigger notifications when workflows have been failing for too long
- **Maintenance Scheduling**: Identify workflows that need attention or debugging

## Inputs

Input          | Description                            | Required | Default
-------------- | -------------------------------------- | -------- | ------------------------
`workflow_id`  | The workflow to check (filename or ID) | ✅ Yes    | `release.yml`
`github_token` | GitHub token for API access            | ✅ Yes    | `${{ github.token }}`
`branch`       | The branch to check                    | ❌ No     | `main`
`per_page`     | Number of workflow runs to check       | ❌ No     | `50`
`owner`        | Repository owner                       | ❌ No     | Current repository owner
`repo`         | Repository name                        | ❌ No     | Current repository

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

### Local Testing

```bash
# Test the action locally
pnpm run testlocally
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
