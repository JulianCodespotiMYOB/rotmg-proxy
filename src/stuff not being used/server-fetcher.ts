import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import { AuthService } from './auth-service';

// Types for the server list
export interface ServerInfo {
  Name: string;
  DNS: string;
  Port?: number; // Some servers might have different ports
  Lat: string;
  Long: string;
  Usage: string;
}

/**
 * Service for fetching the RotMG server list
 */
export class ServerFetcher {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * Fetch the current list of game servers
   */
  public async fetchServerList(): Promise<ServerInfo[]> {
    try {
      // Get authentication post data with valid token
      const postData = await this.authService.getServerListPostData();

      const options = {
        hostname: 'www.realmofthemadgod.com',
        port: 443,
        path: '/account/servers',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'UnityPlayer/2019.4.9f1 (UnityWebRequest/1.0, libcurl/7.52.0-DEV)',
        },
      };

      return new Promise<ServerInfo[]>((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', async () => {
            try {
              // Check for successful response
              if (res.statusCode !== 200) {
                console.error(`Server list request failed with status ${res.statusCode}:`, data);
                return reject(new Error(`HTTP error ${res.statusCode}`));
              }

              console.log('Raw server list response:', data);

              // Parse the XML response
              const result = await parseStringPromise(data, { explicitArray: false });

              // Validate the response structure
              if (!result || !result.Servers || !result.Servers.Server) {
                console.warn('Unexpected server list format:', result);
                return resolve([]);
              }

              // Extract and normalize the server list
              const servers = result.Servers.Server;
              const serverList: ServerInfo[] = Array.isArray(servers) ? servers : [servers];

              console.log(`Fetched ${serverList.length} servers successfully`);
              resolve(serverList);
            } catch (e) {
              console.error('Error parsing server list XML:', e);
              reject(e);
            }
          });
        });

        req.on('error', (e) => {
          console.error('Error fetching server list:', e);
          reject(e);
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      console.error('Failed to fetch server list:', error);
      throw error;
    }
  }

  /**
   * Choose a preferred server from the list
   * @param preferredName Optional preferred server name
   */
  public async getPreferredServer(preferredName?: string): Promise<{ host: string; port: number }> {
    try {
      const servers = await this.fetchServerList();

      if (servers.length === 0) {
        throw new Error('No servers available');
      }

      let preferred: ServerInfo;

      // Try to find the preferred server by name if specified
      if (preferredName) {
        preferred = servers.find(s => s.Name.toLowerCase() === preferredName.toLowerCase()) || servers[0];
      } else {
        // Find server with lowest usage
        preferred = servers.sort((a, b) => {
          const usageA = parseFloat(a.Usage) || 0;
          const usageB = parseFloat(b.Usage) || 0;
          return usageA - usageB;
        })[0];
      }

      const port = preferred.Port || 2050; // Default port is 2050 if not specified

      console.log(`Selected server: ${preferred.Name} (${preferred.DNS}:${port}) - Usage: ${preferred.Usage}`);
      return { host: preferred.DNS, port };
    } catch (e) {
      console.error('Error getting preferred server, using fallback:', e);
      // Fallback to a known server. These details might change!
      return { host: '54.86.47.176', port: 2050 };
    }
  }
}