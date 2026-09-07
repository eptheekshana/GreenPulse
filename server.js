require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// SMS Configuration
const SMS_KEY = process.env.SMS_KEY;
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER;

let smsSent = {
    soilMoisture: false,
    waterLevel: false,
    humidity: false,
    light: false
};

function sendSMS(message) {
    console.log("Sending SMS Alert:", message);
    
    const postData = JSON.stringify({
        recipient: ALERT_PHONE_NUMBER,
        sender_id: "TextLKDemo",
        type: "plain",
        message: message
    });

    const options = {
        hostname: 'app.text.lk',
        path: '/api/v3/sms/send',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SMS_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log('Text.lk API Response:', data));
    });

    req.on('error', err => {
        console.error('Text.lk API Error:', err.message);
    });

    req.write(postData);
    req.end();
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

const HISTORY_FILE = path.join(__dirname, 'history.json');
const PUMP_HISTORY_FILE = path.join(__dirname, 'pump_history.json');

// History array for the dashboard charts
let history = [];
if (fs.existsSync(HISTORY_FILE)) {
    try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading history.json", e);
    }
}
const HISTORY_LIMIT = 60; // Store last 60 points

// Pump History
let pumpEvents = [];
if (fs.existsSync(PUMP_HISTORY_FILE)) {
    try {
        pumpEvents = JSON.parse(fs.readFileSync(PUMP_HISTORY_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading pump_history.json", e);
    }
}
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
            fs.writeFile(PUMP_HISTORY_FILE, JSON.stringify(pumpEvents), (err) => {
                if (err) console.error("Error saving pump history:", err);
            });
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

    // Alert if Humidity is below 40%
    if (state.humidity < 40 && !smsSent.humidity) {
        sendSMS(`GreenPulse ALERT: Humidity is low (${Math.round(state.humidity)}%).`);
        smsSent.humidity = true;
    } else if (state.humidity >= 45) {
        smsSent.humidity = false;
    }

    // Alert if Brightness is below 20%
    if (state.light < 20 && !smsSent.light) {
        sendSMS(`GreenPulse ALERT: Brightness level is low (${Math.round(state.light)}%).`);
        smsSent.light = true;
    } else if (state.light >= 25) {
        smsSent.light = false;
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
    fs.writeFile(HISTORY_FILE, JSON.stringify(history), (err) => {
        if (err) console.error("Error saving history:", err);
    });

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
