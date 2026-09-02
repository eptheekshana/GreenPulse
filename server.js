const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// SMS Configuration
const SMS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTc1NjMsImN1c3RvbWVyX3JvbGUiOjAsImlhdCI6MTc4ODI3OTU2NywiZXhwIjo0OTEyNDgxOTY3fQ.lll7nR_8V3Nvt4QKGUdpRgnvYaKw7jwld7zqmFGbR5w";
const ALERT_PHONE_NUMBER = "94713167066"; // TODO: Replace with your actual phone number (e.g. 9477xxxxxxx)

let smsSent = {
    soilMoisture: false,
    waterLevel: false
};

function sendSMS(message) {
    console.log("Sending SMS Alert:", message);
    const url = `https://richcommunication.dialog.lk/api/sms/inline/send.php?destination=${ALERT_PHONE_NUMBER}&q=${SMS_KEY}&message=${encodeURIComponent(message)}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log('Dialog eSMS Response:', data));
    }).on('error', err => {
        console.error('Dialog eSMS Error:', err.message);
    });
}

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

// History array for the dashboard charts
let history = [];
const HISTORY_LIMIT = 60; // Store last 60 points

// Pump History
let pumpEvents = [];
const PUMP_HISTORY_LIMIT = 50;

// Command queue for the ESP32
let pendingCommands = {
    pumpState: null, // "on" or "off" or null
    autoMode: null // true or false or null
};

// Route all root requests to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the dashboard and other pages
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/monitoring', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitoring.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'analytics.html'));
});

app.get('/control-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'control-panel.html'));
});

app.get('/alerts', (req, res) => {
    res.sendFile(path.join(__dirname, 'alerts.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
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

    if (data.pumpActive !== undefined) {
        if (state.pumpActive !== data.pumpActive) {
            if (data.pumpActive === true) {
                sendSMS(`GreenPulse NOTIFICATION: Water pump has been turned ON.`);
            }
            
            pumpEvents.unshift({
                timestamp: new Date().toISOString(),
                state: data.pumpActive ? "ON" : "OFF"
            });
            if (pumpEvents.length > PUMP_HISTORY_LIMIT) {
                pumpEvents.pop();
            }
        }
        state.pumpActive = data.pumpActive;
    }
    if (data.autoMode !== undefined) state.autoMode = data.autoMode;

    // --- SMS ALERT LOGIC ---
    // Alert if Soil Moisture is below 30%
    if (state.soilMoisture < 30 && !smsSent.soilMoisture) {
        sendSMS(`GreenPulse ALERT: Soil moisture is critically low (${Math.round(state.soilMoisture)}%).`);
        smsSent.soilMoisture = true;
    } else if (state.soilMoisture >= 35) {
        smsSent.soilMoisture = false; // Reset alert when it goes back up
    }

    // Alert if Water Level is below 20%
    if (state.waterLevel < 20 && !smsSent.waterLevel) {
        sendSMS(`GreenPulse ALERT: Water tank level is low (${Math.round(state.waterLevel)}%). Please refill.`);
        smsSent.waterLevel = true;
    } else if (state.waterLevel >= 25) {
        smsSent.waterLevel = false; // Reset alert
    }
    // -----------------------

    // Save to history array with current timestamp
    history.push({
        timestamp: new Date().toISOString(),
        temperature: state.temperature,
        humidity: state.humidity,
        soilMoisture: state.soilMoisture,
        light: state.light,
        waterLevel: state.waterLevel
    });
    if (history.length > HISTORY_LIMIT) {
        history.shift();
    }

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

// API for Dashboard to fetch historical data
app.get('/api/history', (req, res) => {
    res.json(history);
});

// API for Dashboard to fetch pump history
app.get('/api/pump-history', (req, res) => {
    res.json(pumpEvents);
});

const PUMP_PIN = "0928";

// API for Dashboard to send commands (not fully implemented in classic UI, but good to have)
app.post('/api/command', (req, res) => {
    if (req.body.pumpState === 'on') {
        if (req.body.pin !== PUMP_PIN) {
            return res.status(401).json({ success: false, error: "Invalid PIN" });
        }
    }

    if (req.body.pumpState) pendingCommands.pumpState = req.body.pumpState;
    if (req.body.autoMode !== undefined) pendingCommands.autoMode = req.body.autoMode;
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Cloud Backend is running on port ${PORT}`);
});
