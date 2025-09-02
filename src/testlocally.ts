// Set environment variables FIRST, before any imports
// process.env.GITHUB_REPOSITORY = 'MondoPower/UbiConfigurationPage';
process.env.GITHUB_REPOSITORY = 'MondoPower/hosted-scan-service';

process.env.GITHUB_TOKEN = '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';
process.env.GITHUB_SHA = 'abc123';
process.env.GITHUB_WORKFLOW = 'release';
process.env.GITHUB_ACTOR = 'test-user';
process.env.GITHUB_EVENT_NAME = 'push';
process.env.GITHUB_REF = 'refs/heads/main';

// Mock action inputs (GitHub Actions converts inputs to env vars with INPUT_ prefix)
// process.env.INPUT_WORKFLOW_ID = 'release.yml';
process.env.INPUT_GITHUB_TOKEN = process.env.GITHUB_TOKEN;
process.env.INPUT_COMMIT_SHA = process.env.GITHUB_SHA;

// Now import after setting environment variables
import { checkWorkflowStatus } from './index';

async function testLocally() {
  try {
    await checkWorkflowStatus();
    console.log('✅ Action completed successfully');
  } catch (error) {
    console.error('❌ Action failed:', error);
  }
}

void testLocally();
