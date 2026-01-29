import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

// Store GitHub webhook configurations (use a database in production)
const githubConfigs = {};

/**
 * GitHub webhook endpoint
 * Receives push and pull_request events from GitHub and pings relevant Discord roles
 */
app.post('/github-webhook', express.json(), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  // Verify webhook signature (optional but recommended)
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    if (signature !== digest) {
      return res.status(401).send('Invalid signature');
    }
  }

  const payload = req.body;
  const repoFullName = payload.repository?.full_name;

  // Find config for this repo
  const config = Object.values(githubConfigs).find(c => c.repo === repoFullName);

  if (!config) {
    console.log(`No config found for repo: ${repoFullName}`);
    return res.status(200).send('No config for this repo');
  }

  let message = '';

  if (event === 'push') {
    const branch = payload.ref?.replace('refs/heads/', '');
    const committer = payload.pusher?.name;
    const commitCount = payload.commits?.length || 0;
    const compareUrl = payload.compare;

    message = `<@&${config.pushRoleId}> 🚀 **New Push to ${repoFullName}**\n` +
      `**Branch:** ${branch}\n` +
      `**By:** ${committer}\n` +
      `**Commits:** ${commitCount}\n` +
      `**Compare:** ${compareUrl}`;
  } else if (event === 'pull_request') {
    const action = payload.action;
    const pr = payload.pull_request;
    const author = pr?.user?.login;
    const title = pr?.title;
    const url = pr?.html_url;

    message = `<@&${config.prRoleId}> 📝 **Pull Request ${action} on ${repoFullName}**\n` +
      `**Title:** ${title}\n` +
      `**By:** ${author}\n` +
      `**URL:** ${url}`;
  }

  if (message) {
    try {
      await DiscordRequest(`channels/${config.channelId}/messages`, {
        method: 'POST',
        body: { content: message },
      });
      console.log(`Sent GitHub ${event} notification to channel ${config.channelId}`);
    } catch (err) {
      console.error('Error sending Discord message:', err);
    }
  }

  res.status(200).send('OK');
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // GitHub setup command
    if (name === 'github-setup') {
      const channelId = req.body.channel_id;
      const pushRoleId = data.options.find(o => o.name === 'push_role').value;
      const prRoleId = data.options.find(o => o.name === 'pr_role').value;
      const repo = data.options.find(o => o.name === 'repo').value;

      // Store config (use database in production)
      githubConfigs[channelId] = {
        channelId,
        pushRoleId,
        prRoleId,
        repo,
      };

      const webhookUrl = process.env.PUBLIC_URL 
        ? `${process.env.PUBLIC_URL}/github-webhook`
        : 'YOUR_SERVER_URL/github-webhook';

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ GitHub notifications configured!\n` +
            `**Repository:** ${repo}\n` +
            `**Push notifications:** <@&${pushRoleId}>\n` +
            `**PR notifications:** <@&${prRoleId}>\n\n` +
            `**Next step:** Set up a webhook in your GitHub repo pointing to:\n` +
            `\`${webhookUrl}\`\n` +
            `Select events: \`Pushes\` and \`Pull requests\``,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
