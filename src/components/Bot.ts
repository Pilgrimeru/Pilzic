import { ApplicationCommandDataResolvable, Client, ClientEvents, Collection, GatewayIntentBits, Snowflake } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { getFreeClientID, setToken } from "play-dl";
import { config } from "../config";
import { Command } from "../types/Command";
import { Event } from "../types/Event";
import { Player } from "./Player";

export class Bot extends Client {

  public static readonly useragent = "Mozilla/5.0 (Windows NT 11.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5653.214 Safari/537.36";
  public readonly prefix = config.PREFIX;
  public commands = new Collection<string, Command>();
  public players = new Collection<Snowflake, Player>();

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
    this.importCommands();
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


  private async importCommands(): Promise<void> {
    const slashCommands: ApplicationCommandDataResolvable[] = [];
    const commandFolder = new URL('../commands', import.meta.url);
    const commandFiles = readdirSync(commandFolder).filter((file) => !file.endsWith(".map"));

    for (const file of commandFiles) {
      const filePath = join(commandFolder.pathname, file);
      const fileURL = new URL(`file://${filePath}`);
      const CommandClass = (await import(new URL(fileURL.href, commandFolder).pathname)).default;
      const commandInstance = new CommandClass() as Command;
      this.commands.set(commandInstance.name, commandInstance);
      const slashCommand: ApplicationCommandDataResolvable = {
        name: commandInstance.name,
        description: commandInstance.description,
        options: commandInstance.options,
        defaultMemberPermissions: commandInstance.permissions ?? null,
      };
      slashCommands.push(slashCommand);
    }

    this.once("ready", () => {
      this.application?.commands.set(slashCommands);
    });
  }

  private async loadEvents(): Promise<void> {
    const eventFolder = new URL('../events', import.meta.url);
    const eventFiles = readdirSync(eventFolder).filter((file) => !file.endsWith(".map"));
    for (const file of eventFiles) {
      const filePath = join(eventFolder.pathname, file);
      const fileURL = new URL(`file://${filePath}`);
      const event = (await import(fileURL.href)).default as Event<keyof ClientEvents>;
      this.on(event.name, event.execute);
    }
  }
}
