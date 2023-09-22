import { ApplicationCommandDataResolvable, Client, ClientEvents, Collection, GatewayIntentBits, Snowflake } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { getFreeClientID, setToken } from "play-dl";
import { config } from "../config";
import { Command } from "../types/Command";
import { Event } from "../types/Event";
import { Player } from "./Player";

export class Bot extends Client {
  
  public readonly useragent = "Mozilla/5.0 (Windows NT 11.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5653.214 Safari/537.36";
  public readonly prefix = config.PREFIX;
  public commands = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();
  public players = new Collection<Snowflake, Player>();  

  public constructor() {
    super({
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
    this.on("warn", (info) => console.log(info));
    this.on("error", console.error);
    this.loadEvents();
    this.importCommands();
    this.soundcloudApiConnect();
    setToken({ useragent: [this.useragent] });
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
  

  private async importCommands() : Promise<void> {
    const slashCommands: ApplicationCommandDataResolvable[] = [];
    const commandFiles = readdirSync(join(__dirname, "..", "commands")).filter((file) => !file.endsWith(".map"));

    for (const file of commandFiles) {
      const CommandClass = (await import(join(__dirname, ".." , "commands", file))).default;
      const commandInstance = new CommandClass() as Command;
      this.commands.set(commandInstance.name, commandInstance);
      const slashCommand : ApplicationCommandDataResolvable = {
        name: commandInstance.name,
        description: commandInstance.description,
        options: commandInstance.options,
        defaultMemberPermissions: commandInstance.permissions ?? null,
      }
      slashCommands.push(slashCommand);
    }

    this.once("ready" , () => {
      this.application?.commands.set(slashCommands);
    })
  }

  private async loadEvents() : Promise<void> {
    const eventFiles = readdirSync(join(__dirname, "..", "events")).filter((file) => !file.endsWith(".map"));
    for (const file of eventFiles) {
      const event = (await import(join(__dirname, "..", "events", `${file}`))).default as Event<keyof ClientEvents>;;
      this.on(event.name, event.execute);
    }
  }
}
