import { GatewayIntentBits, Options } from 'discord.js';
import { Bot } from './core/Bot';

export const bot = new Bot({
  allowedMentions: { repliedUser: false },
  rest: {
    timeout: 30000,
    retries: 6
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 10,
    GuildEmojiManager: 0,
    ReactionManager: 0,
    ThreadManager: 0,
    StageInstanceManager: 0,
    PresenceManager: 0,
    AutoModerationRuleManager: 0,
    GuildScheduledEventManager: 0,
  }),
  sweepers: {
    messages: {
      interval: 1800,
      lifetime: 600,
    },
    users: {
      interval: 1800,
      filter: () => user => user.bot && user.id !== user.client.user.id,
    },
  },
});
