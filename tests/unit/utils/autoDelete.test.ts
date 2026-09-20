import { afterEach, describe, expect, mock, test } from "bun:test";
import { config } from "config";
import type { Message } from "discord.js";
import { autoDelete } from "@utils/autoDelete";

const initialAutoDelete = config.AUTO_DELETE;
const originalSetTimeout = globalThis.setTimeout;
type TimeoutCallback = Parameters<typeof setTimeout>[0];

afterEach(() => {
  config.AUTO_DELETE = initialAutoDelete;
  globalThis.setTimeout = originalSetTimeout;
});

const makeMessage = () => {
  const deleteMessage = mock(async () => undefined);
  return {
    deleteMessage,
    message: { delete: deleteMessage } as unknown as Message,
  };
};

describe("autoDelete", () => {
  test("ne programme rien lorsque l'option est désactivée", async () => {
    config.AUTO_DELETE = false;
    const { deleteMessage, message } = makeMessage();
    const schedule = mock(() => 1 as unknown as ReturnType<typeof setTimeout>);
    globalThis.setTimeout = schedule as unknown as typeof setTimeout;

    await autoDelete(message);

    expect(schedule).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  test.each([
    [false, 25_000],
    [true, 120_000],
  ])("programme la suppression avec le délai attendu", async (long, delay) => {
    config.AUTO_DELETE = true;
    const { deleteMessage, message } = makeMessage();
    const schedule = mock(
      (callback: TimeoutCallback, milliseconds?: number) => {
        expect(milliseconds).toBe(delay);
        if (typeof callback === "function") callback();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
    );
    globalThis.setTimeout = schedule as unknown as typeof setTimeout;

    await autoDelete(message, long);
    await Promise.resolve();

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(deleteMessage).toHaveBeenCalledTimes(1);
  });

  test("absorbe un échec de suppression différée", async () => {
    config.AUTO_DELETE = true;
    const deleteMessage = mock(async () => {
      throw new Error("message déjà supprimé");
    });
    const message = { delete: deleteMessage } as unknown as Message;
    globalThis.setTimeout = ((callback: TimeoutCallback) => {
      if (typeof callback === "function") callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    await autoDelete(message);
    await Bun.sleep(0);

    expect(deleteMessage).toHaveBeenCalledTimes(1);
  });
});
