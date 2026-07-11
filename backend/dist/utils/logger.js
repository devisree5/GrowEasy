"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}`;
    }
    info(message, meta) {
        console.log(this.formatMessage('INFO', message, meta));
    }
    warn(message, meta) {
        console.warn(this.formatMessage('WARN', message, meta));
    }
    error(message, meta) {
        console.error(this.formatMessage('ERROR', message, meta));
    }
    debug(message, meta) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(this.formatMessage('DEBUG', message, meta));
        }
    }
}
exports.logger = new Logger();
