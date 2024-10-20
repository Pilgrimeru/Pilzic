import { Client, type ClientEvents, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { getFreeClientID, setToken } from "play-dl";
import { config } from "../config.js";
import { Event } from "../types/Event.js";
import { CommandManager } from "./managers/CommandManager.js";
import { PlayerManager } from "./managers/PlayerManager.js";

export class Bot extends Client {

  public static readonly useragent = "Mozilla/5.0 (Windows NT 11.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5653.214 Safari/537.36";
  public readonly prefix = config.PREFIX;
  public playerManager = new PlayerManager();
  public readonly commandManager = new CommandManager();

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
    this.login(config.TOKEN);
    this.on("warn", (info) => console.log("client warn : ", info));
    this.on("error", (e) => console.error("client : ", e));
    this.loadEvents();
    this.commandManager.loadCommands();
    this.soundcloudApiConnect();
    setToken({ useragent: [Bot.useragent] });
  }

  private async soundcloudApiConnect(): Promise<void> {
    try {
      const clientID = await getFreeClientID();
      setToken({
        soundcloud: {
          client_id: clientID
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
