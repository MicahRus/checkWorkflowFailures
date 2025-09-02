import { typescript, javascript, TextFile, YamlFile } from 'projen';

const nodeVersion = '20';
const authorName = 'Micah Rus';
const majorVersion = 1;

const project = new typescript.TypeScriptProject({
  name: 'check-workflow-failures',
  projenrcTs: true,
  authorName,
  authorEmail: 'rus.micah@gmail.com',
  defaultReleaseBranch: 'main',
  description: 'A GitHub action to check if a workflow has been in a failed state for a set period of time',
  keywords: [
    'projen',
    'Typescript',
    'GitHub',
    'Action',
    'Workflow',
    'Failures',
    'Monitoring',
  ],
  repository: 'https://github.com/MicahRus/check-workflow-failures.git',
  packageManager: javascript.NodePackageManager.PNPM,
  npmAccess: javascript.NpmAccess.PUBLIC,
  deps: [
    '@actions/core',
    '@actions/github',
  ],
  devDeps: [
    '@types/babel__core',
    '@vercel/ncc',
  ],
  workflowNodeVersion: nodeVersion,
  publishTasks: false,
  jest: false,
  sampleCode: false,
  tsconfig: {
    compilerOptions: {
      target: 'es6',
    },
  },
  majorVersion,
  autoApproveOptions: {
    allowedUsernames: ['MicahRus'],
  },
  autoApproveUpgrades: true,
  releaseFailureIssue: true,
});

project.postCompileTask.exec('ncc build --source-map --out action');

project.addTask('test:local', {
  description: 'Test the action locally',
  steps: [
    {
      exec: 'ts-node scripts/test.ts',
    },
  ],
});

project.tsconfigEslint?.addInclude('scripts');


new YamlFile(project, '.github/workflows/check-workflow-failures.yml', {
  obj: {
    name: 'check-workflow-failures',
    permissions: {
      actions: 'read',
      contents: 'read',
    },
    on: {
      workflow_dispatch: {},
      schedule: [
        {
          // GitHub Actions cron uses UTC, AEST is UTC+10
          cron: '0 21 * * *', // 7:00 AM AEST = 21:00 UTC previous day
        },
      ],
    },
    jobs: {
      check: {
        'name': 'Check previous workflow failures',
        'runs-on': 'ubuntu-latest',
        'env': {
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        },
        'steps': [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v3',
          },
          {
            name: 'Run CheckWorkflowFailures Action',
            uses: 'MicahRus/checkWorkflowFailures@v1',
            id: 'check_failures',
          },
          {
            name: 'Fail if previous failure',
            if: 'steps.check_failures.outputs.has_previous_failure == \'true\'',
            run: 'echo "❌ Previous workflow failure detected" && exit 1',
          },
        ],
      },
    },
  },
});

project.release?.publisher.addGitHubPostPublishingSteps({
  name: 'Moving tag',
  env: {
    GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    GITHUB_REPOSITORY: '${{ github.repository }}',
    GITHUB_REF: '${{ github.ref }}',
  },
  run: `gh release edit v${majorVersion} -R $GITHUB_REPOSITORY --target $GITHUB_REF`,
});

new TextFile(project, '.nvmrc', {
  lines: [nodeVersion],
});

new YamlFile(project, 'action.yml', {
  obj: {
    name: 'Has Active Workflow Failure',
    description: 'Checks whether the targeted workflow run has been in a failed state for a set period of time',
    author: authorName,
    branding: {
      icon: 'package',
      color: 'blue',
    },
    inputs: {
      per_page: {
        description: 'The number of runs to check (if not provided, it will check the last 50 runs)',
        required: false,
      },
      owner: {
        description: 'The owner of the repository (if not provided, the current owner will be used)',
        required: false,
      },
      repo: {
        description: 'The repository name (if not provided, the current repository will be used)',
        required: false,
      },
      workflow_id: {
        description: 'The workflow that you want to check (if not provided, it will check the release.yml workflow)',
        required: true,
      },
      github_token: {
        description: 'The GitHub token (if not provided, the environment variable GITHUB_TOKEN will be used instead)',
        required: true,
      },
      branch: {
        description: 'The branch to check (if not provided, "main" will be used)',
        required: false,
      },
    },
    outputs: {
      has_active_failure: {
        description: 'True/False to represent if the workflow has been in a failed state for a set period of time',
      },
    },
    runs: {
      using: 'node20',
      main: 'action/index.js',
    },
  },
});

project.synth();
