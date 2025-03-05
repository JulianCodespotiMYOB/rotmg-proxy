"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKET_MAP = void 0;
const packets_json_1 = __importDefault(require("realmlib/build/packets.json"));
/**
 * This file creates a packet map using the existing realmlib packets.json data.
 * It maps packet names (e.g., "FAILURE") to their numeric IDs and vice versa.
 */
exports.PACKET_MAP = {
    ...packets_json_1.default
};
