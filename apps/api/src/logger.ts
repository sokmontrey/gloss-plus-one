import type { Request, Response } from "express";
import pino, { type Logger } from "pino";
import { pinoHttp } from "pino-http";

export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
});

export const requestLogger = pinoHttp({
    logger,
    customLogLevel(_req: Request, res: Response, err?: Error) {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
    customSuccessMessage(req: Request, res: Response) {
        return `${req.method} ${req.url} completed with ${res.statusCode}`;
    },
    customErrorMessage(req: Request, res: Response, err: Error) {
        return `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
    },
});

export type RequestWithLogger = Request & {
    log?: Logger;
};
