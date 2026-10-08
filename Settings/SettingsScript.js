function saveSettings() {
    const phone = document.getElementById("phoneInput").value;
    const carrier = document.getElementById("carrierInput").value;

    const reminderChecks = document.querySelectorAll(".reminder-check:checked");
    const reminderMinutes = Array.from(reminderChecks).map(cb => parseInt(cb.value));
    const smsEnabled = document.getElementById("smsEnabled").checked;

    const settings = {
        phone,
        carrier,
        reminders: reminderMinutes,
        smsEnabled
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

    if (saved.smsEnabled !== undefined) {
        document.getElementById("smsEnabled").checked = saved.smsEnabled;
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

// --- Canvas Token ---
document.addEventListener("DOMContentLoaded", () => {
    const tokenInput = document.getElementById("canvas-token");
    if (!tokenInput) return; // Only run on Settings page

    // Load token from session
    const savedToken = sessionStorage.getItem("canvasToken");
    if (savedToken) tokenInput.value = savedToken;

    // Load courses button
    document.getElementById("load-courses-btn").addEventListener("click", async () => {
        const token = tokenInput.value.trim();
        if (!token) {
            alert("Please paste your Canvas API token.");
            return;
        }

        sessionStorage.setItem("canvasToken", token);

        const courses = await fetchCanvasCourses(token);
        saveCanvasCourses(courses);
        displayCanvasCourses(courses);
    });

    // Sync assignments button
    document.getElementById("sync-assignments-btn").addEventListener("click", async () => {
        const token = tokenInput.value.trim();
        const selected = [...document.querySelectorAll(".course-checkbox:checked")]
            .map(cb => cb.dataset.id);

        if (selected.length === 0) {
            alert("Select at least one course.");
            return;
        }

        for (const id of selected) {
            const assignments = await fetchCanvasAssignments(id, token);
            saveCanvasAssignments(assignments, id);
        }

        alert("Assignments synced! Check your Homework tab.");
        window.location.href = "../index.html";

    });

    async function fetchCanvasCourses(token) {
        const url = "https://lawrencetech.instructure.com/api/v1/courses";

        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        return (await res.json()).filter(c =>
            c.enrollment_type === "student" &&
            c.workflow_state === "available"
        );
    }

    function displayCanvasCourses(courses) {
        const list = document.getElementById("canvas-course-list");
        list.innerHTML = "";

        courses.forEach(course => {
            const div = document.createElement("div");
            div.innerHTML = `
                <label>
                    <input type="checkbox" class="course-checkbox" data-id="${course.id}">
                    ${course.name} (${course.id})
                </label>
            `;
            list.appendChild(div);
        });
    }

    async function fetchCanvasAssignments(courseId, token) {
        const res = await fetch("http://localhost:3001/canvas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: `courses/${courseId}/assignments`,
                token
            })
        });

        return await res.json();
    }

    function saveCanvasCourses(courses) {
        const stored = JSON.parse(localStorage.getItem("classes")) || [];

        courses.forEach(c => {
            if (!stored.some(x => x.id === c.id)) {
                stored.push({
                    id: c.id,
                    name: c.name,
                    code: c.course_code || "",
                    days: [],
                    time: "",
                    room: ""
                });
            }
        });

        localStorage.setItem("classes", JSON.stringify(stored));
    }
    function saveCanvasAssignments(assignments, courseId) {
        const classes = JSON.parse(localStorage.getItem("classes")) || [];
        const course = classes.find(c => c.id == courseId);

        const hwList = JSON.parse(localStorage.getItem("homework")) || [];

        assignments.forEach(a => {
            let hwName = a.name;
            if (hwName.includes(":")) {
                hwName = hwName.split(":").slice(1).join(":").trim();
            }
            const hwItem = {
                class: course ? course.name : "Unknown",
                name: hwName,
                due: a.due_at ? a.due_at.split("T")[0] : "No Due Date",
                info: a.html_url,
                finished: false
            };

            const exists = hwList.some(h => h.info === hwItem.info);
            if (!exists) hwList.push(hwItem);
    });
        
        localStorage.setItem("homework", JSON.stringify(hwList));
    }
});