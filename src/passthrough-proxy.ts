import * as net from 'net';
import { PACKET_MAP } from './stuff not being used/packet-map';
import { AutoAim, AutoAimConfig } from './modules/autoaim';
import { EntityTracker } from './modules/entity-tracker';
import { PacketModifier } from './modules/packet-modifier';
import { logPacket } from './utils/logger';

export class RotmgPassthroughProxy {
  private server: net.Server;
  private port: number;
  private packetSequence: any[] = [];
  private serverSocket: net.Socket | null = null;
  private packetStats: Map<string, number> = new Map();

  // Module instances
  private entityTracker: EntityTracker;
  private autoAim: AutoAim;
  private packetModifier: PacketModifier;

  constructor(port: number = 2050, autoAimConfig: AutoAimConfig) {
    this.port = port;
    this.server = net.createServer(this.handleConnection.bind(this));

    // Initialize modules
    this.entityTracker = new EntityTracker();
    this.autoAim = new AutoAim(this.entityTracker, autoAimConfig);
    this.packetModifier = new PacketModifier(this.autoAim);
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`ROTMG Passthrough Proxy listening on port ${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error('Proxy server error:', err);
    });
  }


  public close(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Proxy server closed');
      });
    }
  }

  // Show packet statistics
  public printStats(): void {
    console.log("\n--- Packet Statistics ---");

    // Sort by frequency
    const sortedStats = [...this.packetStats.entries()]
      .sort((a, b) => b[1] - a[1]);

    for (const [type, count] of sortedStats) {
      console.log(`${type}: ${count}`);
    }
    console.log("------------------------\n");
  }

  private handleConnection(clientSocket: net.Socket): void {
    const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`.split(':').pop();
    console.log(`Client connected: ${clientId}`);

    // Reset state for new connection
    this.packetSequence = [];
    this.packetStats.clear();

    // Wait for initial data
    clientSocket.once('data', (data) => {
      const header = data.toString('utf8', 0, Math.min(data.length, 200));

      // Check if it's an HTTP CONNECT request
      if (header.startsWith('CONNECT')) {
        this.handleHttpConnect(clientSocket, data);
      } else {
        this.handleDirectConnection(clientSocket, data);
      }
    });

    clientSocket.on('error', (err) => {
      console.error(`Client socket error (${clientId}):`, err);
    });

    clientSocket.on('close', () => {
      console.log(`Client socket closed for ${clientId}`);
      this.printStats(); // Print stats on disconnect
      this.cleanup();
    });
  }

  private handleHttpConnect(clientSocket: net.Socket, initialData: Buffer): void {
    const header = initialData.toString('utf8', 0, Math.min(initialData.length, 200));
    const match = header.match(/CONNECT\s+([^:]+):(\d+)/);

    if (!match) {
      console.error('Invalid CONNECT request format');
      clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    const targetHost = match[1];
    const targetPort = parseInt(match[2], 10);
    console.log(`Client wants to connect to ${targetHost}:${targetPort}`);

    // Connect to the target server
    const serverSocket = net.connect(targetPort, targetHost, () => {
      console.log(`Connected to game server at ${targetHost}:${targetPort}`);

      // Send success response to client
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      // Setup direct proxy without any packet processing
      this.setupDirectProxy(clientSocket, serverSocket);
    });

    serverSocket.on('error', (err) => {
      console.error('Server socket error:', err);
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    serverSocket.on('close', () => {
      console.log('Server socket closed');
      this.cleanup();
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });
  }

  private handleDirectConnection(clientSocket: net.Socket, initialData: Buffer): void {
    // For direct connections, connect to a known game server
    const targetHost = '54.79.72.84'; // Default to a known server IP
    const targetPort = 2050;

    console.log(`Direct connection detected, connecting to ${targetHost}:${targetPort}`);

    const serverSocket = net.connect(targetPort, targetHost, () => {
      console.log(`Connected to game server at ${targetHost}:${targetPort}`);


      // If we have initial data, send it to the server
      if (initialData.length > 0) {
        serverSocket.write(initialData);
        logPacket(initialData, true, this.packetStats, this.packetSequence);
      }

      // Setup direct proxy without any packet processing
      this.setupDirectProxy(clientSocket, serverSocket);
    });

    serverSocket.on('error', (err) => {
      console.error('Server socket error:', err);
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    serverSocket.on('close', () => {
      console.log('Server socket closed');
      this.cleanup();
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });
  }

  private setupDirectProxy(clientSocket: net.Socket, serverSocket: net.Socket): void {
    // Store server socket for potential auto-responses
    this.serverSocket = serverSocket;

    // Handle client to server data - process and potentially modify
    clientSocket.on('data', (data) => {
      try {
        // Extract packet info
        const packetId = data.length >= 5 ? data[4] : -1;

        // Log the original packet
        logPacket(data, true, this.packetStats, this.packetSequence);

        // Pass to entity tracker for processing
        this.entityTracker.processPacket(packetId, data, false);

        // Apply autoaim if it's a PLAYERSHOOT packet (ID 30)
        let processedData = data;
        if (packetId === 30) { // PLAYERSHOOT
          processedData = this.packetModifier.modifyPlayerShootPacket(data);
        }

        // Forward the possibly modified data
        if (serverSocket.writable) {
          serverSocket.write(processedData);
        }
      } catch (error) {
        console.error('Error processing client data:', error);
        // Forward the original unmodified data as fallback
        if (serverSocket.writable) {
          serverSocket.write(data);
        }
      }
    });

    // Handle server to client data - process for entity tracking
    serverSocket.on('data', (data) => {
      try {
        // Extract packet info for logging
        const packetId = data.length >= 5 ? data[4] : -1;

        // Log the packet
        logPacket(data, false, this.packetStats, this.packetSequence);

        // Pass to entity tracker for processing
        this.entityTracker.processPacket(packetId, data, true);

        // Forward unchanged
        if (clientSocket.writable) {
          clientSocket.write(data);
        }
      } catch (error) {
        console.error('Error processing server data:', error);
        // Forward the original data as fallback
        if (clientSocket.writable) {
          clientSocket.write(data);
        }
      }
    });
    // Handle socket closures
    clientSocket.on('close', () => {
      console.log('Client socket closed');
      this.cleanup();
      if (!serverSocket.destroyed) {
        serverSocket.end();
      }
    });

    serverSocket.on('close', () => {
      console.log('Server socket closed');
      this.cleanup();
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });
  }

  private cleanup(): void {
    // Keep the packet sequence and stats for debugging
  }

  // Update autoaim configuration
  updateAutoAimConfig(config: Partial<AutoAimConfig>): void {
    this.autoAim.updateConfig(config);
  }

  // Enable/disable autoaim
  setAutoAimEnabled(enabled: boolean): void {
    this.autoAim.updateConfig({ enabled });
  }

  // Change targeting strategy
  setTargetingStrategy(strategy: string): void {
    this.autoAim.updateConfig({ targetingStrategy: strategy });
  }
}