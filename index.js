/**
 * ============================================================
 * SCORPION X – ENTRY POINT
 * Version: 3.0.0
 * ============================================================
 * 
 * This file is the main entry point for the SCORPION X application.
 * It imports and runs the main server from server.js
 * 
 * For Render deployment, this is the file that gets executed.
 * ============================================================
 */

import './server.js';

console.log('🔥 SCORPION X – Starting up...');
console.log('⚡ Entry point: index.js');
console.log('📡 Server will start on port:', process.env.PORT || 3000);
