import React, { useState } from "react";
import { LuCopy, LuCheck } from "react-icons/lu";

/**
 * MarkdownRenderer Component
 * Renders structured markdown including headers, lists, code blocks, bold text, and blockquotes
 * with copy-to-clipboard functionality on code snippets.
 */
export function MarkdownRenderer({ content = "" }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!content) return null;

  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split content into blocks (code blocks vs text blocks)
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: "code",
      language: match[1] || "code",
      code: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  // Helper to format inline elements (bold, inline code, links)
  const formatInline = (text) => {
    // Links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const segments = [];
    let currentIdx = 0;
    let linkMatch;

    while ((linkMatch = linkRegex.exec(text)) !== null) {
      if (linkMatch.index > currentIdx) {
        segments.push(renderFormatting(text.slice(currentIdx, linkMatch.index)));
      }
      segments.push(
        <a
          key={linkMatch.index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--land-accent)] hover:underline font-semibold"
        >
          {linkMatch[1]}
        </a>
      );
      currentIdx = linkMatch.index + linkMatch[0].length;
    }

    if (currentIdx < text.length) {
      segments.push(renderFormatting(text.slice(currentIdx)));
    }

    return segments;
  };

  const renderFormatting = (raw) => {
    // Handle inline code `code`, bold **text**, italics *text*
    const tokens = raw.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith("`") && tok.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-[var(--land-bg)] text-cyan-600 dark:text-cyan-300 font-mono text-xs border border-[var(--land-rule)]"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith("**") && tok.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-[var(--land-ink)]">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith("*") && tok.endsWith("*")) {
        return (
          <em key={i} className="italic text-[var(--land-ink-2)]">
            {tok.slice(1, -1)}
          </em>
        );
      }
      return tok;
    });
  };

  // Render text block paragraphs, headers, and bullet lists
  const renderTextBlock = (textBlock, blockIdx) => {
    const lines = textBlock.split("\n");
    const elements = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1.5 my-2 text-[var(--land-ink-2)]">
            {currentList.map((item, idx) => (
              <li key={idx} className="leading-relaxed text-[var(--land-ink)]">
                {formatInline(item)}
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        return;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={lineIdx} className="text-base font-bold text-[var(--land-accent)] mt-3.5 mb-1.5">
            {formatInline(trimmed.slice(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={lineIdx} className="text-lg font-bold text-[var(--land-ink)] mt-4 mb-2">
            {formatInline(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={lineIdx} className="text-xl font-bold text-[var(--land-ink)] mt-4 mb-2">
            {formatInline(trimmed.slice(2))}
          </h1>
        );
      } else if (trimmed.startsWith("> ")) {
        // Blockquote
        flushList();
        elements.push(
          <blockquote
            key={lineIdx}
            className="border-l-4 border-[var(--land-accent)] pl-3 py-1.5 my-2 bg-[var(--land-accent-light)] text-[var(--land-ink)] italic rounded-r text-sm"
          >
            {formatInline(trimmed.slice(2))}
          </blockquote>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        // Bullet list item
        currentList.push(trimmed.slice(2));
      } else if (/^\d+\.\s/.test(trimmed)) {
        // Numbered list item
        currentList.push(trimmed.replace(/^\d+\.\s/, ""));
      } else {
        // Paragraph
        flushList();
        elements.push(
          <p key={lineIdx} className="my-1.5 leading-relaxed text-[var(--land-ink)] text-sm">
            {formatInline(line)}
          </p>
        );
      }
    });

    flushList();
    return <div key={blockIdx}>{elements}</div>;
  };

  return (
    <div className="space-y-3 leading-relaxed">
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <div
              key={index}
              className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#020517] shadow-lg"
            >
              <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/5 text-xs text-gray-400">
                <span className="font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                  {part.language || "code"}
                </span>
                <button
                  onClick={() => handleCopyCode(part.code, index)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                >
                  {copiedIndex === index ? (
                    <>
                      <LuCheck className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <LuCopy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono text-gray-200 leading-relaxed">
                <code>{part.code.trim()}</code>
              </pre>
            </div>
          );
        }
        return renderTextBlock(part.content, index);
      })}
    </div>
  );
}

export default MarkdownRenderer;
