import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// GitHub notification setup command
const GITHUB_SETUP_COMMAND = {
  name: 'github-setup',
  description: 'Configure GitHub notifications for this channel',
  options: [
    {
      type: 8, // ROLE type
      name: 'push_role',
      description: 'Role to ping for push events',
      required: true,
    },
    {
      type: 8, // ROLE type
      name: 'pr_role',
      description: 'Role to ping for pull request events',
      required: true,
    },
    {
      type: 3, // STRING type
      name: 'repo',
      description: 'Repository name (e.g., owner/repo)',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, GITHUB_SETUP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
