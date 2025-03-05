import * as net from 'net';
import * as tls from 'tls';
import { CustomRC4, CLIENT_SEND_KEY, CLIENT_RECEIVE_KEY, SERVER_SEND_KEY, SERVER_RECEIVE_KEY } from './custom-rc4';
import { createPacket, Packet, PacketIO, PacketType, RC4, Reader, Writer } from 'realmlib/build';
import { PACKET_MAP } from './packet-map';
import { DataPacket } from '../../libs/realmlib/build/packet';
import { CLIENT_TO_SERVER_RC4, SERVER_TO_CLIENT_RC4 } from './rc4-config';
// (Assume that your PACKET_MAP and related packet parsing logic are defined elsewhere if needed)

/**
 * Options for the proxy.
 */
export interface ProxyOptions {
  enableLogging?: boolean;
  preferredServer?: string;
  credentials: {
    email: string;
    password: string;
  };
}

/**
 * A ROTMG MITM proxy that performs an HTTP CONNECT handshake,
 * then sets up a manual tunnel that buffers full packets before processing.
 */
export class RotmgMitmProxy {
  private server: net.Server;
  private options: ProxyOptions;

  constructor(options: ProxyOptions) {
    this.options = options;
    // Create a TCP server that will wait for HTTP CONNECT
    this.server = net.createServer((clientSocket) => this.handleConnection(clientSocket));
  }

  public start(port: number): void {
    this.server.listen(port, () => {
      console.log(`MITM proxy listening on port ${port}`);
      console.log(`Configure your client to use HTTP proxy at localhost:${port}`);
    });

    this.server.on('error', (err) => {
      console.error('Proxy server error:', err);
    });
  }

  private handleConnection(clientSocket: net.Socket): void {
    const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`.split(':').pop();

    console.log(`Client connected: ${clientId}`);

    // Wait for the HTTP CONNECT handshake.
    clientSocket.once('data', (data: Buffer) => {
      const headerEnd = data.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        console.error("Invalid HTTP header received.");
        clientSocket.end();
        return;
      }

      const headerBuf = data.subarray(0, headerEnd + 4);
      const leftover = data.subarray(headerEnd + 4);
      const header = headerBuf.toString('utf8');
      console.log(`Received from client: ${header}`);

      // Parse CONNECT request.
      const match = header.match(/CONNECT\s+([^:]+):(\d+)/);
      if (!match) {
        console.error('Invalid CONNECT request format');
        clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      const targetHost = match[1];
      const targetPort = parseInt(match[2], 10);
      console.log(`Client wants to connect to ${targetHost}:${targetPort}`);

      let serverSocket: net.Socket;
      const onConnect = () => {
        console.log(`TCP connection established to ${targetHost}:${targetPort} for client ${clientId}`);
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (leftover.length > 0) {
          clientSocket.unshift(leftover);
        }
        // In this version we immediately start the manual tunnel.
        this.setupTunnel(clientSocket, serverSocket, clientId);
      };

      if (targetPort === 443) {
        serverSocket = tls.connect({
          host: targetHost,
          port: targetPort,
          rejectUnauthorized: true
        }, onConnect);
        console.log(`TLS connection established to ${targetHost}:${targetPort} for client ${clientId}`);
      } else {
        console.log(`TCP connection to ${targetHost}:${targetPort} for client ${clientId}`);
        serverSocket = net.connect(targetPort, targetHost, onConnect);
      }

      serverSocket.on('error', (err) => {
        console.error(`Server socket error for client ${clientId}:`, err);
        clientSocket.end();
      });
      serverSocket.on('close', () => {
        console.log(`Server socket for client ${clientId} closed.`);
        clientSocket.end();
      });
    });

    clientSocket.on('error', (err) => {
      console.error(`Client socket error (${clientId}):`, err);
    });
    clientSocket.on('close', () => {
      console.log(`Client socket closed for ${clientId}`);
    });
  }

  /**
   * Sets up the manual tunnel between client and server.
   * This version uses a simple buffering approach similar to KRelay’s.
   */
// Modified version of mitm-proxy.ts

private setupTunnel(clientSocket: net.Socket, serverSocket: net.Socket, clientId: string): void {
  // We'll still use PacketIO but we'll add better error handling
  try {
    const clientIO = new PacketIO({
      socket: clientSocket,
      rc4: CLIENT_TO_SERVER_RC4,
      packetMap: PACKET_MAP
    });

    const serverIO = new PacketIO({
      socket: serverSocket,
      rc4: SERVER_TO_CLIENT_RC4,
      packetMap: PACKET_MAP
    });

    // Add error handlers to prevent crashes
    clientIO.on('error', (err) => {
      console.error(`[${clientId}] Client PacketIO error:`, err);
      // Just log and continue, don't crash
    });

    serverIO.on('error', (err) => {
      console.error(`[${clientId}] Server PacketIO error:`, err);
      // Just log and continue, don't crash
    });

    // Register for all packet types
    Object.values(PacketType).forEach((type) => {
      try {
        clientIO.on(type, (packet: Packet) => {
          try {
            console.log(`[${clientId}] Client -> Server: ${type}`);
            console.log(packet.toString());
            serverIO.send(packet);
          } catch (error) {
            console.error(`Error handling client packet of type ${type}:`, error);
            // Just forward the raw data if parsing fails
            if (serverSocket.writable) {
              serverSocket.write(clientSocket.read());
            }
          }
        });

        serverIO.on(type, (packet: Packet) => {
          try {
            console.log(`[${clientId}] Server -> Client: ${type}`);
            console.log(packet.toString());
            clientIO.send(packet);
          } catch (error) {
            console.error(`Error handling server packet of type ${type}:`, error);
            // Just forward the raw data if parsing fails
            if (clientSocket.writable) {
              clientSocket.write(serverSocket.read());
            }
          }
        });
      } catch (error) {
        console.error(`Error registering handler for packet type ${type}:`, error);
      }
    });
  } catch (error) {
    console.error(`Error setting up packet handling for client ${clientId}:`, error);

    // Fall back to simple pass-through if PacketIO setup fails
    console.log(`Falling back to simple pass-through for client ${clientId}`);

    clientSocket.on('data', (data) => {
      if (serverSocket.writable) {
        serverSocket.write(data);
      }
    });

    serverSocket.on('data', (data) => {
      if (clientSocket.writable) {
        clientSocket.write(data);
      }
    });
  }
}


  public close(): void {
    this.server.close(() => {
      console.log('Proxy server closed');
    });
  }
}