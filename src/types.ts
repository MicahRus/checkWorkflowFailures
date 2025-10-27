export interface ParsedInput {
  owner: string;
  repo: string;
  workflowId: string;
  branch: string;
  token: string;
  perPage: number;
  daysToLookBack: number;
  checkOutsideWindow: boolean;
}
