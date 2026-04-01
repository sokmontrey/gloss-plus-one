import "dotenv/config"
import { env } from "@gloss/env"
import { createApp } from "./app.js"

const app = createApp(env)
app.listen(env.PORT, () => {
    console.log(`api listening on ${env.PORT}`)
})
