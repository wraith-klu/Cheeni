/**
 * backend/utils/sanitizePrompt.js
 *
 * Defense-in-depth input sanitizer for user prompts before they reach the LLM.
 *
 * Design goals:
 *  - Strip literal structural role markers that appear in our own prompt templates
 *    so a user cannot fake a role switch via text.
 *  - Flag (not block) common prompt-injection phrases so they can be logged and
 *    reviewed without degrading UX for false positives.
 *  - Enforce a hard max-length to prevent context-stuffing / quota-burn attacks.
 *  - Return both the cleaned text and detection metadata so the caller decides
 *    what to do with flagged inputs.
 *
 * What we DO NOT do:
 *  - We do not rewrite or "neutralize" the semantic content of flagged messages.
 *    A user asking "how do prompt injection attacks work?" for a security class
 *    should get a real answer. The structural isolation in ai.service.js (step 2)
 *    is the primary defense; this layer adds visibility and strips markers only.
 */

// Max input length - 4000 chars prevents context-stuffing / quota-burn attacks
export const MAX_PROMPT_LENGTH = 4000;

/**
 * Structural role markers used inside our own prompt templates.
 * These are exact strings we use in ai.service.js — strip them from user input
 * so a user cannot fake a role switch by typing "System: ignore all instructions".
 */
export const STRUCTURAL_MARKERS = [
  /^\s*system\s*:/gim,
  /^\s*assistant\s*:/gim,
  /^\s*user\s*:/gim,
  /<\|tool_call_start\|>/gi,
  /<\|tool_call_end\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\/SYS>/gi,
  /---+\s*system\s*---+/gi,
  /\[system\]/gi,
  /\[assistant\]/gi,
  /^#{1,3}\s*(system|instructions?|rules?|prompt)\b/gim,
];

/**
 * INJECTION_PATTERNS - exported constant so you can extend this list without
 * touching the function logic. Each entry is a regex matching common jailbreak
 * and prompt-override phrases.
 *
 * Philosophy: flag, do not block. The real defense is structural isolation
 * (systemInstruction in Gemini, system role in OpenRouter). These patterns
 * provide visibility into attempts via the moderation log.
 */
export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|context|prompt|rules?|guidelines?)/i,
  /disregard\s+(all\s+)?(previous|above|prior|earlier|your)\s+(instructions?|context|prompt|rules?)/i,
  /forget\s+(all\s+)?(previous|above|prior|earlier|your)\s+(instructions?|context|prompt)/i,
  /override\s+(your\s+)?(instructions?|programming|rules?|guidelines?|directives?)/i,
  /bypass\s+(your\s+)?(instructions?|restrictions?|rules?|guidelines?|filters?)/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?|guidelines?|directives?)/i,
  /print\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /show\s+(me\s+)?(your|the)\s+(full\s+)?(system\s+)?(prompt|instructions?|configuration)/i,
  /what\s+(are|were)\s+your\s+(original\s+)?(instructions?|rules?|system\s+prompt)/i,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|directives?)/i,
  /output\s+(your|the|your\s+initial|your\s+original)\s+(system\s+)?(prompt|instructions?)/i,
  /tell\s+me\s+your\s+(exact\s+)?(system\s+)?(prompt|instructions?)/i,
  /you\s+are\s+now\s+(?!cheeni|an?\s+AI|an?\s+assistant)/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(DAN|an?\s+unrestricted|jailbroken|evil|uncensored)/i,
  /pretend\s+(you\s+(are|have\s+no)|there\s+are\s+no)\s+(restrictions?|rules?|guidelines?|limits?)/i,
  /your\s+(new\s+)?(role|persona|identity|name|purpose)\s+is/i,
  /switch\s+(to\s+)?(developer|DAN|jailbreak|unrestricted|evil)\s+mode/i,
  /enable\s+(developer|DAN|jailbreak|unrestricted)\s+mode/i,
  /do\s+anything\s+now/i,
  /\bDAN\b/,
  /\bnew\s+instructions?\b.*:/i,
  /\bsystem\s+message\b/i,
  /\bprompt\s+injection\b/i,
  /\[system\]\s*:/i,
  /\[user\]\s*:/i,
  /\[assistant\]\s*:/i,
];

/**
 * sanitizeUserInput - main export
 *
 * @param {string} rawText  The raw user prompt from req.body
 * @returns {{
 *   cleanedText:     string,   - text with structural markers stripped
 *   flagged:         boolean,  - true if any INJECTION_PATTERNS matched
 *   matchedPatterns: string[], - human-readable pattern descriptions of each match
 *   tooLong:         boolean,  - true if rawText exceeded MAX_PROMPT_LENGTH
 * }}
 */
export const sanitizeUserInput = (rawText) => {
  if (typeof rawText !== "string") {
    return { cleanedText: "", flagged: false, matchedPatterns: [], tooLong: false };
  }

  // 1. Length check - reject at call site if tooLong
  const tooLong = rawText.length > MAX_PROMPT_LENGTH;
  // Truncate for internal processing only; caller will 400 if tooLong
  const workingText = tooLong ? rawText.slice(0, MAX_PROMPT_LENGTH) : rawText;

  // 2. Strip structural role markers (regex substitution only - not semantic)
  let cleanedText = workingText;
  for (const marker of STRUCTURAL_MARKERS) {
    cleanedText = cleanedText.replace(marker, " ");
  }
  cleanedText = cleanedText.replace(/[ \t]{2,}/g, " ").trim();

  // 3. Scan for injection phrases on ORIGINAL text (before stripping),
  //    so we catch "System: ignore all previous instructions" in full context.
  const matchedPatterns = [];
  for (const pattern of INJECTION_PATTERNS) {
    const m = workingText.match(pattern);
    if (m) {
      matchedPatterns.push(pattern.source);
    }
  }
  const flagged = matchedPatterns.length > 0;

  return { cleanedText, flagged, matchedPatterns, tooLong };
};

export default sanitizeUserInput;
