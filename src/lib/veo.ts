import { GoogleGenAI } from "@google/genai";

/** Create client with user's API key (multi-user mode) */
export function getClient(apiKey: string) {
  if (!apiKey || apiKey.trim().length < 20) {
    throw new Error("Invalid API key");
  }
  return new GoogleGenAI({ apiKey });
}
