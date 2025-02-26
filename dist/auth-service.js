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
exports.AuthService = void 0;
const https = __importStar(require("https"));
const querystring = __importStar(require("querystring"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Service for handling RotMG authentication and token management
 */
class AuthService {
    constructor(credentials, tokenCachePath) {
        this.currentToken = null;
        this.credentials = credentials;
        this.tokenCachePath = tokenCachePath || path.join(process.cwd(), '.token-cache.json');
        this.loadCachedToken();
    }
    /**
     * Get a valid access token, refreshing if necessary
     */
    async getAccessToken() {
        // Check if we have a valid cached token
        if (this.currentToken && this.isTokenValid(this.currentToken)) {
            console.log('Using cached token (expires in', Math.round((this.currentToken.expiration - Date.now()) / 1000 / 60), 'minutes)');
            return this.currentToken.accessToken;
        }
        // No valid token, we need to authenticate
        console.log('Getting new access token...');
        try {
            const token = await this.authenticateWithExalt();
            this.saveToken(token);
            return token.accessToken;
        }
        catch (error) {
            console.error('Failed to get access token:', error);
            throw error;
        }
    }
    /**
     * Generate the postData for server list request
     */
    async getServerListPostData() {
        const token = await this.getAccessToken();
        // Build the post data with the token
        const postData = querystring.stringify({
            accessToken: token,
            game_net: 'Unity',
            play_platform: 'Unity',
            game_net_user_id: ''
        });
        return postData;
    }
    /**
     * Check if a token is still valid (with some margin)
     */
    isTokenValid(token) {
        // Consider token invalid 5 minutes before actual expiration to be safe
        const safetyMarginMs = 5 * 60 * 1000;
        return token.expiration > (Date.now() + safetyMarginMs);
    }
    /**
     * Authenticate with the Exalt client credentials
     */
    authenticateWithExalt() {
        return new Promise((resolve, reject) => {
            // Build the login request data
            const data = JSON.stringify({
                guid: this.credentials.email,
                password: this.credentials.password,
                clientToken: this.generateClientToken(),
                game_net: 'Unity',
                play_platform: 'Unity',
                game_net_user_id: ''
            });
            // Set up the request options
            const options = {
                hostname: 'www.realmofthemadgod.com',
                port: 443,
                path: '/account/verify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };
            // Make the request
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        if (responseData.trim().startsWith('<')) {
                            console.log('Received HTML/XML instead of JSON:', responseData);
                            return reject(new Error('Server returned HTML/XML instead of JSON. Authentication endpoint may have changed.'));
                        }
                        if (res.statusCode !== 200) {
                            console.log('Full error response:', responseData);
                            return reject(new Error(`HTTP error ${res.statusCode}: ${responseData}`));
                        }
                        const response = JSON.parse(responseData);
                        if (!response.accessToken) {
                            return reject(new Error(`No access token in response: ${responseData}`));
                        }
                        // Calculate expiration (tokens typically last 1 hour)
                        const tokenResponse = {
                            accessToken: response.accessToken,
                            expiration: Date.now() + (60 * 60 * 1000) // 1 hour from now
                        };
                        resolve(tokenResponse);
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse authentication response: ${error.message}`));
                    }
                });
            });
            req.on('error', (error) => {
                reject(new Error(`Authentication request failed: ${error.message}`));
            });
            req.write(data);
            req.end();
        });
    }
    /**
     * Generate a hardware ID to be used as client token
     * This mimics how the Exalt client generates its ID
     */
    generateClientToken() {
        // In a real implementation, you'd want to generate this once and reuse it
        // to avoid getting your account flagged for suspicious login patterns
        const randomBytes = Buffer.alloc(20);
        for (let i = 0; i < 20; i++) {
            randomBytes[i] = Math.floor(Math.random() * 256);
        }
        return randomBytes.toString('hex');
    }
    /**
     * Load a cached token from disk if available
     */
    loadCachedToken() {
        try {
            if (fs.existsSync(this.tokenCachePath)) {
                const data = fs.readFileSync(this.tokenCachePath, 'utf8');
                this.currentToken = JSON.parse(data);
            }
        }
        catch (error) {
            console.warn('Failed to load cached token:', error.message);
            this.currentToken = null;
        }
    }
    /**
     * Save token to disk for future use
     */
    saveToken(token) {
        this.currentToken = token;
        try {
            fs.writeFileSync(this.tokenCachePath, JSON.stringify(token, null, 2));
        }
        catch (error) {
            console.warn('Failed to save token to cache:', error.message);
        }
    }
}
exports.AuthService = AuthService;
