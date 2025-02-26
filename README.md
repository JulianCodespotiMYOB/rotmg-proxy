# ROTMG Proxy

A man-in-the-middle proxy for Realm of the Mad God, built with TypeScript.

## Overview

This project implements a proxy server that sits between the ROTMG client and the game servers, allowing you to:

- Intercept and analyze network traffic
- Modify packets in transit
- Inject custom packets
- Log all game communication

## Features

- **Packet Interception**: Capture and log all game traffic
- **Packet Modification**: Alter packet contents before they reach the client or server
- **Command Line Interface**: Interact with the proxy while it's running
- **Packet Logging**: Save packet data to files for later analysis

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/rotmg-proxy.git
   cd rotmg-proxy
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

## Usage

1. Start the proxy:
   ```
   npm start
   ```

2. Configure your ROTMG client to connect to `localhost:2050` instead of the official servers. This can be done using:
   - A hosts file modification
   - A DNS redirector
   - Setting up a proxy in your networking settings

3. Launch the ROTMG client and play as normal. All traffic will be routed through the proxy.

## Command Line Interface

While the proxy is running, you can use these commands:

- `help` - Show available commands
- `clients` - List connected clients
- `inject <client> <packet-type>` - Inject a packet to a client
- `disconnect <client>` - Disconnect a client
- `exit` or `quit` - Exit the proxy

## Project Structure

- `src/mitm-proxy.ts` - The main proxy implementation
- `src/packet-map.ts` - Mapping between packet IDs and packet types
- `src/packet-logger.ts` - Utility for logging packets to files
- `src/cli.ts` - Command line interface for the proxy

## Security Considerations

This tool is intended for educational purposes and personal use only. Please respect the ROTMG Terms of Service and:

- Don't use this tool to gain unfair advantages
- Don't use it to automate gameplay or create bots
- Don't distribute modified clients to others

## Disclaimer

This project is not affiliated with DECA Games or Realm of the Mad God. Use at your own risk.

## License

This project is licensed under the MIT License - see the LICENSE file for details.