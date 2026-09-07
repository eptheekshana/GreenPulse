require('dotenv').config();
const https = require('https');

const SMS_KEY = process.env.SMS_KEY;
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER;

function sendSMS(message) {
    console.log("Sending SMS Alert:", message);
    console.log("SMS_KEY:", SMS_KEY ? "Loaded" : "Missing");
    console.log("ALERT_PHONE_NUMBER:", ALERT_PHONE_NUMBER);
    
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
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
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

sendSMS("Test from Antigravity");
