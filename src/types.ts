export interface ParsedInput {
  owner: string;
  repo: string;
  workflowId: string;
  commitSha: string;
  token: string;
  perPage: number;
}
