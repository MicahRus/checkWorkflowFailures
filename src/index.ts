import { getInput, setOutput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import type { ParsedInput } from './types';

export async function checkWorkflowStatus(): Promise<void> {
  try {
    const { token, owner, repo, workflowId, perPage } = getParsedInput();
    const octokit = getOctokit(token);

    const response = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      per_page: perPage,
      workflow_id: workflowId,
      branch: 'main',
    });

    for (const workflowRun of response.data.workflow_runs) {
      if (workflowRun.conclusion === 'success') {
        return setOutput('has_previous_failure', 'false');
      }
      if (!workflowRun.run_started_at) {
        continue;
      }

      if (isOlderThan7Days(workflowRun.run_started_at)) {
        return setOutput('has_previous_failure', 'true');
      }
    }

    return setOutput('has_previous_failure', 'false');
  } catch (err) {
    console.log('error', err);
    console.log('error', JSON.stringify(err));
    return setFailed('Failed to check the workflow status');
  }
}

function isOlderThan7Days(dateString: string | Date): boolean {
  // 7 days in milliseconds
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return (new Date().getTime() - new Date(dateString).getTime()) > sevenDaysMs;
}

function getParsedInput(): ParsedInput {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const workflowId = getInput('workflow_id', { required: false }) || 'release.yml';
  const commitSha = getInput('commit_sha', { required: false }) || context.sha;
  const token = getInput('github_token', { required: false }) || (process.env.GITHUB_TOKEN as string);
  const perPage = getInput('per_page', { required: false }) || '50';

  return {
    owner,
    repo,
    workflowId,
    commitSha,
    token,
    perPage: parseInt(perPage),
  };
}

async function main() {
  await checkWorkflowStatus();
}

void main();
