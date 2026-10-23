import { beforeEach, describe, expect, it } from "vitest";
import {
  commandAliasToolCall,
  commandAliasStorageKey,
  matchCommandAlias,
  readCommandAliases,
  validateCommandAlias,
} from "./commandAliases";

describe("safe command aliases", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes phrases and rejects duplicate aliases", () => {
    const existing = [{ id: "one", phrase: "My College Portal", type: "open_url", target: "https://college.example" }];
    const result = validateCommandAlias({ phrase: "  my   college portal ", type: "open_url", target: "https://other.example" }, existing);
    expect(result.error).toContain("already in use");
  });

  it("accepts only canonical allowlisted applications and standard folders", () => {
    expect(validateCommandAlias({ phrase: "notes", type: "launch_app", target: "notepad" }).alias).toBeTruthy();
    expect(validateCommandAlias({ phrase: "custom app", type: "launch_app", target: "C:\\evil.exe" }).alias).toBeUndefined();
    expect(validateCommandAlias({ phrase: "private folder", type: "open_folder", target: "C:\\Users\\Admin" }).alias).toBeUndefined();
  });

  it("accepts credential-free HTTP(S) URLs and rejects unsafe schemes and embedded credentials", () => {
    expect(validateCommandAlias({ phrase: "portal", type: "open_url", target: "https://example.com" }).alias.target).toBe("https://example.com/");
    expect(validateCommandAlias({ phrase: "script", type: "open_url", target: "javascript:alert(1)" }).alias).toBeUndefined();
    expect(validateCommandAlias({ phrase: "private", type: "open_url", target: "https://user:pass@example.com" }).alias).toBeUndefined();
    expect(validateCommandAlias({ phrase: "local", type: "open_url", target: "http://localhost:3000" }).alias).toBeUndefined();
    expect(validateCommandAlias({ phrase: "private ip", type: "open_url", target: "http://192.168.1.10" }).alias).toBeUndefined();
  });

  it("matches exact English and Hindi command forms only", () => {
    const aliases = [{ id: "one", phrase: "my college portal", type: "open_url", target: "https://college.example/" }];
    expect(matchCommandAlias("Open my college portal", aliases)).toBe(aliases[0]);
    expect(matchCommandAlias("मेरे", aliases)).toBeNull();
    expect(matchCommandAlias("my college portal पर जाओ", aliases)).toBe(aliases[0]);
    expect(matchCommandAlias("open my college portal and delete files", aliases)).toBeNull();
  });

  it("resolves matches only to registered tool names and canonical arguments", () => {
    expect(commandAliasToolCall({ phrase: "notes", type: "launch_app", target: "notepad" })).toEqual({ name: "launch_app", arguments: { app_name: "notepad" } });
    expect(commandAliasToolCall({ phrase: "downloads", type: "open_folder", target: "downloads" })).toEqual({ name: "open_folder", arguments: { folder: "downloads" } });
    expect(commandAliasToolCall({ phrase: "portal", type: "open_url", target: "https://college.example/" })).toEqual({ name: "open_url", arguments: { url: "https://college.example/" } });
    expect(commandAliasToolCall({ phrase: "bad", type: "launch_app", target: "powershell" })).toBeNull();
  });

  it("isolates storage by account and drops malformed or invalid records", () => {
    expect(commandAliasStorageKey("user-a")).not.toBe(commandAliasStorageKey("user-b"));
    localStorage.setItem("alias-test", JSON.stringify([
      { id: "good", phrase: "notes", type: "launch_app", target: "notepad" },
      { id: "bad", phrase: "shell", type: "launch_app", target: "powershell" },
    ]));
    expect(readCommandAliases("alias-test").map((alias) => alias.id)).toEqual(["good"]);
  });
});
