"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerFetcher = void 0;
const https = __importStar(require("https"));
const xml2js_1 = require("xml2js");
/**
 * Service for fetching the RotMG server list
 */
class ServerFetcher {
    constructor(authService) {
        this.authService = authService;
    }
    /**
     * Fetch the current list of game servers
     */
    async fetchServerList() {
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
            return new Promise((resolve, reject) => {
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
                            const result = await (0, xml2js_1.parseStringPromise)(data, { explicitArray: false });
                            // Validate the response structure
                            if (!result || !result.Servers || !result.Servers.Server) {
                                console.warn('Unexpected server list format:', result);
                                return resolve([]);
                            }
                            // Extract and normalize the server list
                            const servers = result.Servers.Server;
                            const serverList = Array.isArray(servers) ? servers : [servers];
                            console.log(`Fetched ${serverList.length} servers successfully`);
                            resolve(serverList);
                        }
                        catch (e) {
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
        }
        catch (error) {
            console.error('Failed to fetch server list:', error);
            throw error;
        }
    }
    /**
     * Choose a preferred server from the list
     * @param preferredName Optional preferred server name
     */
    async getPreferredServer(preferredName) {
        try {
            const servers = await this.fetchServerList();
            if (servers.length === 0) {
                throw new Error('No servers available');
            }
            let preferred;
            // Try to find the preferred server by name if specified
            if (preferredName) {
                preferred = servers.find(s => s.Name.toLowerCase() === preferredName.toLowerCase()) || servers[0];
            }
            else {
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
        }
        catch (e) {
            console.error('Error getting preferred server, using fallback:', e);
            // Fallback to a known server. These details might change!
            return { host: '54.86.47.176', port: 2050 };
        }
    }
}
exports.ServerFetcher = ServerFetcher;
