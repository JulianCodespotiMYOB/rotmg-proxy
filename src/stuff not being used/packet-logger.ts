import * as fs from 'fs';
import * as path from 'path';
import { Packet } from 'realmlib/build';

/**
 * A utility class for logging packets to files for analysis
 */
export class PacketLogger {
  private logDir: string;
  private clientToServerLog: fs.WriteStream;
  private serverToClientLog: fs.WriteStream;

  constructor(logDirName: string = 'packet_logs') {
    // Create the logging directory
    this.logDir = path.join(process.cwd(), logDirName);
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create log timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');

    // Create the log files
    this.clientToServerLog = fs.createWriteStream(
      path.join(this.logDir, `client_to_server_${timestamp}.log`),
      { flags: 'a' }
    );

    this.serverToClientLog = fs.createWriteStream(
      path.join(this.logDir, `server_to_client_${timestamp}.log`),
      { flags: 'a' }
    );

    console.log(`Packet logging enabled. Logs will be saved to: ${this.logDir}`);
  }

  /**
   * Log a packet from client to server
   */
  public logClientToServer(packet: Packet, rawData?: Buffer): void {
    try {
      const timestamp = new Date().toISOString();
      const packetInfo = this.formatPacketInfo(packet, rawData);

      this.clientToServerLog.write(
        `[${timestamp}] CLIENT -> SERVER | ${packetInfo}\n`
      );
    } catch (error) {
      console.error('Error logging client packet:', error);
    }
  }

  /**
   * Log a packet from server to client
   */
  public logServerToClient(packet: Packet, rawData?: Buffer): void {
    try {
      const timestamp = new Date().toISOString();
      const packetInfo = this.formatPacketInfo(packet, rawData);

      this.serverToClientLog.write(
        `[${timestamp}] SERVER -> CLIENT | ${packetInfo}\n`
      );
    } catch (error) {
      console.error('Error logging server packet:', error);
    }
  }

  /**
   * Format packet information for logging
   */
  private formatPacketInfo(packet: Packet, rawData?: Buffer): string {
    let packetStr = `Type: ${packet.type}`;

    // Add packet properties
    const packetObj = packet as any;
    const properties = Object.keys(packetObj)
      .filter(key => key !== 'type' && key !== 'propagate')
      .map(key => {
        let value = packetObj[key];

        // Handle special cases
        if (Buffer.isBuffer(value)) {
          value = `<Buffer: ${value.length} bytes>`;
        } else if (Array.isArray(value)) {
          value = `<Array: ${value.length} items>`;
        } else if (typeof value === 'object' && value !== null) {
          try {
            value = JSON.stringify(value);
          } catch (e) {
            value = `<Object>`;
          }
        }

        return `${key}: ${value}`;
      })
      .join(', ');

    if (properties) {
      packetStr += ` | ${properties}`;
    }

    // Add raw data if available
    if (rawData) {
      const hexData = rawData.toString('hex');
      packetStr += ` | Raw: ${hexData}`;
    }

    return packetStr;
  }

  /**
   * Close the log files
   */
  public close(): void {
    this.clientToServerLog.end();
    this.serverToClientLog.end();
    console.log('Packet logs closed.');
  }
}

export default PacketLogger;