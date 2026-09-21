import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import puppeteer, { type Cookie } from "puppeteer-core";

type BrowserKind = "chrome" | "firefox";

const AUTH_COOKIE_NAMES = new Set([
  "APISID",
  "HSID",
  "LOGIN_INFO",
  "SAPISID",
  "SID",
  "SSID",
  "__Secure-1PAPISID",
  "__Secure-1PSID",
  "__Secure-3PAPISID",
  "__Secure-3PSID",
]);

const secretsDirectory = path.resolve(process.cwd(), "secrets");
const executablePath = findBrowserExecutable();
const browserKind: BrowserKind = /firefox/i.test(path.basename(executablePath))
  ? "firefox"
  : "chrome";
const profileDirectory = path.join(
  secretsDirectory,
  `youtube-profile-${browserKind}`,
);

mkdirSync(secretsDirectory, { recursive: true });

if (browserKind === "firefox") {
  console.warn(
    "Attention : Google refuse souvent la connexion depuis Firefox lorsqu'il est piloté par Puppeteer. Installez Chrome, Brave ou Edge, ou définissez BROWSER_PATH vers leur exécutable.",
  );
}

console.info(
  "Une fenêtre isolée va s'ouvrir. Elle ne lit pas les cookies ni le profil de votre navigateur personnel.",
);
console.info(
  "Choisissez uniquement le compte Google destiné au bot et vérifiez qu'il est actif sur YouTube.",
);

const { browser, browserProcess } = await openIsolatedBrowser();

try {
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.goto(
    "https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fwww.youtube.com%2Faccount",
    { waitUntil: "domcontentloaded" },
  );

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await prompt.question(
    "Quand le bon compte est affiché comme compte actif sur YouTube, appuyez sur Entrée ici… ",
  );
  prompt.close();

  await page.goto("https://www.youtube.com/account", {
    waitUntil: "domcontentloaded",
  });
  const cookies = (await page.cookies("https://www.youtube.com")).filter(
    isRequiredAuthenticationCookie,
  );

  validateAuthenticationCookies(cookies);

  const output =
    ["# Netscape HTTP Cookie File", ...cookies.map(toNetscape)].join("\n") +
    "\n";
  const outputPath = path.join(secretsDirectory, "youtube-cookies.txt");
  writeFileSync(outputPath, output, { encoding: "utf8", mode: 0o600 });
  console.info(
    `${cookies.length} cookies d'authentification strictement sélectionnés ont été exportés vers ${outputPath}.`,
  );
  console.info("Vous pouvez maintenant lancer `bun start`.");
} finally {
  await browser.close();
  if (browserProcess && !browserProcess.killed) browserProcess.kill();
}

async function openIsolatedBrowser(): Promise<{
  browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  browserProcess?: ChildProcess;
}> {
  if (browserKind === "firefox") {
    const browser = await puppeteer.launch({
      browser: "firefox",
      executablePath,
      headless: false,
      userDataDir: profileDirectory,
      defaultViewport: null,
    });
    return { browser };
  }

  const port = await getAvailablePort();
  const browserProcess = spawn(
    executablePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: false },
  );
  let launchError: Error | undefined;
  browserProcess.once("error", (error) => {
    launchError = error;
  });

  try {
    const browserURL = `http://127.0.0.1:${port}`;
    await waitForBrowser(browserURL, browserProcess, () => launchError);
    const browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null,
    });
    return { browser, browserProcess };
  } catch (error) {
    if (!browserProcess.killed) browserProcess.kill();
    throw error;
  }
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Impossible de réserver un port local."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForBrowser(
  browserURL: string,
  browserProcess: ChildProcess,
  getLaunchError: () => Error | undefined,
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const launchError = getLaunchError();
    if (launchError) throw launchError;
    if (browserProcess.exitCode !== null)
      throw new Error("Le navigateur s'est fermé avant la connexion locale.");
    try {
      const response = await fetch(`${browserURL}/json/version`);
      if (response.ok) return;
    } catch {
      // The local debugging endpoint is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Le navigateur n'a pas répondu dans le délai imparti.");
}

function findBrowserExecutable(): string {
  const configuredPath =
    process.env["BROWSER_PATH"] || process.env["CHROME_PATH"];
  if (configuredPath) {
    if (!existsSync(configuredPath))
      throw new Error(`Navigateur introuvable : ${configuredPath}`);
    return configuredPath;
  }

  const defaultPath = getWindowsDefaultBrowserPath();
  const platformCandidates = getPlatformBrowserCandidates();
  // Google commonly rejects authentication in Firefox when Puppeteer launches
  // it. Prefer a Chromium browser, which we launch as a regular process before
  // attaching to its local debugging endpoint.
  const candidates = [
    ...platformCandidates.filter(isChromiumExecutable),
    ...(defaultPath && isChromiumExecutable(defaultPath) ? [defaultPath] : []),
    ...platformCandidates.filter(
      (candidate) => !isChromiumExecutable(candidate),
    ),
    ...(defaultPath && !isChromiumExecutable(defaultPath) ? [defaultPath] : []),
  ];
  const executable = candidates.find((candidate): candidate is string =>
    Boolean(candidate && existsSync(candidate)),
  );
  if (!executable)
    throw new Error(
      "Aucun navigateur compatible trouvé. Définissez BROWSER_PATH vers Brave, Chrome, Edge, Chromium ou Firefox.",
    );
  return executable;
}

function isChromiumExecutable(candidate: string | undefined): boolean {
  if (!candidate) return false;
  return /(?:chrome|chromium|brave|msedge)(?:\.exe)?$/i.test(
    path.basename(candidate),
  );
}

function getWindowsDefaultBrowserPath(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const progId = spawnSync(
    "reg",
    [
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
      "/v",
      "ProgId",
    ],
    { encoding: "utf8", windowsHide: true },
  ).stdout?.match(/ProgId\s+REG_\w+\s+(.+)/i)?.[1];
  if (!progId) return undefined;

  const command = spawnSync(
    "reg",
    ["query", `HKCR\\${progId.trim()}\\shell\\open\\command`, "/ve"],
    { encoding: "utf8", windowsHide: true },
  ).stdout;
  return command
    ?.match(/(?:"([^"]+\.exe)"|([^\s]+\.exe))/i)
    ?.slice(1)
    .find((value): value is string => Boolean(value));
}

function getPlatformBrowserCandidates(): Array<string | undefined> {
  if (process.platform === "win32")
    return [
      process.env["PROGRAMFILES"] &&
        path.join(
          process.env["PROGRAMFILES"],
          "BraveSoftware/Brave-Browser/Application/brave.exe",
        ),
      process.env["LOCALAPPDATA"] &&
        path.join(
          process.env["LOCALAPPDATA"],
          "BraveSoftware/Brave-Browser/Application/brave.exe",
        ),
      process.env["PROGRAMFILES"] &&
        path.join(
          process.env["PROGRAMFILES"],
          "Google/Chrome/Application/chrome.exe",
        ),
      process.env["LOCALAPPDATA"] &&
        path.join(
          process.env["LOCALAPPDATA"],
          "Google/Chrome/Application/chrome.exe",
        ),
      process.env["PROGRAMFILES(X86)"] &&
        path.join(
          process.env["PROGRAMFILES(X86)"],
          "Microsoft/Edge/Application/msedge.exe",
        ),
      process.env["PROGRAMFILES"] &&
        path.join(
          process.env["PROGRAMFILES"],
          "Microsoft/Edge/Application/msedge.exe",
        ),
      process.env["LOCALAPPDATA"] &&
        path.join(
          process.env["LOCALAPPDATA"],
          "Microsoft/Edge/Application/msedge.exe",
        ),
      process.env["PROGRAMFILES"] &&
        path.join(process.env["PROGRAMFILES"], "Mozilla Firefox/firefox.exe"),
    ];
  if (process.platform === "darwin")
    return [
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Firefox.app/Contents/MacOS/firefox",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  return [
    "/usr/bin/brave-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/firefox",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

function isRequiredAuthenticationCookie(cookie: Cookie): boolean {
  const domain = cookie.domain.toLowerCase();
  const isYouTube = domain === ".youtube.com" || domain === "youtube.com";
  return isYouTube && AUTH_COOKIE_NAMES.has(cookie.name);
}

function validateAuthenticationCookies(cookies: Cookie[]): void {
  const names = new Set(cookies.map(({ name }) => name));
  const hasSessionId = names.has("SID") || names.has("__Secure-1PSID");
  const hasApiSession =
    names.has("SAPISID") ||
    names.has("__Secure-1PAPISID") ||
    names.has("__Secure-3PAPISID");
  if (!names.has("LOGIN_INFO") || !hasSessionId || !hasApiSession)
    throw new Error(
      "Le compte YouTube actif n'a pas pu être confirmé. Sélectionnez le compte voulu, attendez le chargement complet de YouTube, puis réessayez.",
    );
}

function toNetscape(cookie: Cookie): string {
  const includeSubdomains = cookie.domain.startsWith(".") ? "TRUE" : "FALSE";
  const secure = cookie.secure ? "TRUE" : "FALSE";
  const expires = cookie.expires > 0 ? Math.floor(cookie.expires) : 0;
  return [
    cookie.domain,
    includeSubdomains,
    cookie.path,
    secure,
    expires,
    cookie.name,
    cookie.value,
  ].join("\t");
}
