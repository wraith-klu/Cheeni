export const ALLOWED_ALIAS_APPS = [
  "notepad",
  "calculator",
  "paint",
  "chrome",
  "edge",
  "firefox",
  "brave",
  "vscode",
  "spotify",
  "file explorer",
];

export const ALLOWED_ALIAS_FOLDERS = ["home", "desktop", "documents", "downloads"];
export const MAX_COMMAND_ALIASES = 30;

export function commandAliasStorageKey(userId) {
  return `cheeni_command_aliases_v1_${userId || "local"}`;
}

export function normalizeAliasPhrase(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ")
    : "";
}

function isPublicAliasHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)) return false;
  if (host.startsWith("[") || host.includes(":")) return false;

  const octets = host.split(".");
  if (octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [first, second] = octets.map(Number);
    if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
    if (first === 169 && second === 254) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
  }
  return true;
}

export function validateCommandAlias(input, aliases = [], excludedId = null) {
  const phrase = typeof input?.phrase === "string" ? input.phrase.trim().replace(/\s+/g, " ") : "";
  if (!phrase || phrase.length > 60 || /[\u0000-\u001f\u007f]/.test(phrase)) {
    return { error: "Alias phrase must contain 1–60 printable characters." };
  }

  const normalizedPhrase = normalizeAliasPhrase(phrase);
  if (aliases.some((alias) => alias.id !== excludedId && normalizeAliasPhrase(alias.phrase) === normalizedPhrase)) {
    return { error: "That alias phrase is already in use." };
  }

  const type = input?.type;
  const target = typeof input?.target === "string" ? input.target.trim() : "";
  if (type === "launch_app" && ALLOWED_ALIAS_APPS.includes(target)) {
    return { alias: { phrase, type, target } };
  }
  if (type === "open_folder" && ALLOWED_ALIAS_FOLDERS.includes(target)) {
    return { alias: { phrase, type, target } };
  }
  if (type === "open_url" && target.length <= 2048) {
    try {
      const url = new URL(target);
      if (["http:", "https:"].includes(url.protocol) && isPublicAliasHostname(url.hostname) && !url.username && !url.password) {
        return { alias: { phrase, type, target: url.href } };
      }
    } catch {
      return { error: "Enter a valid HTTP or HTTPS website address." };
    }
    return { error: "Only public HTTP or HTTPS websites without embedded credentials are allowed." };
  }
  return { error: "Choose a supported app, standard folder, or valid HTTP(S) URL." };
}

export function readCommandAliases(storageKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(stored)) return [];
    const result = [];
    for (const item of stored.slice(0, MAX_COMMAND_ALIASES)) {
      if (!item || typeof item.id !== "string") continue;
      const validated = validateCommandAlias(item, result);
      if (validated.alias) result.push({ id: item.id, ...validated.alias });
    }
    return result;
  } catch {
    return [];
  }
}

export function matchCommandAlias(prompt, aliases) {
  const normalizedPrompt = normalizeAliasPhrase(prompt);
  if (!normalizedPrompt) return null;

  for (const alias of aliases) {
    const phrase = normalizeAliasPhrase(alias.phrase);
    const candidates = [
      phrase,
      `open ${phrase}`,
      `launch ${phrase}`,
      `go to ${phrase}`,
      `visit ${phrase}`,
      `खोलो ${phrase}`,
      `खोलिए ${phrase}`,
      `खोल ${phrase}`,
      `${phrase} खोलो`,
      `${phrase} खोलिए`,
      `${phrase} पर जाओ`,
    ];
    if (candidates.includes(normalizedPrompt)) return alias;
  }
  return null;
}

export function commandAliasToolCall(alias) {
  if (!alias || !validateCommandAlias(alias).alias) return null;
  if (alias.type === "launch_app") return { name: "launch_app", arguments: { app_name: alias.target } };
  if (alias.type === "open_folder") return { name: "open_folder", arguments: { folder: alias.target } };
  if (alias.type === "open_url") return { name: "open_url", arguments: { url: alias.target } };
  return null;
}
