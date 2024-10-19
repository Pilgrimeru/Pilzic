import type { ClientEvents } from "discord.js";

export class Event<EventName extends keyof ClientEvents> {
  constructor(
    public name: EventName,
    public execute: (...args: ClientEvents[EventName]) => any
  ) {}
}