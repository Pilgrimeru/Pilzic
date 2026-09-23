import type {
  Attachment,
  Collection,
  Guild,
  GuildMember,
  InteractionCallbackResponse,
  Message,
} from "discord.js";
import {
  BaseInteraction,
  ButtonInteraction,
  CommandInteraction,
  MessageComponentInteraction,
  type BaseMessageOptions,
  type GuildTextBasedChannel,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type Snowflake,
} from "discord.js";
import { i18n } from "i18n.config";

export class CommandTrigger {
  public readonly member: GuildMember;
  public readonly channel: GuildTextBasedChannel;
  public readonly isInteraction: boolean;
  private readonly interaction?:
    CommandInteraction | MessageComponentInteraction | ButtonInteraction;
  private readonly message?: Message;
  private response?: Promise<Message>;

  constructor(
    trigger: CommandInteraction | Message | MessageComponentInteraction,
  ) {
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

  public async reply(
    content: string | InteractionReplyOptions,
  ): Promise<Message> {
    if (
      this.response ||
      this.interaction?.replied ||
      this.interaction?.deferred
    ) {
      throw new Error("Message already replied !");
    }

    if (this.interaction) {
      if (typeof content === "string") {
        this.response = this.getResponseFromCallback(
          this.interaction.reply({ content, withResponse: true }),
        );
      } else {
        this.response = this.getResponseFromCallback(
          this.interaction.reply({ ...content, withResponse: true }),
        );
      }
    } else if (this.message) {
      this.response = this.message.reply(content as BaseMessageOptions);
    }

    return this.response!;
  }

  public async editReply(
    content: string | InteractionEditReplyOptions,
  ): Promise<Message> {
    if (this.interaction) {
      await this.response;
      const edited = await this.interaction.editReply(content);
      this.response = Promise.resolve(edited);
      return edited;
    } else {
      const original = await this.response;
      if (!original) throw new Error("No response to edit");
      const edited = await original.edit(content);
      this.response = Promise.resolve(edited);
      return edited;
    }
  }

  public async deferUpdate(): Promise<void> {
    if (this.interaction) {
      if (this.interaction instanceof MessageComponentInteraction) {
        await this.interaction.deferUpdate();
      } else {
        await this.loadingReply().then((rep: Message) =>
          rep.delete().catch(() => null),
        );
      }
    }
  }

  public async loadingReply(ephemeral?: boolean): Promise<Message> {
    if (this.interaction) {
      if (!this.interaction.replied && !this.interaction.deferred) {
        this.response = this.getResponseFromCallback(
          this.interaction.deferReply({ ephemeral, withResponse: true }),
        );
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

  public async followUp(
    content: string | BaseMessageOptions,
  ): Promise<Message> {
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

  public async send(content: string | BaseMessageOptions): Promise<Message> {
    if (
      this.interaction &&
      this.interaction instanceof MessageComponentInteraction &&
      !this.interaction.replied &&
      !this.interaction.deferred
    ) {
      await this.interaction.deferUpdate();
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

  private async getResponseFromCallback(
    callbackResponse: Promise<InteractionCallbackResponse>,
  ): Promise<Message> {
    const message = (await callbackResponse).resource?.message;
    if (!message) throw new Error("Interaction returned no message");
    return message;
  }
}
