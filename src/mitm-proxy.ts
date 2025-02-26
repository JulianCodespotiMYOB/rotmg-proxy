import * as net from 'net';
import * as tls from 'tls';
import { CustomRC4, CLIENT_SEND_KEY, CLIENT_RECEIVE_KEY, SERVER_SEND_KEY, SERVER_RECEIVE_KEY } from './custom-rc4';
import { createPacket, Packet, PacketIO, PacketType, RC4, Reader, Writer } from 'realmlib/build';
import { PACKET_MAP } from './packet-map';
import { DataPacket } from '../libs/realmlib/build/packet';
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

  private setupTunnel(clientSocket: net.Socket, serverSocket: net.Socket, clientId: string): void {
    // Initialize PacketIO instances using realmlib's implementation.
    const clientIO = new PacketIO({
      socket: clientSocket,
      rc4: CLIENT_TO_SERVER_RC4,  // Use client-to-server config for data coming from client
      packetMap: PACKET_MAP
    });
    const serverIO = new PacketIO({
      socket: serverSocket,
      rc4: SERVER_TO_CLIENT_RC4,  // Use server-to-client config for data coming from server
      packetMap: PACKET_MAP
    });

    // Log and forward packets in both directions.
    Object.values(PacketType).forEach((type) => {

        clientIO.on(type, (packet: Packet) => {
          console.log(`[${clientId}] Client -> Server: ${type}`);
          console.log(packet.toString());
          serverIO.send(packet);
        });
        serverIO.on(type, (packet: Packet) => {
          console.log(`[${clientId}] Server -> Client: ${type}`);
          console.log(packet.toString());
          clientIO.send(packet);
        });
    });
  }


  public close(): void {
    this.server.close(() => {
      console.log('Proxy server closed');
    });
  }
}