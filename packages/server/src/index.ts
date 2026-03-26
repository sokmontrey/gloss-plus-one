import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = buildApp();
app.listen(env.port, () => {
  console.log(`Listening on ${env.port}`);
});
