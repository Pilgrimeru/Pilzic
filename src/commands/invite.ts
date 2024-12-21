import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { i18n } from 'i18n.config';

export default class InviteCommand extends Command {
  constructor() {
    super({
      name: "invite",
      description: i18n.__("invite.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    try {
      await commandTrigger.member.send(
        `https://discord.com/oauth2/authorize?client_id=${commandTrigger.guild.client.user.id}&permissions=274897914880&scope=bot`
      );
      commandTrigger.reply(i18n.__("invite.result")).then(autoDelete);
    } catch (message) {
      console.error(message);
    }
  }
}