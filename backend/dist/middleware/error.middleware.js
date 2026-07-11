"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || 'An unexpected error occurred on the server.';
    logger_1.logger.error(`Exception caught: ${message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(status).json({
        error: message,
        status,
        timestamp: new Date().toISOString(),
    });
}
