"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_TO_CLIENT_RC4 = exports.CLIENT_TO_SERVER_RC4 = void 0;
// These keys match the working Python implementation
exports.CLIENT_TO_SERVER_RC4 = {
    incomingKey: "c91d9eec420160730d825604e0", // client sends encrypted with this key
    outgoingKey: "c91d9eec420160730d825604e0" // server expects packets encrypted with this key
};
exports.SERVER_TO_CLIENT_RC4 = {
    incomingKey: "5a4d2016bc16dc64883194ffd9", // server sends encrypted with this key
    outgoingKey: "5a4d2016bc16dc64883194ffd9" // client expects packets encrypted with this key
};
