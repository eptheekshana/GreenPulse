const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory (index.html, style.css)
app.use(express.static(__dirname));

// In-memory state
let state = {
    temperature: 0.0,
    humidity: 0.0,
    soilMoisture: 0.0,
    light: 0.0,
    waterLevel: 0.0,
    pumpActive: false,
    autoMode: true,
    alert: ""
};

// Command queue for the ESP32
let pendingCommands = {
    pumpState: null, // "on" or "off" or null
    autoMode: null // true or false or null
};

// Route all root requests to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API for ESP32 to push data
app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    
    // ESP32 will send raw analog values, we convert to % here
    if (data.t !== undefined) state.temperature = data.t;
    if (data.h !== undefined) state.humidity = data.h;
    
    if (data.soilRaw !== undefined) {
        // Assuming 4095 is dry, 0 is wet
        let percent = ((4095 - data.soilRaw) / 4095) * 100;
        state.soilMoisture = Math.max(0, Math.min(100, percent));
    }
    
    if (data.lightRaw !== undefined) {
        // Assuming 4095 is dark, 0 is bright
        let percent = ((4095 - data.lightRaw) / 4095) * 100;
        state.light = Math.max(0, Math.min(100, percent));
    }
    
    if (data.waterRaw !== undefined) {
        let percent = (data.waterRaw / 4095) * 100; // Depends on sensor type, assuming higher is more water
        state.waterLevel = Math.max(0, Math.min(100, percent));
    }

    if (data.pumpActive !== undefined) state.pumpActive = data.pumpActive;
    if (data.autoMode !== undefined) state.autoMode = data.autoMode;
    
    // Send pending commands back to ESP32
    res.json(pendingCommands);
    
    // Clear commands after sending
    pendingCommands.pumpState = null;
    pendingCommands.autoMode = null;
});

// API for Dashboard to fetch data
app.get('/api/data', (req, res) => {
    res.json(state);
});

// API for Dashboard to send commands (not fully implemented in classic UI, but good to have)
app.post('/api/command', (req, res) => {
    if (req.body.pumpState) pendingCommands.pumpState = req.body.pumpState;
    if (req.body.autoMode !== undefined) pendingCommands.autoMode = req.body.autoMode;
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Cloud Backend is running on port ${PORT}`);
});
