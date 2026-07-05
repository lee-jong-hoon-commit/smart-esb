import { config } from "./config.js";
import { createServer } from "./server.js";

const app = createServer();

app.listen(config.port, () => {
  console.log(`smart-esb listening on http://localhost:${config.port}`);
});
