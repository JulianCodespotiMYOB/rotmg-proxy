// simple-proxy.ts - A simplified proxy using our custom RC4 implementation

import * as net from 'net';
import { CustomRC4, CLIENT_SEND_KEY, CLIENT_RECEIVE_KEY, SERVER_SEND_KEY, SERVER_RECEIVE_KEY } from './custom-rc4';
import { RC4 } from 'realmlib/build';

const PROXY_PORT = 2050;
const GAME_SERVER_HOST = '52.63.175.117'; // From the Python code
const GAME_SERVER_PORT = 2050;

/**
 * Simple ROTMG MITM proxy using custom RC4 implementation
 */
class SimpleRotmgProxy {
  private server: net.Server;

  constructor() {
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  /**
   * Start the proxy server
   */
  public start(): void {
    this.server.listen(PROXY_PORT, () => {
      console.log(`Simple ROTMG Proxy listening on port ${PROXY_PORT}`);
      console.log(`Connect your ROTMG client to localhost:${PROXY_PORT}`);
    });
  }

  /**
   * Handle a new client connection
   */
  private handleConnection(clientSocket: net.Socket): void {
    console.log(`Client connected from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

    // Connect to the game server
    const serverSocket = net.connect({
      host: GAME_SERVER_HOST,
      port: GAME_SERVER_PORT
    }, () => {
      console.log(`Connected to game server at ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}`);
    });

    // Create RC4 ciphers
    const clientToServerCipher = new RC4(CLIENT_SEND_KEY);
    const serverToClientCipher = new RC4(SERVER_SEND_KEY);

    function inspectPacketHeader(data: Buffer): void {
      console.log('Packet Header Bytes:');
      console.log(`[0]: ${data[0].toString(16).padStart(2, '0')} (${data[0]})`);
      console.log(`[1]: ${data[1].toString(16).padStart(2, '0')} (${data[1]})`);
      console.log(`[2]: ${data[2].toString(16).padStart(2, '0')} (${data[2]})`);
      console.log(`[3]: ${data[3].toString(16).padStart(2, '0')} (${data[3]})`);
      console.log(`[4]: ${data[4].toString(16).padStart(2, '0')} (${data[4]})`);
    }

    // Handle client data (client -> server)
    clientSocket.on('data', (data) => {
      try {
        inspectPacketHeader(data);
        if (data.length > 4 &&
          data[0] === 67 && // 'C'
          data[1] === 79 && // 'O'
          data[2] === 78 && // 'N'
          data[3] === 78) { // 'N'

        // This appears to be a text protocol message
        const textMessage = data.toString('utf8');
        console.log('Text Protocol Message:', textMessage);

        // Forward without any RC4 processing
        serverSocket.write(data);
        return;
      }
        if (data.length < 5) {
          console.log('Received incomplete packet header');
          return;
        }
        const packetSize = data.readInt32BE(0);
        if (packetSize < 5 || packetSize > 100000) { // Reasonable limits
          console.log(`Likely invalid packet size: ${packetSize}, using actual length: ${data.length}`);
          // Continue processing with the actual length
        } else if (packetSize !== data.length) {
          console.log(`Packet size mismatch. Reported: ${packetSize}, Actual: ${data.length}`);
        }
        if (packetSize !== data.length) {
          console.log(`Warning: Packet size mismatch. Reported: ${packetSize}, Actual: ${data.length}`);
        }

        // Only decrypt the data part (after the 5-byte header)
        if (data.length > 5) {
          const dataToDecrypt = data.subarray(5);
          clientToServerCipher.cipher(dataToDecrypt);

          // Log packet info (packet ID is at byte 4)
          const packetId = data[4];
          console.log(`Client -> Server: Packet ID ${packetId}, Length ${data.length}`);

          // Re-encrypt for sending to server
          clientToServerCipher.reset(); // Reset to ensure consistent state
          clientToServerCipher.cipher(dataToDecrypt);
        }

        // Forward to server
        serverSocket.write(data);
      } catch (error) {
        console.error('Error processing client data:', error);
      }
    });

    // Handle server data (server -> client)
    serverSocket.on('data', (data) => {
      try {
        const packetSize = data.readInt32BE(0);
        if (packetSize !== data.length) {
          console.log(`Warning: Packet size mismatch. Reported: ${packetSize}, Actual: ${data.length}`);
        }

        // Only decrypt the data part (after the 5-byte header)
        if (data.length > 5) {
          const dataToDecrypt = data.subarray(5);
          serverToClientCipher.cipher(dataToDecrypt);

          // Log packet info (packet ID is at byte 4)
          const packetId = data[4];
          console.log(`Server -> Client: Packet ID ${packetId}, Length ${data.length}`);

          // Re-encrypt for sending to client
          serverToClientCipher.reset(); // Reset to ensure consistent state
          serverToClientCipher.cipher(dataToDecrypt);
        }

        // Forward to client
        clientSocket.write(data);
      } catch (error) {
        console.error('Error processing server data:', error);
      }
    });

    // Handle errors and connection close
    clientSocket.on('error', (err) => {
      console.error('Client socket error:', err);
      serverSocket.end();
    });

    serverSocket.on('error', (err) => {
      console.error('Server socket error:', err);
      clientSocket.end();
    });

    clientSocket.on('close', () => {
      console.log('Client socket closed');
      serverSocket.end();
    });

    serverSocket.on('close', () => {
      console.log('Server socket closed');
      clientSocket.end();
    });
  }
}

// Create and start the proxy
const proxy = new SimpleRotmgProxy();
proxy.start();

console.log('ROTMG Simple Proxy started');
console.log('Using RC4 keys from Python implementation:');
console.log(`Client Send Key: ${CLIENT_SEND_KEY}`);
console.log(`Client Receive Key: ${CLIENT_RECEIVE_KEY}`);
console.log(`Server Send Key: ${SERVER_SEND_KEY}`);
console.log(`Server Receive Key: ${SERVER_RECEIVE_KEY}`);