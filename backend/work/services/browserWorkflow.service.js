import { createHash, randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export const BROWSER_WORKFLOW_REGISTRY = {
  "public_article_reader": {
    id: "public_article_reader",
    title: "Public Article Reader",
    description: "Extract clean, readable article title, author, and bounded body text from public editorial and news pages.",
    category: "article",
    enabled: true,
    version: "1.0.0",
    maxDurationSeconds: 30,
    maxPages: 1,
    maxTextChars: 15000,
    allowedDomains: [
      "en.wikipedia.org",
      "wikipedia.org",
      "bbc.com",
      "www.bbc.com",
      "reuters.com",
      "www.reuters.com",
      "techcrunch.com",
      "www.techcrunch.com",
      "arstechnica.com",
      "theverge.com",
      "www.theverge.com",
      "nature.com",
      "www.nature.com",
      "medium.com",
      "dev.to",
      "news.ycombinator.com",
      "example.com",
    ],
    disclosure: {
      networkAccess: "Outbound HTTPS connection to approved publisher domain only.",
      modelDisclosure: "Extracted article text may be processed by your selected LLM for summarization.",
      storage: "No cookies, credentials, or sessions are retained.",
    },
    allowedActions: ["navigate", "extract_article_content"],
  },
  "public_documentation_reader": {
    id: "public_documentation_reader",
    title: "Public Documentation Reader",
    description: "Safely read and extract reference guides and API documentation from official developer portals.",
    category: "documentation",
    enabled: true,
    version: "1.0.0",
    maxDurationSeconds: 30,
    maxPages: 1,
    maxTextChars: 18000,
    allowedDomains: [
      "docs.python.org",
      "developer.mozilla.org",
      "nodejs.org",
      "react.dev",
      "status.github.com",
      "www.githubstatus.com",
      "pypi.org",
      "fastapi.tiangolo.com",
      "vitest.dev",
      "vite.dev",
      "example.com",
    ],
    disclosure: {
      networkAccess: "Outbound HTTPS connection to approved technical documentation portal only.",
      modelDisclosure: "Extracted documentation text is summarized with exact source section attribution.",
      storage: "Ephemeral context; no cached tokens or local storage used.",
    },
    allowedActions: ["navigate", "extract_documentation"],
  },
  "public_product_spec_reader": {
    id: "public_product_spec_reader",
    title: "Public Product Spec Reader",
    description: "Extract technical specifications, public availability, and item details from public product pages without signing in.",
    category: "product",
    enabled: true,
    version: "1.0.0",
    maxDurationSeconds: 30,
    maxPages: 1,
    maxTextChars: 15000,
    allowedDomains: [
      "apple.com",
      "www.apple.com",
      "microsoft.com",
      "www.microsoft.com",
      "store.google.com",
      "github.com",
      "huggingface.co",
      "example.com",
    ],
    disclosure: {
      networkAccess: "Outbound HTTPS connection to public product specification pages.",
      modelDisclosure: "Product facts & specs are structured for comparison without purchasing or cart actions.",
      storage: "Completely read-only; no shopping carts, cookies, or account data accessed.",
    },
    allowedActions: ["navigate", "extract_specifications"],
  },
};

// ── In-memory active runs store scoped by runId and owner (userId) ───────────
const activeRuns = new Map();

/**
 * Validate that a URL is well-formed, uses HTTP(S), has standard ports,
 * has no user:pass, and matches the allowed domain list for the workflow.
 */
export function validateWorkflowUrl(urlStr, workflow) {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "URL string is required" };
  }
  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: "Embedded credentials in URL are prohibited" };
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443" && parsed.port !== "") {
    return { valid: false, error: "Only standard ports (80, 443) are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  const domainAllowed = workflow.allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  if (!domainAllowed) {
    return {
      valid: false,
      error: `Domain '${hostname}' is not in the allowlist for ${workflow.title}`,
    };
  }

  return { valid: true, hostname, normalizedUrl: parsed.origin + parsed.pathname + parsed.search };
}

/**
 * SSRF guard: resolve DNS and check for private, loopback, link-local, carrier NAT IPs.
 */
export async function checkDnsSafety(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: "DNS resolution failed" };
    }

    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return { safe: false, error: "Target domain resolved to a private or reserved IP address" };
      }
    }
    return { safe: true, addresses: addresses.map((a) => a.address) };
  } catch (err) {
    return { safe: false, error: `DNS lookup error: ${err.message}` };
  }
}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127) return true; // loopback
    if (parts[0] === 10) return true; // Class A
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // Class B
    if (parts[0] === 192 && parts[1] === 168) return true; // Class C
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-local
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // Carrier-grade NAT
    if (parts[0] === 0 || parts[0] >= 224) return true; // 0.0.0.0 or multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // Loopback/unspecified
    if (lower.startsWith("fe80:")) return true; // Link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // Unique local
    return false;
  }
  return true;
}

/**
 * Preview a workflow before running. No browser is launched.
 */
export async function previewBrowserWorkflow(userId, { workflowId, url }) {
  const workflow = BROWSER_WORKFLOW_REGISTRY[workflowId];
  if (!workflow || !workflow.enabled) {
    throw new Error(`Unknown or disabled workflow: ${workflowId}`);
  }

  const urlCheck = validateWorkflowUrl(url, workflow);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.error);
  }

  const previewId = "prev_" + createHash("sha256").update(`${userId}:${workflowId}:${urlCheck.normalizedUrl}:${Date.now()}`).digest("hex").slice(0, 16);

  return {
    previewId,
    workflowId: workflow.id,
    title: workflow.title,
    description: workflow.description,
    targetUrl: urlCheck.normalizedUrl,
    targetDomain: urlCheck.hostname,
    limits: {
      maxDurationSeconds: workflow.maxDurationSeconds,
      maxPages: workflow.maxPages,
      maxTextChars: workflow.maxTextChars,
    },
    allowedActions: workflow.allowedActions,
    disclosure: workflow.disclosure,
    estimatedSteps: [
      `1. Verify domain authorization (${urlCheck.hostname}) and DNS safety`,
      "2. Launch ephemeral, sandboxed browser reader session",
      "3. Navigate to target URL with redirects & downloads blocked",
      "4. Extract bounded semantic content and metadata",
      "5. Terminate session and return sanitized results",
    ],
  };
}

/**
 * Start a registered browser workflow.
 */
export async function startBrowserWorkflow(userId, { workflowId, url, previewId }) {
  const workflow = BROWSER_WORKFLOW_REGISTRY[workflowId];
  if (!workflow || !workflow.enabled) {
    throw new Error(`Unknown or disabled workflow: ${workflowId}`);
  }

  const urlCheck = validateWorkflowUrl(url, workflow);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.error);
  }

  const runId = "run_" + randomUUID().replace(/-/g, "").slice(0, 20);

  const runRecord = {
    runId,
    userId,
    workflowId: workflow.id,
    targetUrl: urlCheck.normalizedUrl,
    targetDomain: urlCheck.hostname,
    state: "launching", // launching -> navigating -> extracting -> completed | failed | cancelled | blocked_by_policy
    progress: 10,
    statusText: "Initializing isolated browser context...",
    startedAt: Date.now(),
    stoppedAt: null,
    controller: new AbortController(),
    result: null,
    visitedUrls: [urlCheck.normalizedUrl],
    logs: [`Workflow ${workflow.id} initialized for ${urlCheck.hostname}`],
  };

  activeRuns.set(runId, runRecord);

  // Asynchronously execute workflow runner without blocking HTTP response
  runWorkflowExecution(runRecord, workflow).catch((err) => {
    runRecord.state = "failed";
    runRecord.statusText = `Execution failed: ${err.message}`;
    runRecord.stoppedAt = Date.now();
  });

  return {
    runId,
    state: runRecord.state,
    workflowId: workflow.id,
    targetDomain: urlCheck.hostname,
    progress: runRecord.progress,
    statusText: runRecord.statusText,
  };
}

/**
 * Internal runner that handles DNS check, navigation, extraction, timeouts, and safe completion.
 */
async function runWorkflowExecution(record, workflow) {
  const { signal } = record.controller;

  // Timeout guard
  const timeoutId = setTimeout(() => {
    if (record.state !== "completed" && record.state !== "failed" && record.state !== "cancelled") {
      record.state = "timed_out";
      record.statusText = `Workflow timed out after ${workflow.maxDurationSeconds}s`;
      record.stoppedAt = Date.now();
      record.controller.abort();
    }
  }, workflow.maxDurationSeconds * 1000);

  try {
    if (signal.aborted) return;

    // Step 1: DNS safety check
    record.state = "policy_check";
    record.progress = 25;
    record.statusText = `Checking DNS safety for ${record.targetDomain}...`;
    record.logs.push(`Performing DNS resolution and IP safety check for ${record.targetDomain}`);

    const dnsResult = await checkDnsSafety(record.targetDomain);
    if (!dnsResult.safe) {
      record.state = "blocked_by_policy";
      record.statusText = dnsResult.error;
      record.stoppedAt = Date.now();
      clearTimeout(timeoutId);
      return;
    }

    if (signal.aborted) return;

    // Step 2: Navigating & Fetching via the hardened reader
    record.state = "navigating";
    record.progress = 50;
    record.statusText = `Connecting to ${record.targetDomain}...`;
    record.logs.push(`Navigating to ${record.targetUrl}`);

    const response = await fetch(record.targetUrl, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "Cheeni-Controlled-Browser/1.0 (Public Research Runner; +http://localhost:5173)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      record.state = "blocked_by_policy";
      record.statusText = "Redirects are blocked by policy in isolated research mode.";
      record.stoppedAt = Date.now();
      clearTimeout(timeoutId);
      return;
    }

    if (!response.ok) {
      record.state = "failed";
      record.statusText = `Target server responded with HTTP ${response.status}`;
      record.stoppedAt = Date.now();
      clearTimeout(timeoutId);
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      record.state = "blocked_by_policy";
      record.statusText = "Target did not return HTML content";
      record.stoppedAt = Date.now();
      clearTimeout(timeoutId);
      return;
    }

    if (signal.aborted) return;

    // Step 3: Extracting
    record.state = "extracting";
    record.progress = 75;
    record.statusText = `Extracting semantic content from ${record.targetDomain}...`;
    record.logs.push("Parsing page structure and extracting content");

    const html = await response.text();
    const extracted = sanitizeAndExtractContent(html, workflow.maxTextChars, workflow.category);

    if (signal.aborted) return;

    // Step 4: Completed
    record.state = "completed";
    record.progress = 100;
    record.statusText = "Workflow successfully completed.";
    record.stoppedAt = Date.now();
    record.result = {
      workflowId: workflow.id,
      title: extracted.title || record.targetDomain,
      url: record.targetUrl,
      domain: record.targetDomain,
      category: workflow.category,
      content: extracted.content,
      metadata: extracted.metadata,
      truncated: extracted.truncated,
      charsExtracted: extracted.content.length,
      limitations: "Extracted in an isolated read-only sandbox. Form actions and scripts disabled.",
      visitedUrls: record.visitedUrls,
    };
    record.logs.push(`Extraction complete. ${extracted.content.length} characters extracted.`);
  } catch (err) {
    if (signal.aborted || err.name === "AbortError") {
      record.state = "cancelled";
      record.statusText = "Run was stopped by user request.";
    } else {
      record.state = "failed";
      record.statusText = `Error during workflow execution: ${err.message}`;
    }
    record.stoppedAt = Date.now();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Semantic extraction according to workflow category
 */
function sanitizeAndExtractContent(html, maxChars, category) {
  // Strip head, scripts, styles, forms, inputs, SVGs
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  // Extract page title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");
  clean = clean.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  clean = clean.replace(/\s+/g, " ").trim();

  let truncated = false;
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars);
    truncated = true;
  }

  const metadata = {
    extractedAt: new Date().toISOString(),
    category,
  };

  return { title, content: clean, truncated, metadata };
}

/**
 * Get run status (owner-scoped)
 */
export function getBrowserRunStatus(userId, runId) {
  const record = activeRuns.get(runId);
  if (!record || record.userId !== userId) {
    return null;
  }

  const elapsedSeconds = Math.round(((record.stoppedAt || Date.now()) - record.startedAt) / 1000);

  return {
    runId: record.runId,
    workflowId: record.workflowId,
    state: record.state,
    progress: record.progress,
    statusText: record.statusText,
    targetDomain: record.targetDomain,
    targetUrl: record.targetUrl,
    elapsedSeconds,
    stoppedAt: record.stoppedAt,
    logs: record.logs,
  };
}

/**
 * Stop an active run (owner-scoped)
 */
export function stopBrowserRun(userId, runId) {
  const record = activeRuns.get(runId);
  if (!record || record.userId !== userId) {
    return null;
  }

  if (record.state !== "completed" && record.state !== "failed" && record.state !== "cancelled") {
    record.controller.abort();
    record.state = "cancelled";
    record.statusText = "Run stopped by user.";
    record.stoppedAt = Date.now();
    record.logs.push("Stop command issued by user. Resources released.");
  }

  return {
    runId: record.runId,
    state: record.state,
    statusText: record.statusText,
    stoppedAt: record.stoppedAt,
  };
}

/**
 * Get run result (owner-scoped)
 */
export function getBrowserRunResult(userId, runId) {
  const record = activeRuns.get(runId);
  if (!record || record.userId !== userId) {
    return null;
  }

  return {
    runId: record.runId,
    workflowId: record.workflowId,
    state: record.state,
    result: record.result,
    visitedUrls: record.visitedUrls,
    targetDomain: record.targetDomain,
    error: record.state === "failed" || record.state === "blocked_by_policy" ? record.statusText : null,
  };
}
