"use strict";
// custom-rc4.ts - Direct RC4 implementation matching the Python code
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_RECEIVE_KEY = exports.SERVER_SEND_KEY = exports.CLIENT_RECEIVE_KEY = exports.CLIENT_SEND_KEY = exports.CustomRC4 = void 0;
/**
 * Custom RC4 cipher implementation that mimics the Python implementation
 */
class CustomRC4 {
    /**
     * Create a new RC4 cipher
     * @param key The key as a hex string or byte array
     */
    constructor(key) {
        this.state = new Uint8Array(256);
        this.i = 0;
        this.j = 0;
        // Convert hex string to byte array if needed
        if (typeof key === 'string') {
            // Convert hex string to byte array
            this.key = new Uint8Array(key.length / 2);
            for (let i = 0; i < key.length; i += 2) {
                this.key[i / 2] = parseInt(key.substring(i, i + 2), 16);
            }
        }
        else {
            this.key = key;
        }
        this.reset();
    }
    /**
     * Reset the cipher to its initial state
     */
    reset() {
        this.i = 0;
        this.j = 0;
        // Initialize state array
        for (let i = 0; i < 256; i++) {
            this.state[i] = i;
        }
        // Key scheduling algorithm
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + this.state[i] + this.key[i % this.key.length]) % 256;
            // Swap state[i] and state[j]
            const temp = this.state[i];
            this.state[i] = this.state[j];
            this.state[j] = temp;
        }
    }
    /**
     * Encrypt/decrypt data in place
     * @param data The data to encrypt/decrypt
     */
    process(data) {
        for (let n = 0; n < data.length; n++) {
            this.i = (this.i + 1) % 256;
            this.j = (this.j + this.state[this.i]) % 256;
            // Swap state[i] and state[j]
            const temp = this.state[this.i];
            this.state[this.i] = this.state[this.j];
            this.state[this.j] = temp;
            // XOR the data with the key stream
            const k = this.state[(this.state[this.i] + this.state[this.j]) % 256];
            data[n] ^= k;
        }
    }
    /**
     * Alias for process
     */
    encrypt(data) {
        this.process(data);
    }
    /**
     * Alias for process
     */
    decrypt(data) {
        this.process(data);
    }
}
exports.CustomRC4 = CustomRC4;
// Constants matching the Python implementation
exports.CLIENT_SEND_KEY = "c91d9eec420160730d825604e0";
exports.CLIENT_RECEIVE_KEY = "5a4d2016bc16dc64883194ffd9";
exports.SERVER_SEND_KEY = "5a4d2016bc16dc64883194ffd9";
exports.SERVER_RECEIVE_KEY = "c91d9eec420160730d825604e0";
