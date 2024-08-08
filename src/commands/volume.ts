import { ApplicationCommandOptionType } from "discord.js";
import { CommandTrigger } from "../components/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class VolumeCommand extends Command {
  constructor() {
    super({
      name: "volume",
      aliases: ["v"],
      description: i18n.__("volume.description"),
      options: [
        {
          name: "level",
          description: i18n.__mf("volume.options.level"),
          type: ApplicationCommandOptionType.String,
          required: true,
        }
      ],
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

    if (!args[0])
      return commandTrigger.reply(i18n.__mf("volume.currentVolume", { volume: player.volume })).then(autoDelete);

    const level = Number(args[0]);

    if (isNaN(level))
      return commandTrigger.reply(i18n.__("volume.errorNotNumber")).then(autoDelete);

    if (level > 100 || level < 0)
      return commandTrigger.reply(i18n.__("volume.intervalError")).then(autoDelete);

    player.volume = level;

    return commandTrigger.reply(i18n.__mf("volume.result", { level: args[0] })).then(autoDelete);
  }
}