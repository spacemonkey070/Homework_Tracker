function saveSettings() {
    const phone = document.getElementById("phoneInput").value;
    const carrier = document.getElementById("carrierInput").value;

    const reminderChecks = document.querySelectorAll(".reminder-check:checked");
    const reminderMinutes = Array.from(reminderChecks).map(cb => parseInt(cb.value));

    const settings = {
        phone,
        carrier,
        reminders: reminderMinutes
    };

    localStorage.setItem("settings", JSON.stringify(settings));

    alert("Settings saved");
}

// Load saved settings on page open
window.onload = () => {
    const saved = JSON.parse(localStorage.getItem("settings")) || {};

    if (saved.phone) {
        document.getElementById("phoneInput").value = saved.phone;
    }

    if (saved.carrier) {
        document.getElementById("carrierInput").value = saved.carrier;
    }

    if (saved.reminders) {
        const checks = document.querySelectorAll(".reminder-check");
        checks.forEach(cb => {
            if (saved.reminders.includes(parseInt(cb.value))) {
                cb.checked = true;
            }
        });
    }
};

function getSMSInfo() {
    const settings = JSON.parse(localStorage.getItem("settings"));

    if (!settings.smsEnabled) return null;

    return {
        phone: settings.phone,
        carrier: settings.carrier,
        address: `${settings.phone}@${settings.carrier}`,
        reminders: settings.reminders
    };
}
function testSMS() {
    const settings = JSON.parse(localStorage.getItem("settings"));

    if (!settings || !settings.smsEnabled) {
        alert("SMS is disabled in settings");
        return;
    }

    fetch("http://localhost:3000/testSMS", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            phone: settings.phone,
            carrier: settings.carrier
        })
    })
    .then(res => res.json())
    .then(data => {
        alert("Test SMS sent!");
    })
    .catch(err => {
        console.error(err);
        alert("Failed to send test SMS");
    });
}


