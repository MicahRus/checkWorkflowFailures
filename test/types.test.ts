import { ParsedInput } from '../src/types';

describe('types', () => {
  describe('ParsedInput', () => {
    it('should have all required properties', () => {
      const input: ParsedInput = {
        owner: 'test-owner',
        repo: 'test-repo',
        workflowId: 'test-workflow.yml',
        branch: 'main',
        token: 'fake-token',
        perPage: 50,
        daysToLookBack: 7, // 7 days
        checkOutsideWindow: true,
      };

      expect(input.owner).toBe('test-owner');
      expect(input.repo).toBe('test-repo');
      expect(input.workflowId).toBe('test-workflow.yml');
      expect(input.branch).toBe('main');
      expect(input.token).toBe('fake-token');
      expect(input.perPage).toBe(50);
      expect(input.daysToLookBack).toBe(7);
      expect(input.checkOutsideWindow).toBe(true);
    });

    it('should enforce correct types', () => {
      const input: ParsedInput = {
        owner: 'owner',
        repo: 'repo',
        workflowId: 'workflow',
        branch: 'branch',
        token: 'token',
        perPage: 100,
        daysToLookBack: 1, // 1 day
        checkOutsideWindow: false,
      };

      expect(typeof input.owner).toBe('string');
      expect(typeof input.repo).toBe('string');
      expect(typeof input.workflowId).toBe('string');
      expect(typeof input.branch).toBe('string');
      expect(typeof input.token).toBe('string');
      expect(typeof input.perPage).toBe('number');
      expect(typeof input.daysToLookBack).toBe('number');
      expect(typeof input.checkOutsideWindow).toBe('boolean');
    });

    it('should handle different daysToLookBack values', () => {
      const inputs = [
        { daysToLookBack: 0.25 }, // 6 hours (0.25 days)
        { daysToLookBack: 1 }, // 1 day
        { daysToLookBack: 7 }, // 7 days (default)
        { daysToLookBack: 30 }, // 30 days
      ];

      inputs.forEach(({ daysToLookBack }) => {
        const input: ParsedInput = {
          owner: 'owner',
          repo: 'repo',
          workflowId: 'workflow',
          branch: 'branch',
          token: 'token',
          perPage: 50,
          daysToLookBack,
          checkOutsideWindow: true,
        };

        expect(typeof input.daysToLookBack).toBe('number');
        expect(input.daysToLookBack).toBe(daysToLookBack);
      });
    });

    it('should handle different checkOutsideWindow values', () => {
      const inputs = [
        { checkOutsideWindow: true },
        { checkOutsideWindow: false },
      ];

      inputs.forEach(({ checkOutsideWindow }) => {
        const input: ParsedInput = {
          owner: 'owner',
          repo: 'repo',
          workflowId: 'workflow',
          branch: 'branch',
          token: 'token',
          perPage: 50,
          daysToLookBack: 7,
          checkOutsideWindow,
        };

        expect(typeof input.checkOutsideWindow).toBe('boolean');
        expect(input.checkOutsideWindow).toBe(checkOutsideWindow);
      });
    });
  });
});
