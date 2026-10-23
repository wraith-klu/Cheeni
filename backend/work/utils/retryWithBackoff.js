/**
 * Error Classifier for AI Provider Calls
 * Distinguishes between retryable (transient) and non-retryable (permanent) errors.
 *
 * @param {Error|any} error - Caught error from Gemini SDK, OpenRouter fetch, or network
 * @returns {{ retryable: boolean, reason: string, retryAfterMs?: number }}
 */
export const classifyAiError = (error) => {
  if (!error) {
    return { retryable: false, reason: "unknown_empty_error" };
  }

  const message = (error.message || "").toLowerCase();
  const status = error.status || error.statusCode || error.response?.status;
  const statusText = error.statusText || "";

  // 1. Check HTTP Status Codes if present
  if (status) {
    // 401 Unauthorized / 403 Forbidden: Invalid API keys — permanent, fail-fast
    if (status === 401 || status === 403) {
      return { retryable: false, reason: `auth_failure_${status}` };
    }

    // 400 Bad Request / 404 Not Found / 422 Unprocessable: Request syntax or model missing — permanent
    if (status === 400 || status === 404 || status === 422) {
      return { retryable: false, reason: `bad_request_${status}` };
    }

    // 429 Rate Limit: Transient failure — retryable with backoff or Retry-After header
    if (status === 429) {
      let retryAfterMs = null;
      const retryAfterHeader = error.headers?.get?.("retry-after") || error.response?.headers?.["retry-after"];
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds) && seconds > 0) {
          retryAfterMs = seconds * 1000;
        }
      }
      return { retryable: true, reason: "rate_limit_429", retryAfterMs };
    }

    // 5xx Server Errors (500, 502, 503, 504): Provider server errors — retryable
    if (status >= 500 && status < 600) {
      return { retryable: true, reason: `server_error_${status}` };
    }
  }

  // 2. Content Policy Violations (Safety / Harm blocks) — permanent
  if (
    message.includes("safety") ||
    message.includes("content policy") ||
    message.includes("blocked") ||
    message.includes("harm") ||
    message.includes("prohibited")
  ) {
    return { retryable: false, reason: "content_policy_violation" };
  }

  // 3. Network Timeouts, Connection Drops, Resets — transient and retryable
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("socket hang up") ||
    message.includes("fetch failed") ||
    message.includes("network error") ||
    message.includes("abort") ||
    error.name === "AbortError" ||
    error.name === "TimeoutError"
  ) {
    return { retryable: true, reason: "network_transient_error" };
  }

  // 4. Rate Limit / Quota in message text
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota")
  ) {
    return { retryable: true, reason: "rate_limit_message" };
  }

  // 5. 5xx indicators in message text
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("internal error") ||
    message.includes("bad gateway") ||
    message.includes("service unavailable")
  ) {
    return { retryable: true, reason: "server_error_message" };
  }

  // Default: if error is unclassified, treat as permanent to prevent wasteful retry loops
  return { retryable: false, reason: "unclassified_error" };
};

export const isRetryableError = (error) => {
  return classifyAiError(error).retryable;
};

/**
 * Executes an async function with exponential backoff and randomized jitter.
 *
 * @template T
 * @param {() => Promise<T>} fn - Asynchronous operation to attempt
 * @param {object} options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts before bubbling error
 * @param {number} [options.baseDelayMs=500] - Initial delay in milliseconds
 * @param {number} [options.maxDelayMs=4000] - Maximum delay ceiling
 * @param {string} [options.callName="AI Call"] - Label for structured logging
 * @returns {Promise<T>} Result of the successful attempt
 */
export const retryWithBackoff = async (
  fn,
  {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 4000,
    callName = "AI Call",
  } = {}
) => {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const { retryable, reason, retryAfterMs } = classifyAiError(err);

      // Non-retryable error (e.g. 401/403 bad API key, 400 malformed, safety policy) -> fail fast
      if (!retryable || attempt > maxRetries) {
        if (!retryable) {
          console.warn(`[RetryPolicy] ${callName} failed with non-retryable error (${reason}): ${err.message}. Failing fast.`);
        } else {
          console.warn(`[RetryPolicy] ${callName} exhausted all ${maxRetries} retries (${reason}).`);
        }
        throw err;
      }

      // Calculate exponential backoff delay with jitter (variance between 0.8x and 1.2x)
      let delayMs = retryAfterMs || Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = 0.8 + Math.random() * 0.4;
      delayMs = Math.round(delayMs * jitter);

      console.warn(
        `[RetryPolicy] ${callName} attempt ${attempt}/${maxRetries} failed (${reason}): ${err.message}. Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};
