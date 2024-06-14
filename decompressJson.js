const pako = require('pako');
const fs = require('fs');

// Example compressed data received as base64
const compressedData = process.env.DECOMPRESSED_DATA_BASE64; // Use environment variable for input

// Decode base64 (if it's encoded as base64)
const decodedData = atob(compressedData);

// Decompress
const uint8array = new Uint8Array(decodedData.length);
for (let i = 0; i < decodedData.length; i++) {
    uint8array[i] = decodedData.charCodeAt(i);
}
const decompressedData = pako.inflate(uint8array, { to: 'string' });

// Save decompressed data to a JSON file
fs.writeFileSync('tokens/global-ds.tokens.json', decompressedData);
