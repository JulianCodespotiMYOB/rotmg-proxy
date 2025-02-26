// cli.ts
import readline from 'readline';
import { PacketType, createPacket } from 'realmlib/build';

/**
 * This class provides a simple command-line interface for interacting with
 * the proxy while it's running.
 */
export class ProxyCliInterface {
  private rl: readline.Interface;
  private clientIOs: Map<string, any> = new Map(); // Store active client connections

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'rotmg-proxy> '
    });

    this.setupCommandHandlers();
  }

  public registerClient(clientId: string, clientIO: any): void {
    this.clientIOs.set(clientId, clientIO);
    console.log(`Client ${clientId} registered with CLI`);
  }

  public unregisterClient(clientId: string): void {
    this.clientIOs.delete(clientId);
    console.log(`Client ${clientId} unregistered from CLI`);
  }

  private setupCommandHandlers(): void {
    this.rl.prompt();

    this.rl.on('line', (line) => {
      const trimmedLine = line.trim();
      const [command, ...args] = trimmedLine.split(' ');

      switch (command.toLowerCase()) {
        case 'help':
          this.showHelp();
          break;
        case 'clients':
          this.listClients();
          break;
        case 'inject':
          this.injectPacket(args);
          break;
        case 'disconnect':
          this.disconnectClient(args[0]);
          break;
        case 'exit':
        case 'quit':
          console.log('Exiting proxy...');
          process.exit(0);
          break;
        default:
          if (trimmedLine) {
            console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
          }
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('Exiting proxy...');
      process.exit(0);
    });
  }

  private showHelp(): void {
    console.log('\nAvailable commands:');
    console.log('  help                  - Show this help');
    console.log('  clients               - List connected clients');
    console.log('  inject <client> <type> - Inject a packet to a client');
    console.log('  disconnect <client>   - Disconnect a client');
    console.log('  exit, quit            - Exit the proxy\n');
  }

  private listClients(): void {
    if (this.clientIOs.size === 0) {
      console.log('No clients connected.');
      return;
    }

    console.log('\nConnected clients:');
    for (const clientId of this.clientIOs.keys()) {
      console.log(`  ${clientId}`);
    }
    console.log('');
  }

  private injectPacket(args: string[]): void {
    if (args.length < 2) {
      console.log('Usage: inject <client> <packet-type>');
      return;
    }

    const clientId = args[0];
    const packetType = args[1].toUpperCase() as keyof typeof PacketType;
    const clientIO = this.clientIOs.get(clientId);

    if (!clientIO) {
      console.log(`No client found with ID: ${clientId}`);
      return;
    }

    if (!PacketType[packetType]) {
      console.log(`Unknown packet type: ${packetType}`);
      return;
    }

    try {
      // Create and send the packet
      const packet = createPacket(PacketType[packetType]);

      // You might want to set some properties on the packet here
      // For example: packet.someProperty = someValue;

      clientIO.send(packet);
      console.log(`Injected ${packetType} packet to client ${clientId}`);
    } catch (error) {
      console.error(`Error injecting packet:`, error);
    }
  }

  private disconnectClient(clientId: string): void {
    if (!clientId) {
      console.log('Usage: disconnect <client>');
      return;
    }

    const clientIO = this.clientIOs.get(clientId);
    if (!clientIO) {
      console.log(`No client found with ID: ${clientId}`);
      return;
    }

    try {
      // Assuming clientIO has a socket property
      if (clientIO.socket) {
        clientIO.socket.end();
        console.log(`Disconnected client ${clientId}`);
      }
    } catch (error) {
      console.error(`Error disconnecting client:`, error);
    }
  }
}