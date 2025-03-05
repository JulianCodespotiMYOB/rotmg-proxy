import * as https from 'https';
import * as querystring from 'querystring';
import * as fs from 'fs';
import * as path from 'path';

interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  expiration: number; // timestamp in ms
}

/**
 * Service for handling RotMG authentication and token management
 */
export class AuthService {
  private tokenCachePath: string;
  private currentToken: AuthResponse | null = null;
  private credentials: AuthCredentials;

  constructor(credentials: AuthCredentials, tokenCachePath?: string) {
    this.credentials = credentials;
    this.tokenCachePath = tokenCachePath || path.join(process.cwd(), '.token-cache.json');
    this.loadCachedToken();
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  public async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.currentToken && this.isTokenValid(this.currentToken)) {
      console.log('Using cached token (expires in',
        Math.round((this.currentToken.expiration - Date.now()) / 1000 / 60),
        'minutes)');
      return this.currentToken.accessToken;
    }

    // No valid token, we need to authenticate
    console.log('Getting new access token...');
    try {
      const token = await this.authenticateWithExalt();
      this.saveToken(token);
      return token.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Generate the postData for server list request
   */
  public async getServerListPostData(): Promise<string> {
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
  private isTokenValid(token: AuthResponse): boolean {
    // Consider token invalid 5 minutes before actual expiration to be safe
    const safetyMarginMs = 5 * 60 * 1000;
    return token.expiration > (Date.now() + safetyMarginMs);
  }

  /**
   * Authenticate with the Exalt client credentials
   */
  private authenticateWithExalt(): Promise<AuthResponse> {
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
            const tokenResponse: AuthResponse = {
              accessToken: response.accessToken,
              expiration: Date.now() + (60 * 60 * 1000) // 1 hour from now
            };

            resolve(tokenResponse);
          } catch (error) {
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
  private generateClientToken(): string {
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
  private loadCachedToken(): void {
    try {
      if (fs.existsSync(this.tokenCachePath)) {
        const data = fs.readFileSync(this.tokenCachePath, 'utf8');
        this.currentToken = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load cached token:', error.message);
      this.currentToken = null;
    }
  }

  /**
   * Save token to disk for future use
   */
  private saveToken(token: AuthResponse): void {
    this.currentToken = token;
    try {
      fs.writeFileSync(this.tokenCachePath, JSON.stringify(token, null, 2));
    } catch (error) {
      console.warn('Failed to save token to cache:', error.message);
    }
  }
}