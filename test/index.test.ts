import * as core from '@actions/core';
import * as github from '@actions/github';
import { checkWorkflowStatus } from '../src/index';

// Mock the @actions modules
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockCore = core as jest.Mocked<typeof core>;
const mockGithub = github as jest.Mocked<typeof github>;

// Mock octokit
const mockOctokit = {
  rest: {
    actions: {
      listWorkflowRuns: jest.fn(),
    },
  },
};

describe('checkWorkflowStatus', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default environment and mocks
    process.env.GITHUB_TOKEN = 'fake-token';

    // Mock github context
    Object.defineProperty(mockGithub, 'context', {
      value: {
        repo: {
          owner: 'test-owner',
          repo: 'test-repo',
        },
      },
      writable: true,
    });

    // Mock getOctokit
    mockGithub.getOctokit.mockReturnValue(mockOctokit as any);

    // Mock getInput to return default values
    mockCore.getInput.mockImplementation((name: string) => {
      const defaults: Record<string, string> = {
        workflow_id: 'release.yml',
        branch: 'main',
        github_token: 'fake-token',
        per_page: '50',
      };
      return defaults[name] || '';
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.GITHUB_TOKEN;
  });

  describe('when no workflow runs exist', () => {
    it('should set has_previous_failure to false', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });
  });

  describe('when workflow runs exist but none in the last 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    it('should check the most recent run and set false if successful', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: eightDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should check the most recent run and set true if failed', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: eightDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });
  });

  describe('when recent workflow runs exist (within 7 days)', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    it('should set false when there is at least one successful run', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: 'failure',
            },
            {
              id: 2,
              run_started_at: twoDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should set true when all recent runs have failed', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: 'failure',
            },
            {
              id: 2,
              run_started_at: twoDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should handle runs with null conclusion as failures', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: null,
            },
            {
              id: 2,
              run_started_at: twoDaysAgo,
              conclusion: 'cancelled',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should handle runs with no run_started_at', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: null,
              conclusion: 'success',
            },
            {
              id: 2,
              run_started_at: oneDayAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // Should filter out the run with no start time and only consider the failed one
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });
  });

  describe('with custom inputs', () => {
    it('should use custom workflow_id', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'custom-workflow.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      } as any);

      await checkWorkflowStatus();

      expect(mockOctokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        per_page: 50,
        workflow_id: 'custom-workflow.yml',
        branch: 'main',
      });
    });

    it('should use custom branch', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'develop';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      } as any);

      await checkWorkflowStatus();

      expect(mockOctokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        per_page: 50,
        workflow_id: 'release.yml',
        branch: 'develop',
      });
    });

    it('should use custom per_page', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '100';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      } as any);

      await checkWorkflowStatus();

      expect(mockOctokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        per_page: 100,
        workflow_id: 'release.yml',
        branch: 'main',
      });
    });
  });

  describe('error handling', () => {
    it('should call setFailed when API call fails', async () => {
      const error = new Error('API Error');
      mockOctokit.rest.actions.listWorkflowRuns.mockRejectedValue(error);

      await checkWorkflowStatus();

      expect(mockCore.setFailed).toHaveBeenCalledWith('Failed to check the workflow status');
    });

    it('should handle network errors gracefully', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockRejectedValue(new Error('Network error'));

      await checkWorkflowStatus();

      expect(mockCore.setFailed).toHaveBeenCalledWith('Failed to check the workflow status');
    });
  });

  describe('edge cases', () => {
    it('should handle empty workflow_runs array', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should handle workflow runs at exactly 7 days old', async () => {
      const exactlySevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: exactlySevenDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should handle workflow runs just over 7 days old', async () => {
      const justOverSevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 1)).toISOString();

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: justOverSevenDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });
  });

  describe('Should ignore runs over 7 days old if more recent runs are present', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    it('failure', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: 'failure',
            },
            {
              id: 2,
              run_started_at: eightDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('success', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: 'success',
            },
            {
              id: 2,
              run_started_at: eightDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });
  });
});
