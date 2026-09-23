import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { ExternalLinkExtractor } from "@core/extractors/ExternalLinkExtractor";

test("lit les métadonnées d'un lien audio sans télécharger son corps", async () => {
  let headRequests = 0;
  let getRequests = 0;
  const server = createServer((request, response) => {
    if (request.method === "HEAD") headRequests++;
    else getRequests++;
    response.writeHead(200, {
      "content-type": "audio/mpeg",
      "content-disposition": 'attachment; filename="test.mp3"',
      "x-content-duration": "2",
    });
    response.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test port");
    const url = `http://127.0.0.1:${address.port}/audio.mp3`;
    const extractor = new ExternalLinkExtractor(url, "track");
    const data = await extractor.extract("track");
    expect(data.title).toBe("test.mp3");
    expect(data.duration).toBe(2_000);
    expect(headRequests).toBe(1);
    expect(getRequests).toBe(0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
