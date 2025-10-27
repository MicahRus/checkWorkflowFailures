import { getInput, setOutput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import type { ParsedInput } from './types';

export async function checkWorkflowStatus(): Promise<void> {
  try {
    const { token, owner, repo, workflowId, perPage, branch } = getParsedInput();
    const octokit = getOctokit(token);

    const response = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      per_page: perPage,
      workflow_id: workflowId,
      branch,
    });

    const workflowRuns = response.data.workflow_runs;
    if (workflowRuns.length === 0) {
      return setOutput('has_previous_failure', 'false');
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Filter out everything over 7 days old
    const recentWorkflowRuns = workflowRuns.filter(run => run.run_started_at && Date.now() - new Date(run.run_started_at).getTime() <= sevenDaysMs);

    // If we have nothing in the last 7 days, just check the most recent run
    if (recentWorkflowRuns.length === 0) {
      return setOutput('has_previous_failure', workflowRuns[0].conclusion === 'success' ? 'false' : 'true');
    }

    // Check for success first
    const hasSuccess = recentWorkflowRuns.some(run => run.conclusion === 'success');
    if (hasSuccess) {
      return setOutput('has_previous_failure', 'false');
    }

    // If we have not had a success in 7 days, we are in a failed state
    return setOutput('has_previous_failure', 'true');
  } catch (err) {
    console.error('Error checking workflow status:', err);
    return setFailed('Failed to check the workflow status');
  }
}

function getParsedInput(): ParsedInput {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const workflowId = getInput('workflow_id', { required: false }) || 'release.yml';
  const branch = getInput('branch', { required: false }) || 'main';
  const token = getInput('github_token', { required: false }) || (process.env.GITHUB_TOKEN as string);
  const perPage = getInput('per_page', { required: false }) || '50';

  return {
    owner,
    repo,
    workflowId,
    branch,
    token,
    perPage: parseInt(perPage),
  };
}

async function main() {
  await checkWorkflowStatus();
}

void main();
