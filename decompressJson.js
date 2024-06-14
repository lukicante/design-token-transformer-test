const pako = require('pako');
const fs = require('fs');

// Example compressed data received as base64
const compressedData = process.env.DECOMPRESSED_DATA_BASE64; // Use environment variable for input

// Decode base64 and decompress
const decodedData = Buffer.from(compressedData, 'base64');
const decompressedData = pako.inflate(decodedData, { to: 'string' });

// Save decompressed data to a JSON file
fs.writeFileSync('tokens/global-ds.tokens.json', decompressedData);
