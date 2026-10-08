const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from both project and workspace root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
