import type { Event } from "@custom-types/Event";
import { config } from "config";
import { Client, type ClientEvents, type ClientOptions } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "path";
import { CommandManager } from "./managers/CommandManager";
import { PlayerManager } from "./managers/PlayerManager";

export class Bot extends Client {
  public readonly prefix: string;
  public playerManager: PlayerManager;
  public readonly commandManager: CommandManager;

  private constructor(options: ClientOptions) {
    super(options);
    this.prefix = config.PREFIX;
    this.playerManager = new PlayerManager();
    this.commandManager = new CommandManager(this);

    this.on("warn", (info) => console.log("client warn : ", info));
    this.on("error", (e) => console.error("client : ", e));
  }

  public static async create(options: ClientOptions): Promise<Bot> {
    const bot = new Bot(options);
    await Promise.all([bot.commandManager.loadCommands(), bot.loadEvents()]);
    await bot.login(config.TOKEN);
    void bot.commandManager
      .registerSlashCommands(bot)
      .catch((error) =>
        console.error("Unable to register slash commands:", error),
      );
    return bot;
  }

  private async loadEvents(): Promise<void> {
    const eventFolder = join(__dirname, "../events");
    const eventFiles = (await readdir(eventFolder)).filter(
      (file) => !file.endsWith(".map"),
    );
    const events = await Promise.all(
      eventFiles.map(async (file) => {
        const filePath = join(eventFolder, file);
        return (await import(filePath)).default as Event<keyof ClientEvents>;
      }),
    );
    for (const event of events) {
      this.on(event.name, event.execute);
    }
  }
}
