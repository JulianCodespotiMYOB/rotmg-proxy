"use strict";
// rc4keys.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTGOING_KEY = exports.INCOMING_KEY = void 0;
/**
 * Default RC4 keys for RotMG.
 *
 * These keys are used by realmlib for encrypting/decrypting the RotMG network traffic.
 *
 * In a typical MITM proxy:
 * - The PacketIO instance attached to traffic from the server uses the INCOMING_KEY for both its incoming and outgoing RC4 configuration.
 * - The PacketIO instance attached to traffic from the client uses the OUTGOING_KEY for both directions.
 *
 * Note: These values were extracted from community‑maintained projects (such as nrelay and others).
 * They are subject to change with game updates. If you experience decryption errors or unknown packets,
 * you may need to re‑extract the keys from the current RotMG client.
 */
exports.INCOMING_KEY = "5a4d2016bc16dc64883194ffd9";
exports.OUTGOING_KEY = "c91d9eec420160730d825604e0";
