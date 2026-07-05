import "dotenv/config";
import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  anomalyZScoreThreshold: Number(process.env.ANOMALY_ZSCORE_THRESHOLD ?? 2.5),
  anomalyMinSamples: Number(process.env.ANOMALY_MIN_SAMPLES ?? 5),
};
