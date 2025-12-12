/**
 * Logger utility for consistent console output
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;

    switch (level) {
      case 'debug':
        return `${chalk.gray(prefix)} ${chalk.blue('[DEBUG]')} ${message}`;
      case 'info':
        return `${chalk.gray(prefix)} ${chalk.green('[INFO]')} ${message}`;
      case 'warn':
        return `${chalk.gray(prefix)} ${chalk.yellow('[WARN]')} ${message}`;
      case 'error':
        return `${chalk.gray(prefix)} ${chalk.red('[ERROR]')} ${message}`;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }
}

export const logger = new Logger();

// Enable debug logging if DEBUG env var is set
if (process.env.DEBUG) {
  logger.setLevel('debug');
}
