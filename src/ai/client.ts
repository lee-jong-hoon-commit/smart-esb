import { config } from "../config.js";

export async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaHost}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function askForJson(prompt: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${config.ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        format: "json",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(
      `Ollama(${config.ollamaHost})에 연결할 수 없습니다. 로컬에 Ollama가 실행 중인지 확인하세요. (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama 호출 실패: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? "";
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(jsonText);
}
