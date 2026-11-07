// load saved hw
const saved = localStorage.getItem("homework");
let homework = saved ? JSON.parse(saved) : [];

function saveHW() {
    localStorage.setItem("homework", JSON.stringify(homework));
}

/* ---------- date helpers ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n) {
    return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" (+ optional "HH:MM") -> local Date. No time = end of that day.
function getDueDate(hw) {
    const [y, m, d] = hw.due.split("-").map(Number);
    let h = 23, min = 59;
    if (hw.time) [h, min] = hw.time.split(":").map(Number);
    return new Date(y, m - 1, d, h, min);
}

function formatTime(t) {
    if (!t) return "";
    let [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${pad(m)} ${suffix}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// current week, Sunday through Saturday
function getWeekRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start, end };
}

// "overdue", "today" or "" for an unfinished item
function getStatus(hw) {
    if (hw.finished) return "";
    const now = new Date();
    const due = getDueDate(hw);
    if (due < now) return "overdue";
    if (startOfDay(due).getTime() === startOfDay(now).getTime()) return "today";
    return "";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dueLabel(hw) {
    const due = getDueDate(hw);
    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);

    let day;
    if (days === 0) day = "Today";
    else if (days === 1) day = "Tomorrow";
    else if (days === -1) day = "Yesterday";
    else if (Math.abs(days) < 7) day = WEEKDAYS[due.getDay()];
    else day = `${MONTHS[due.getMonth()]} ${due.getDate()}`;

    return hw.time ? `${day}, ${formatTime(hw.time)}` : day;
}

/* ---------- add HW ---------- */
const form = document.getElementById("hw-form");
const addToggle = document.getElementById("add-toggle");

function setFormOpen(open) {
    form.classList.toggle("open", open);
    addToggle.textContent = open ? "Close" : "Add homework";
    addToggle.setAttribute("aria-expanded", open);
    if (open) document.getElementById("name-input").focus();
}

addToggle.addEventListener("click", () => {
    setFormOpen(!form.classList.contains("open"));
});

form.addEventListener("submit", function (e) {
    e.preventDefault();

    homework.push({
        class: document.getElementById("class-input").value,
        name: document.getElementById("name-input").value,
        due: document.getElementById("date-input").value,
        time: document.getElementById("time-input").value,
        info: "",
        finished: false
    });

    saveHW();
    renderHW();
    this.reset();
    setFormOpen(false);
});

/* ---------- Canvas import ---------- */
async function loadCanvasHomework() {
    try {
        const response = await fetch(
            "https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework"
        );

        const assignments = await response.json();

        assignments.forEach(a => {
            if (!isCurrentSchoolYear(a.dueDate)) return;

            // use the viewer's local date and time for the due date
            const dt = new Date(a.dueDate);
            const localDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
            const localTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

            const existing = homework.find(hw => hw.canvasID === a.id);

            if (!existing) {
                homework.push({
                    canvasID: a.id,
                    class: a.courseName,
                    name: a.title,
                    due: localDate,
                    time: localTime,
                    info: "",
                    finished: false
                });
            } else if (!existing.time) {
                // older saved items didn't have a time
                existing.due = localDate;
                existing.time = localTime;
            }
        });

        saveHW();
        renderHW();

    } catch (err) {
        console.error(err);
    }
}

// Check if a due date is in the current school year
function getCurrentSchoolYear() {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    return {
        start: new Date(`${startYear}-08-01`),
        end: new Date(`${startYear + 1}-07-31`)
    };
}

function isCurrentSchoolYear(dueDate) {
    const due = new Date(dueDate);
    const schoolYear = getCurrentSchoolYear();
    return due >= schoolYear.start && due <= schoolYear.end;
}

/* ---------- render ---------- */
function renderHW() {
    homework.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? 1 : -1;
        return getDueDate(a) - getDueDate(b);
    });

    const unfinished = document.getElementById("unfinished-container");
    const finished = document.getElementById("finished-container");

    unfinished.innerHTML = "";
    finished.innerHTML = "";

    // class color mapping
    const classes = JSON.parse(localStorage.getItem("classes")) || [];
    const colorMap = {};
    classes.forEach(cls => {
        colorMap[cls.name] = cls.color || "#888888";
    });

    let unfinishedCount = 0;
    let finishedCount = 0;

    homework.forEach(hw => {
        const status = getStatus(hw);
        const classColor = colorMap[hw.class] || "#888888";

        const item = document.createElement("div");
        item.classList.add("hw-item", "row");
        if (hw.finished) item.classList.add("hw-finished");
        if (status) item.classList.add("hw-" + status);

        const finishBtn = document.createElement("button");
        finishBtn.className = "finish-btn";
        finishBtn.type = "button";
        finishBtn.textContent = hw.finished ? "✓" : "";
        finishBtn.setAttribute("aria-label", hw.finished ? "Mark as unfinished" : "Mark as finished");

        const name = document.createElement("span");
        name.className = "hw-name";
        name.textContent = hw.name;

        const cls = document.createElement("span");
        cls.className = "hw-class";
        if (hw.class) {
            const dot = document.createElement("span");
            dot.className = "class-dot";
            dot.style.background = classColor;
            const label = document.createElement("span");
            label.textContent = hw.class;
            cls.append(dot, label);
        }

        const due = document.createElement("span");
        due.className = "hw-due";
        if (status) {
            const pill = document.createElement("span");
            pill.className = "pill pill-" + status;
            pill.textContent = status === "overdue" ? "Overdue" : "Due today";
            due.appendChild(pill);
        }
        due.appendChild(document.createTextNode(dueLabel(hw)));

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.type = "button";
        del.textContent = "✕";
        del.setAttribute("aria-label", "Delete homework");

        item.append(finishBtn, name, cls, due, del);

        finishBtn.addEventListener("click", () => {
            hw.finished = !hw.finished;
            saveHW();
            renderHW();
        });

        del.addEventListener("click", () => {
            homework.splice(homework.indexOf(hw), 1);
            saveHW();
            renderHW();
        });

        if (hw.finished) {
            finished.appendChild(item);
            finishedCount++;
        } else {
            unfinished.appendChild(item);
            unfinishedCount++;
        }
    });

    if (unfinishedCount === 0) {
        unfinished.innerHTML = '<div class="empty">All caught up. Add homework with the button above.</div>';
    }
    if (finishedCount === 0) {
        finished.innerHTML = '<div class="empty">Finished homework shows up here.</div>';
    }

    document.getElementById("unfinished-count").textContent = unfinishedCount;
    document.getElementById("finished-count").textContent = finishedCount;

    updateProgress();
}

// ring only counts homework due this week
function updateProgress() {
    const { start, end } = getWeekRange();
    const thisWeek = homework.filter(hw => {
        const due = getDueDate(hw);
        return due >= start && due < end;
    });

    const total = thisWeek.length;
    const done = thisWeek.filter(hw => hw.finished).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById("circle-progress").style.strokeDasharray = `${percent}, 100`;
    document.getElementById("circle-text").textContent = `${done} of ${total} done`;

    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    document.getElementById("subtitle").textContent =
        `Week of ${MONTHS[start.getMonth()]} ${start.getDate()} to ${MONTHS[last.getMonth()]} ${last.getDate()}`;
}

/* ---------- sidebar ---------- */
const sidebar = document.getElementById("sidebar");
document.getElementById("hamburger").addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

/* ---------- class dropdown ---------- */
function loadClassesIntoDropdown() {
    const dropdown = document.getElementById("class-input");
    const classes = JSON.parse(localStorage.getItem("classes")) || [];

    dropdown.innerHTML = "";

    if (classes.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No classes yet";
        dropdown.appendChild(option);
        return;
    }

    classes.forEach(cls => {
        const option = document.createElement("option");
        option.value = cls.name;
        option.textContent = cls.name;
        dropdown.appendChild(option);
    });
}

/* ---------- section toggles ---------- */
function setupToggle(toggleId, sectionId) {
    document.getElementById(toggleId).addEventListener("click", () => {
        const section = document.getElementById(sectionId);
        const collapsed = section.classList.toggle("collapsed");
        section.querySelector(".arrow").classList.toggle("closed", collapsed);
    });
}

setupToggle("unfinished-toggle", "unfinished-section");
setupToggle("finished-toggle", "finished-section");

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", () => {
    loadClassesIntoDropdown();
    renderHW();
    loadCanvasHomework();
    // keep red/yellow highlights current while the page stays open
    setInterval(renderHW, 60000);
});
