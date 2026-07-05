import "dotenv/config";
import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
};
