// Set environment variables FIRST, before any imports
process.env.GITHUB_REPOSITORY = 'MicahRus/checkWorkflowFailures';

process.env.GITHUB_TOKEN = 'YOUR_TOKEN_GOES_HERE';
process.env.GITHUB_SHA = 'abc123';
process.env.GITHUB_WORKFLOW = 'release';
process.env.GITHUB_ACTOR = 'test-user';
process.env.GITHUB_EVENT_NAME = 'push';
process.env.GITHUB_REF = 'refs/heads/main';

// Now import after setting environment variables
import { checkWorkflowStatus } from '../src/index';

async function testLocally() {
  try {
    await checkWorkflowStatus();
    console.info('✅ Action completed successfully');
  } catch (error) {
    console.error('❌ Action failed:', error);
  }
}

void testLocally();
