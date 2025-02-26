// index.ts - Main entry point
import { RotmgMitmProxy } from './mitm-proxy';
import { ProxyCliInterface } from './cli';
import CONFIG from './config';

console.log(`
==========================================================
                ROTMG Proxy (TypeScript)
==========================================================
`);

try {
  const proxy = new RotmgMitmProxy({
    enableLogging: CONFIG.logging.enabled,
    preferredServer: CONFIG.server?.preferred,
    credentials: CONFIG.credentials
  });

  const cli = new ProxyCliInterface();

  proxy.start(CONFIG.port);

  process.on('SIGINT', () => {
    console.log('\nShutting down proxy...');
    proxy.close();
    process.exit(0);
  });

  console.log(`
Proxy successfully started!
Listening on: localhost:${CONFIG.port}

To use this proxy:
1. Configure your client to use localhost:${CONFIG.port} as an HTTP proxy.
2. Launch your ROTMG client.
3. All traffic will be intercepted and logged.

Type 'help' for available commands.
==========================================================
`);

} catch (error) {
  console.error('Failed to start proxy:', error);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
