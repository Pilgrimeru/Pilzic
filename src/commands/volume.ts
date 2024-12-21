import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { ApplicationCommandOptionType } from 'discord.js';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class VolumeCommand extends Command {

  constructor() {
    super({
      name: "volume",
      aliases: ["v"],
      description: i18n.__("volume.description"),
      options: [
        {
          name: "level",
          description: i18n.__("volume.options.level"),
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

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    if (!args[0])
      return await commandTrigger.reply(i18n.__mf("volume.currentVolume", { volume: player.volume })).then(autoDelete);

    const level = Number(args[0]);

    if (isNaN(level))
      return await commandTrigger.reply(i18n.__("volume.errorNotNumber")).then(autoDelete);

    if (level > 100 || level < 0)
      return await commandTrigger.reply(i18n.__("volume.intervalError")).then(autoDelete);

    player.volume = level;

    return await commandTrigger.reply(i18n.__mf("volume.result", { level: args[0] })).then(autoDelete);
  }
}