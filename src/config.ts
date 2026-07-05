import "dotenv/config";
import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  ollamaHost: process.env.OLLAMA_HOST ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5",
  anomalyZScoreThreshold: Number(process.env.ANOMALY_ZSCORE_THRESHOLD ?? 2.5),
  anomalyMinSamples: Number(process.env.ANOMALY_MIN_SAMPLES ?? 5),
};
