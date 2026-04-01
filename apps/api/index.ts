import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createRoutes } from "./src/routes.js";
import { createEnv } from "./src/env.js";

const env = createEnv();

const app = express();

app.set("trust proxy", 1);

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
    }),
);

app.use(
    cors({
        origin:
            env.CORS_ORIGINS.length > 0
                ? env.CORS_ORIGINS
                : false,
        credentials: true,
    }),
);

app.use(cookieParser());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use("/api", createRoutes(env));

app.listen(env.PORT, () => {
    console.log(`api listening on port ${env.PORT}`);
});
