export function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function logWarn(message: string): void {
  process.stderr.write(`${message}\n`);
}
