import { type ApplicationCommandDataResolvable, Client, type ClientEvents, Collection, GatewayIntentBits, type Snowflake } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { getFreeClientID, setToken } from "play-dl";
import { config } from "../config.js";
import { Command } from "../types/Command.js";
import { Event } from "../types/Event.js";
import { Player } from "./Player.js";

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
    const commandFolder = join(__dirname, '../commands');
    const commandFiles = readdirSync(commandFolder).filter((file) => !file.endsWith(".map"));
  
    for (const file of commandFiles) {
      const filePath = join(commandFolder, file);
      const CommandClass = (await import(filePath)).default;
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
    const eventFolder = join(__dirname, '../events');
    const eventFiles = readdirSync(eventFolder).filter((file) => !file.endsWith(".map"));
    for (const file of eventFiles) {
      const filePath = join(eventFolder, file);
      const event = (await import(filePath)).default as Event<keyof ClientEvents>;
      this.on(event.name, event.execute);
    }
  }
}
