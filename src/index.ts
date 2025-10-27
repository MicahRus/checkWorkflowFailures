import { getInput, setOutput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import type { ParsedInput } from './types';

export async function checkWorkflowStatus(): Promise<void> {
  try {
    const { token, owner, repo, workflowId, perPage, branch, daysToLookBack, checkOutsideWindow } = getParsedInput();
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

    // Convert days to milliseconds for time comparison
    const timeToLookBackMs = daysToLookBack * 24 * 60 * 60 * 1000;

    // Filter out everything that is older than the period we want to look back into
    const recentWorkflowRuns = workflowRuns.filter(run =>
      run.run_started_at && Date.now() - new Date(run.run_started_at).getTime() <= timeToLookBackMs,
    );

    // If there are no runs within the time period we are looking back in, optionally check the most recent run
    if (recentWorkflowRuns.length === 0) {
      if (checkOutsideWindow) {
        return setOutput('has_previous_failure', workflowRuns[0].conclusion === 'success' ? 'false' : 'true');
      }

      return setOutput('has_previous_failure', 'false');
    }

    // Check for success first
    const hasSuccess = recentWorkflowRuns.some(run => run.conclusion === 'success');
    if (hasSuccess) {
      return setOutput('has_previous_failure', 'false');
    }

    // If we have not had a success within the time period we want to look back in, we are in a failed state
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
  const daysToLookBackInput = getInput('days_to_look_back', { required: false }) || '7';
  const checkOutsideWindowInput = getInput('check_outside_window', { required: false }).toLowerCase().trim() || 'true';

  return {
    owner,
    repo,
    workflowId,
    branch,
    token,
    perPage: parseInt(perPage),
    daysToLookBack: parseFloat(daysToLookBackInput),
    checkOutsideWindow: checkOutsideWindowInput === 'true' ? true : false,
  };
}

async function main() {
  await checkWorkflowStatus();
}

void main();
