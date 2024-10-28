import { Event } from '@custom-types/Event';
import { config } from 'config';
import { Client, type ClientEvents, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getFreeClientID, setToken } from 'play-dl';
import { CommandManager } from './managers/CommandManager';
import { PlayerManager } from './managers/PlayerManager';

export class Bot extends Client {

  public readonly prefix: string;
  public playerManager: PlayerManager;
  public readonly commandManager: CommandManager;

  public constructor() {
    super({
      allowedMentions: { repliedUser: false },
      rest: {
        timeout: 30000,
        retries: 6
      },
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });
    this.prefix = config.PREFIX;
    this.playerManager = new PlayerManager();
    this.commandManager = new CommandManager();

    this.login(config.TOKEN);

    this.on("warn", (info) => console.log("client warn : ", info));
    this.on("error", (e) => console.error("client : ", e));

    this.loadEvents();
    this.commandManager.loadCommands();
    this.soundcloudApiConnect();
  }

  private async soundcloudApiConnect(): Promise<void> {
    try {
      const clientID = await getFreeClientID();
      setToken({
        useragent: [config.USERAGENT],
        soundcloud: {
          client_id: clientID,
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  private async loadEvents(): Promise<void> {
    const eventFolder = join(__dirname, '../events');
    const eventFiles = readdirSync(eventFolder).filter((file) => !file.endsWith(".map"));
    for (const file of eventFiles) {
      const filePath = join(eventFolder, file);
      const event = (await import(filePath)).default as Event<keyof ClientEvents>;
      this.on(event.name, event.execute);
    }
  }
}
