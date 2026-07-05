import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

let client: Anthropic | null = null;

export function isAiEnabled(): boolean {
  return Boolean(config.anthropicApiKey);
}

export function getAnthropicClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env를 확인하세요.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export async function askForJson(prompt: string): Promise<unknown> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(jsonText);
}
