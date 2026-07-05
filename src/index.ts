import { config } from "./config.js";
import { refreshScheduler } from "./core/scheduler.js";
import { createServer } from "./server.js";

const app = createServer();

await refreshScheduler();

app.listen(config.port, () => {
  console.log(`smart-esb listening on http://localhost:${config.port}`);
});
