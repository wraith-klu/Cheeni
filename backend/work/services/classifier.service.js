/**
 * Intent Classifier Service
 * High-speed, deterministic tokenizer + n-gram + pattern matcher
 * providing sub-millisecond intent detection and entity slot extraction.
 *
 * Latency: < 0.2ms
 * Intents:
 *   - PLAY_MUSIC
 *   - LAUNCH_APP
 *   - OPEN_URL
 *   - SEARCH_WEB
 *   - SYSTEM_STATUS
 *   - WINDOW_CONTROL
 *   - INTERVIEW_PREP
 *   - CONVERSATION
 */

export const INTENT = {
  PLAY_MUSIC: "PLAY_MUSIC",
  LAUNCH_APP: "LAUNCH_APP",
  OPEN_URL: "OPEN_URL",
  SEARCH_WEB: "SEARCH_WEB",
  SYSTEM_STATUS: "SYSTEM_STATUS",
  WINDOW_CONTROL: "WINDOW_CONTROL",
  INTERVIEW_PREP: "INTERVIEW_PREP",
  CONVERSATION: "CONVERSATION",
};

// ── App dictionary with aliases ──────────────────────────────────────────────
const APP_REGISTRY = {
  notepad: ["notepad", "note pad", "text editor", "notes app"],
  calculator: ["calculator", "calc", "calculation app"],
  vscode: ["vscode", "vs code", "visual studio code", "code editor", "code"],
  terminal: ["terminal", "wt", "windows terminal"],
  cmd: ["cmd", "command prompt"],
  powershell: ["powershell", "ps"],
  paint: ["paint", "mspaint", "draw"],
  "task manager": ["task manager", "taskmgr", "task monitor"],
  "file explorer": ["file explorer", "explorer", "my computer", "files"],
  settings: ["settings", "windows settings", "preferences", "control panel"],
};

// ── Web platform dictionary ──────────────────────────────────────────────────
const WEB_REGISTRY = {
  youtube: { triggers: ["youtube", "yt"], url: "https://www.youtube.com", label: "YouTube" },
  google: { triggers: ["google"], url: "https://www.google.com", label: "Google" },
  github: { triggers: ["github", "git hub"], url: "https://www.github.com", label: "GitHub" },
  linkedin: { triggers: ["linkedin", "linked in"], url: "https://www.linkedin.com", label: "LinkedIn" },
  whatsapp: { triggers: ["whatsapp", "whats app"], url: "https://web.whatsapp.com", label: "WhatsApp Web" },
  leetcode: { triggers: ["leetcode", "leet code"], url: "https://leetcode.com", label: "LeetCode" },
  gmail: { triggers: ["gmail", "email", "mail"], url: "https://mail.google.com", label: "Gmail" },
  twitter: { triggers: ["twitter", " x "], url: "https://x.com", label: "Twitter / X" },
  spotify: { triggers: ["spotify"], url: "https://open.spotify.com", label: "Spotify" },
  netflix: { triggers: ["netflix"], url: "https://www.netflix.com", label: "Netflix" },
  reddit: { triggers: ["reddit"], url: "https://www.reddit.com", label: "Reddit" },
  chatgpt: { triggers: ["chatgpt", "openai"], url: "https://chatgpt.com", label: "ChatGPT" },
  maps: { triggers: ["maps", "google maps"], url: "https://maps.google.com", label: "Google Maps" },
};

export function tokenize(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function extractMusicQuery(raw) {
  let q = raw
    .replace(/^please\s+/i, "")
    .replace(/^(can\s+you\s+|could\s+you\s+|will\s+you\s+)?(play|stream|watch|listen\s+to|start|put\s+on)\s*/i, "")
    .replace(/^(songs?|music|videos?|tracks?|clip|audios?)\s*/i, "")
    .replace(/^(of|by|from)\s+/i, "")
    .replace(/\s*(?:on|in|from|at|via)\s+youtube\b/gi, "")
    .replace(/\bvideo(?:s)?\s+(?:related\s+to|about|on)\s+/gi, "")
    .replace(/\brelated\s+to\b/gi, "")
    .replace(/\s+(?:please|now|for\s+me)\s*$/gi, "")
    .trim();

  const openOnYt = raw.match(/^(?:open|show|play|put on)\s+(.+?)\s+(?:on|in|at|from)\s+youtube\b/i);
  if (openOnYt && openOnYt[1]) {
    q = openOnYt[1]
      .replace(/^(a|the|some)\s+/i, "")
      .replace(/^(songs?|music|videos?|tracks?)\s+(?:of|by|from)\s+/i, "")
      .replace(/^(of|by|from)\s+/i, "")
      .trim();
  }

  return q || "trending music";
}

export function classifyIntent(prompt) {
  if (!prompt || typeof prompt !== "string") {
    return { intent: INTENT.CONVERSATION, confidence: 0.1, slots: {}, action: null };
  }

  const p = prompt.toLowerCase().trim();

  // 1. PLAY MUSIC INTENT (<0.1ms, 99% confidence)
  const isDirectPlay = /^(play|stream|watch|listen\s+to|put\s+on)\s+/i.test(p);
  const isOpenOnYoutube = /^(?:open|show|play|put on)\s+.+?\s+(?:on|in|at|from)\s+youtube\b/i.test(p);
  const hasMusicKeywords = /\b(song|songs|music|track|tracks|soundtrack|lofi|remix)\b/i.test(p);

  if (isDirectPlay || isOpenOnYoutube || (hasMusicKeywords && /\b(play|listen|put)\b/i.test(p))) {
    const query = extractMusicQuery(prompt);
    return {
      intent: INTENT.PLAY_MUSIC,
      confidence: 0.99,
      slots: { query, platform: "youtube" },
      action: {
        type: "play_music",
        query,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        label: `Playing "${query}" on YouTube`,
      },
    };
  }

  // 2. SYSTEM STATUS INTENT
  if (/\b(battery|power\s+level|charging|charge\s+level|how\s+much\s+battery)\b/i.test(p)) {
    return {
      intent: INTENT.SYSTEM_STATUS,
      confidence: 0.98,
      slots: { subType: "battery" },
      action: { type: "system_status", subType: "battery", label: "Checking Battery Status" },
    };
  }
  if (/\b(what\s+time|current\s+time|today'?s\s+date|what\s+is\s+the\s+date|what'?s\s+the\s+time)\b/i.test(p)) {
    return {
      intent: INTENT.SYSTEM_STATUS,
      confidence: 0.98,
      slots: { subType: "datetime" },
      action: { type: "system_status", subType: "datetime", label: "Checking Date and Time" },
    };
  }

  // 3. LAUNCH APP INTENT
  const isAppActionVerb = /^(open|launch|start|run)\s+/i.test(p);
  for (const [appName, aliases] of Object.entries(APP_REGISTRY)) {
    for (const alias of aliases) {
      if (
        p === alias ||
        (isAppActionVerb && (p === `open ${alias}` || p === `launch ${alias}` || p === `start ${alias}` || p.startsWith(`open ${alias}`) || p.startsWith(`launch ${alias}`)))
      ) {
        return {
          intent: INTENT.LAUNCH_APP,
          confidence: 0.97,
          slots: { app: appName },
          action: {
            type: "launch_app",
            app: appName,
            label: `Open ${appName.charAt(0).toUpperCase() + appName.slice(1)}`,
          },
        };
      }
    }
  }

  // 4. OPEN URL INTENT
  if (isAppActionVerb || /^(go\s+to|visit)\s+/i.test(p)) {
    for (const [, site] of Object.entries(WEB_REGISTRY)) {
      if (site.triggers.some(t => p.includes(t))) {
        return {
          intent: INTENT.OPEN_URL,
          confidence: 0.96,
          slots: { url: site.url, name: site.label },
          action: { type: "open_url", url: site.url, label: `Opening ${site.label}` },
        };
      }
    }
    const domainMatch = p.match(/(?:open|launch|go to|visit)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (domainMatch && domainMatch[1]) {
      const domain = domainMatch[1].startsWith("http") ? domainMatch[1] : `https://${domainMatch[1]}`;
      return {
        intent: INTENT.OPEN_URL,
        confidence: 0.95,
        slots: { url: domain },
        action: { type: "open_url", url: domain, label: `Opening ${domainMatch[1]}` },
      };
    }
  }

  // 5. SEARCH WEB INTENT
  if (/^search\s+youtube\s+for\s+/i.test(p) || p.includes("search on youtube")) {
    const query = prompt.replace(/search youtube for|search on youtube for|search on youtube/gi, "").trim();
    return {
      intent: INTENT.SEARCH_WEB,
      confidence: 0.97,
      slots: { query, engine: "youtube" },
      action: {
        type: "search_web",
        query,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        label: `Searching YouTube for "${query}"`,
      },
    };
  }
  if (/^search\s+wikipedia\s+for\s+/i.test(p) || p.includes("search on wikipedia")) {
    const query = prompt.replace(/search wikipedia for|search on wikipedia for|search on wikipedia/gi, "").trim();
    return {
      intent: INTENT.SEARCH_WEB,
      confidence: 0.97,
      slots: { query, engine: "wikipedia" },
      action: {
        type: "search_web",
        query,
        url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
        label: `Searching Wikipedia for "${query}"`,
      },
    };
  }
  if (/^(search\s+for|search\s+google\s+for|google|search)\s+/i.test(p)) {
    const query = prompt.replace(/search for|search google for|google|search/gi, "").trim();
    return {
      intent: INTENT.SEARCH_WEB,
      confidence: 0.95,
      slots: { query, engine: "google" },
      action: {
        type: "search_web",
        query,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        label: `Searching Google for "${query}"`,
      },
    };
  }

  // 6. WINDOW CONTROL INTENT
  if (/\b(minimize|maximize|snap\s+left|snap\s+right|close\s+window)\b/i.test(p)) {
    const subType = p.includes("minimize") ? "minimize" : p.includes("maximize") ? "maximize" : "snap";
    return {
      intent: INTENT.WINDOW_CONTROL,
      confidence: 0.93,
      slots: { subType },
      action: { type: "window_control", subType, label: `Window: ${subType}` },
    };
  }

  // 7. INTERVIEW PREP INTENT
  if (/\b(interview|dsa|system\s+design|leetcode|mock\s+interview|binary\s+search|dynamic\s+programming)\b/i.test(p)) {
    return {
      intent: INTENT.INTERVIEW_PREP,
      confidence: 0.90,
      slots: { topic: p },
      action: null,
    };
  }

  // 8. CONVERSATION
  return {
    intent: INTENT.CONVERSATION,
    confidence: 0.85,
    slots: {},
    action: null,
  };
}
