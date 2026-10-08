const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
require("dotenv").config();


const app = express();
app.use(cors());
app.use(express.json());

let homework = [];

// --- Carrier → SMS Gateway Map ---
const carrierDomains = {
    verizon: "vtext.com",
    att: "txt.att.net",
    tmobile: "tmomail.net",
    sprint: "messaging.sprintpcs.com",
    boost: "sms.myboostmobile.com",
    cricket: "sms.cricketwireless.net"
};

// --- Gmail email sender ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// --- Receive homework from frontend ---
app.post("/addHomework", (req, res) => {
    const hw = req.body;
    hw.sentTimes = [];
    homework.push(hw);
    res.json({ status: "saved" });
});

// --- Test SMS endpoint ---
app.post("/testSMS", async (req, res) => {
    console.log("Incoming testSMS request:", req.body);

    try {
        const { phone, carrier } = req.body;

        const digits = phone.replace(/\D/g, "");
        const domain = carrierDomains[carrier.toLowerCase()];
        const smsEmail = `${digits}@${domain}`;

        console.log("Sending to:", smsEmail);

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: smsEmail,
            subject: "",
            text: "This is a test SMS from your Homework Tracker."
        });

        console.log("Mail sent successfully!");

        res.json({ status: "sent" });

    } catch (err) {
        console.error("SMS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});


// --- Send SMS via email ---
function sendSMS(hw) {
    const digits = hw.phone.replace(/\D/g, "");
    const domain = carrierDomains[hw.carrier.toLowerCase()];
    const smsEmail = `${digits}@${domain}`;

    transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: smsEmail,
        subject: "",
        text: `Reminder: "${hw.name}" is due at ${hw.due}.`
    });
}

// --- Scheduler — runs every minute ---
cron.schedule("* * * * *", () => {
    const now = new Date();

    homework.forEach(hw => {
        const due = new Date(hw.due);

        hw.reminders.forEach(minutes => {
            const reminderTime = new Date(due.getTime() - minutes * 60000);

            if (now >= reminderTime && !hw.sentTimes.includes(minutes)) {
                sendSMS(hw);
                hw.sentTimes.push(minutes);
            }
        });
    });
});

app.listen(3000, () => console.log("Email-to-SMS server running on port 3000"));
