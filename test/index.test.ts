import * as core from '@actions/core';
import * as github from '@actions/github';

// Logger stub for suppressing console output during tests
// Note: This must be setup before importing the main module because
// the main module executes code on import that could log to console
export let loggerStub: jest.SpyInstance;
loggerStub = jest.spyOn(console, 'error').mockImplementation(() => {});

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

    // Clear logger stub call history
    loggerStub.mockClear();

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
        days_to_look_back: '',
        check_outside_window: '',
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

  describe('custom lookback time', () => {
    it('should use custom days_to_look_back when provided', async () => {
      const customDaysToLookBack = 2; // 2 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customDaysToLookBack.toString();
        return '';
      });

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
              run_started_at: threeDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // Should only consider runs within 2 days (custom lookback), so the 3-day-old run should be ignored
      // Only the 1-day-old failed run should be considered
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should fall back to most recent run when custom lookback excludes all runs', async () => {
      const customDaysToLookBack = 1 / 24; // 1 hour (0.04167 days)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customDaysToLookBack.toString();
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // No runs within 1 hour, so should check most recent run (which is successful)
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should use default 7 days when days_to_look_back is not provided', async () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return ''; // Not provided
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: sixDaysAgo,
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

      // Should use default 7 days, so 6-day-old run should be included and 8-day-old should be excluded
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should handle invalid days_to_look_back gracefully', async () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return 'invalid-number';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneDayAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // Should fall back to default behavior (7 days) when invalid input is provided
      // NaN gets converted to 0, so this would effectively exclude all runs and fall back to most recent
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should work with very short lookback periods', async () => {
      const customLookbackDays = 0.003; // Approximately 5 minutes (5/1440 = 0.0034722 days)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoMinutesAgo,
              conclusion: 'failure',
            },
            {
              id: 2,
              run_started_at: tenMinutesAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // Only the 2-minute-old run should be within the 5-minute window
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should work with very long lookback periods', async () => {
      const customLookbackDays = 30; // 30 days
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twentyDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // 20-day-old run should be within the 30-day window
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });
  });

  describe('check_outside_window parameter', () => {
    it('should check most recent run when check_outside_window is true (default)', async () => {
      const customLookbackDays = 0.042; // Approximately 1 hour (1/24 = 0.0416667 days)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        if (name === 'check_outside_window') return ''; // Default (true)
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // No runs within 1 hour, but check_outside_window is true (default), so should check most recent run (failed)
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should check most recent run when check_outside_window is explicitly true', async () => {
      const customLookbackDays = 0.042; // Approximately 1 hour (1/24 = 0.0416667 days)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        if (name === 'check_outside_window') return 'true';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoDaysAgo,
              conclusion: 'success',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // No runs within 1 hour, but check_outside_window is true, so should check most recent run (successful)
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should not check most recent run when check_outside_window is false', async () => {
      const customLookbackDays = 0.042; // Approximately 1 hour (1/24 = 0.0416667 days)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        if (name === 'check_outside_window') return 'false';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoDaysAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // No runs within 1 hour and check_outside_window is false, so should return false regardless of most recent run
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should respect check_outside_window=false even with failed most recent run', async () => {
      const customLookbackDays = 0.021; // Approximately 30 minutes (30/1440 = 0.0208333 days)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        if (name === 'check_outside_window') return 'false';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: twoHoursAgo,
              conclusion: 'failure',
            },
            {
              id: 2,
              run_started_at: threeHoursAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // No runs within 30 minutes and check_outside_window is false, so should return false even though most recent run failed
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'false');
    });

    it('should still check within window runs when check_outside_window is false', async () => {
      const customLookbackDays = 0.1; // Approximately 2.4 hours to be well over the 1-hour mark
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'workflow_id') return 'release.yml';
        if (name === 'branch') return 'main';
        if (name === 'github_token') return 'fake-token';
        if (name === 'per_page') return '50';
        if (name === 'days_to_look_back') return customLookbackDays.toString();
        if (name === 'check_outside_window') return 'false';
        return '';
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1,
              run_started_at: oneHourAgo,
              conclusion: 'failure',
            },
          ],
        },
      } as any);

      await checkWorkflowStatus();

      // Run is within 2-hour window, so should check it normally (and return true since it failed)
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', 'true');
    });

    it('should handle string values correctly for check_outside_window', async () => {
      const validTestCases = [
        { input: 'true', expected: true },
        { input: 'TRUE', expected: true },
        { input: 'True', expected: true },
        { input: 'false', expected: false },
        { input: 'FALSE', expected: false },
        { input: 'False', expected: false },
        { input: '', expected: true }, // Default
        { input: '  ', expected: true }, // Whitespace should default to true
      ];

      for (const testCase of validTestCases) {
        const customLookbackDays = 0.042; // Approximately 1 hour (1/24 = 0.0416667 days)
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

        mockCore.getInput.mockImplementation((name: string) => {
          if (name === 'workflow_id') return 'release.yml';
          if (name === 'branch') return 'main';
          if (name === 'github_token') return 'fake-token';
          if (name === 'per_page') return '50';
          if (name === 'days_to_look_back') return customLookbackDays.toString();
          if (name === 'check_outside_window') return testCase.input;
          return '';
        });

        mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
          data: {
            workflow_runs: [
              {
                id: 1,
                run_started_at: twoDaysAgo,
                conclusion: 'failure',
              },
            ],
          },
        } as any);

        await checkWorkflowStatus();

        const expectedOutput = testCase.expected ? 'true' : 'false';
        expect(mockCore.setOutput).toHaveBeenCalledWith('has_previous_failure', expectedOutput);

        // Clear mocks for next iteration
        mockCore.setOutput.mockClear();
      }
    });

  });
});

// Global cleanup to restore console.error
afterAll(() => {
  loggerStub.mockRestore();
});
