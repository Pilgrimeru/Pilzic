import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import puppeteer, { type Cookie } from "puppeteer-core";

const candidates =
  process.platform === "win32"
    ? [
        process.env["PROGRAMFILES"] &&
          path.join(
            process.env["PROGRAMFILES"],
            "Google/Chrome/Application/chrome.exe",
          ),
        process.env["PROGRAMFILES(X86)"] &&
          path.join(
            process.env["PROGRAMFILES(X86)"],
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
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
        ];

const executablePath =
  process.env["CHROME_PATH"] ||
  candidates.find((candidate): candidate is string =>
    Boolean(candidate && existsSync(candidate)),
  );
if (!executablePath)
  throw new Error(
    "Chrome/Chromium introuvable. Définissez CHROME_PATH puis relancez la commande.",
  );

const secretsDirectory = path.resolve(process.cwd(), "secrets");
mkdirSync(secretsDirectory, { recursive: true });
const browser = await puppeteer.launch({
  executablePath,
  headless: false,
  userDataDir: path.join(secretsDirectory, "youtube-profile"),
  defaultViewport: null,
});

try {
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.goto("https://www.youtube.com/", {
    waitUntil: "domcontentloaded",
  });
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await prompt.question(
    "Connectez-vous à Google/YouTube dans Chrome, puis appuyez sur Entrée ici… ",
  );
  prompt.close();

  const cookies = (await browser.cookies()).filter((cookie) =>
    [
      ".youtube.com",
      ".google.com",
      ".googlevideo.com",
      ".googleapis.com",
      ".accounts.google.com",
      ".youtu.be",
    ].some(
      (domain) => cookie.domain === domain || cookie.domain.endsWith(domain),
    ),
  );
  const names = new Set(cookies.map(({ name }) => name));
  if (!names.has("LOGIN_INFO") || !names.has("SID")) {
    throw new Error(
      "Session incomplète : cookies LOGIN_INFO et/ou SID absents. Vérifiez la connexion YouTube.",
    );
  }

  const output =
    ["# Netscape HTTP Cookie File", ...cookies.map(toNetscape)].join("\n") +
    "\n";
  const outputPath = path.join(secretsDirectory, "youtube-cookies.txt");
  writeFileSync(outputPath, output, { encoding: "utf8", mode: 0o600 });
  console.info(
    `Cookies exportés vers ${outputPath}. Traitez ce fichier comme un secret.`,
  );
} finally {
  await browser.close();
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
