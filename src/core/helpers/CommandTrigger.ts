import {
  Attachment,
  BaseInteraction,
  ButtonInteraction,
  Collection,
  CommandInteraction,
  Guild,
  GuildMember,
  Message,
  MessageComponentInteraction,
  type BaseMessageOptions,
  type GuildTextBasedChannel,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type Snowflake,
} from "discord.js";
import { i18n } from 'i18n.config';

export class CommandTrigger {

  public readonly member: GuildMember;
  public readonly channel: GuildTextBasedChannel;
  public readonly isInteraction: boolean;
  private readonly interaction?: CommandInteraction | MessageComponentInteraction;
  private readonly message?: Message;
  private response?: Promise<Message>;

  constructor(trigger: CommandInteraction | Message | MessageComponentInteraction) {
    if (trigger instanceof BaseInteraction) {
      this.interaction = trigger;
      this.message = undefined;
      this.member = trigger.member as GuildMember;
      this.channel = trigger.channel as GuildTextBasedChannel;
    } else {
      this.message = trigger;
      this.interaction = undefined;
      this.member = trigger.member!;
      this.channel = trigger.channel as GuildTextBasedChannel;
    }
    this.isInteraction = !!this.interaction;
  }

  public async reply(content: string | InteractionReplyOptions): Promise<Message> {
    if (this.response || this.interaction?.replied || this.interaction?.deferred) {
      return this.editReply(content);
    }
    if (this.interaction) {
      if (typeof content === "string") {
        this.response = this.interaction.reply({ content, fetchReply: true });
      } else {
        content.fetchReply = true;
        this.response = this.interaction.reply(content as { fetchReply: true; });
      }
    } else if (this.message) {
      this.response = this.message.reply(content as BaseMessageOptions);
    }
    return this.response!;
  }

  public async editReply(content: string | InteractionEditReplyOptions): Promise<Message> {
    if (this.interaction) {
      await this.response;
      await this.interaction.editReply(content);
    } else {
      await (await this.response!).edit(content as BaseMessageOptions);
    }
    return this.response!;
  }

  public async deferUpdate(): Promise<void> {
    if (this.interaction) {
      if (this.interaction instanceof MessageComponentInteraction) {
        this.interaction.deferUpdate();
      } else {
        await this.loadingReply().then((rep: Message) =>
          rep.delete().catch(() => null)
        );
      }
    }
  }

  public async loadingReply(ephemeral?: boolean): Promise<Message> {
    if (this.interaction) {
      if (!this.interaction.replied && !this.interaction.deferred) {
        this.response = this.interaction.deferReply({ ephemeral, fetchReply: true });
      } else {
        await this.interaction.editReply(i18n.__("common.loading"));
      }
    } else if (this.message) {
      if (!this.response) {
        this.response = this.message.reply(i18n.__("common.loading"));
      } else {
        await (await this.response).edit(i18n.__("common.loading"));
      }
    }
    return this.response!;
  }

  public async deleteReply(): Promise<void> {
    const response = this.response ? await this.response : undefined;
    if (response?.deletable) {
      await response.delete().catch(() => null);
      this.response = undefined;
    }
  }

  public async followUp(content: string | BaseMessageOptions): Promise<Message> {
    if (this.interaction) {
      if (!this.interaction.replied && !this.interaction.deferred) {
        this.response = this.reply(content);
      } else {
        return this.interaction.followUp(content);
      }
    } else if (this.message) {
      if (this.response) {
        return this.message.reply(content);
      } else {
        this.response = this.message.reply(content);
      }
    }
    return this.response!;
  }

  public send(content: string | BaseMessageOptions): Promise<Message> {
    if (
      this.interaction &&
      this.interaction instanceof MessageComponentInteraction &&
      !this.interaction.replied &&
      !this.interaction.deferred
    ) {
      this.interaction.deferUpdate().catch(() => null);
    }
    return this.channel.send(content);
  }


  public get guild(): Guild {
    return this.channel.guild;
  }

  public get attachments(): Collection<Snowflake, Attachment> | undefined {
    return this.message?.attachments;
  }

  public get type() {
    if (this.message) {
      return "Message";
    } else if (this.interaction instanceof ButtonInteraction) {
      return "ButtonInteraction";
    } else if (this.interaction instanceof CommandInteraction) {
      return "CommandInteraction";
    } else {
      return "MessageComponentInteraction";
    }
  }
}