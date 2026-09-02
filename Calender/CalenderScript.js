// GLOBALS
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0 = Jan, 11 = Dec

function buildCalendar() {
    const calendar = document.getElementById("calendar");
    const monthLabel = document.getElementById("month-label");

    if (!calendar) return;

    // Clear old calendar
    calendar.innerHTML = "";

    // Homework data
    const homework = JSON.parse(localStorage.getItem("homework")) || []
        .filter(hw => !hw.finished);

    // Month name
    const monthNames = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];

    monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // First day + number of days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Fill empty slots before day 1
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.classList.add("empty-day");
        calendar.appendChild(empty);
    }

    // Fill actual days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.classList.add("day");

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

        cell.innerHTML = `<strong>${monthNames[currentMonth]} ${day}</strong>`;

        // Insert homework items
        homework.forEach(hw => {
            if (hw.due === dateStr) {
                const item = document.createElement("div");
                item.classList.add("hw-item");

                // Color classes from your uploaded CSS
                // ".hw-red" and ".hw-green" 
                if (hw.finished) {
                    item.classList.add("hw-green");
                } else {
                    item.classList.add("hw-red");
                }

                item.textContent = `${hw.class}: ${hw.name}`;
                cell.appendChild(item);
            }
        });

        calendar.appendChild(cell);
    }
}

// Month switching
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    buildCalendar();
}

function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    buildCalendar();
}


const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");

hamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});


// Initialize
document.addEventListener("DOMContentLoaded", buildCalendar);
