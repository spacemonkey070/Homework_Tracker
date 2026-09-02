document.addEventListener("DOMContentLoaded", () => {

    // View Switching
    const classesViewBtn = document.getElementById("classes-view-btn");
    const scheduleViewBtn = document.getElementById("schedule-view-btn");

    const classesView = document.getElementById("classes-view");
    const scheduleView = document.getElementById("schedule-view");

    classesViewBtn.addEventListener("click", () => {
        classesView.classList.remove("hidden");
        scheduleView.classList.add("hidden");
    });

    scheduleViewBtn.addEventListener("click", () => {
        classesView.classList.add("hidden");
        scheduleView.classList.remove("hidden");
        renderWeek();
    });

    // Popup + Form
    const addBtn = document.getElementById("add-class-btn");
    const formPopup = document.getElementById("add-class-form");
    const overlay = document.getElementById("form-overlay");
    const saveBtn = document.getElementById("save-class-btn");
    const cancelBtn = document.getElementById("cancel-class-btn");

    addBtn.addEventListener("click", () => {
        formPopup.classList.remove("hidden");
        overlay.classList.remove("hidden");
    });

    cancelBtn.addEventListener("click", () => {
        formPopup.classList.add("hidden");
        overlay.classList.add("hidden");
        resetForm();
    });

    function resetForm() {
        document.getElementById("class-name").value = "";
        document.getElementById("class-time").value = "";
        document.getElementById("class-room").value = "";
        document.getElementById("class-color").value = "#4caf50";
        document.querySelectorAll(".day-checkbox").forEach(cb => cb.checked = false);
    }

    // Class Storage
    const classes = JSON.parse(localStorage.getItem("classes")) || [];

    saveBtn.addEventListener("click", () => {
        const name = document.getElementById("class-name").value.trim();
        const time = document.getElementById("class-time").value;
        const room = document.getElementById("class-room").value.trim();
        const color = document.getElementById("class-color").value;

        const dayCheckboxes = document.querySelectorAll(".day-checkbox:checked");
        const days = Array.from(dayCheckboxes).map(cb => cb.value);

        if (!name || days.length === 0 || !time) {
            console.log("Missing required fields");
            return;
        }

        const newClass = { name, days, time, room, color };
        classes.push(newClass);
        localStorage.setItem("classes", JSON.stringify(classes));

        renderClasses();

        formPopup.classList.add("hidden");
        overlay.classList.add("hidden");
        resetForm();
    });

    function renderClasses() {
        const container = document.getElementById("class-boxes");
        container.innerHTML = "";

        classes.forEach((cls, index) => {
            const box = document.createElement("div");
            box.classList.add("class-box");

            box.innerHTML = `

                <div class="class-box-top" style="background:${cls.color}">
                    ${cls.name}
                    <button class="delete-class-btn">🗑️</button>
                </div>
                <div class="class-box-content">
                    <p><strong>Days:</strong> ${cls.days.join(", ")}</p>
                    <p><strong>Time:</strong> ${cls.time}</p>
                    <p><strong>Room:</strong> ${cls.room}</p>
                </div>
            `;

            container.appendChild(box);

            const deleteBtn = box.querySelector(".delete-class-btn");
            deleteBtn.addEventListener("click", () => {
                pendingDeleteIndex = index;
                document.getElementById("delete-overlay").classList.remove("hidden");
            });
        });
    }
    renderClasses();

    function renderWeek() {
        const week = document.getElementById("week-layout");
        week.innerHTML = "";

        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        days.forEach(day => {
            const dayBox = document.createElement("div");
            dayBox.classList.add("week-day");
            dayBox.innerHTML = `<strong>${day}</strong>`;
            const todaysClasses = classes
                .filter(cls => cls.days.includes(day))
                .sort((a,b) => a.time.localeCompare(b.time));

            todaysClasses.forEach(cls => {
                const classItem = document.createElement("div");
                classItem.classList.add("week-class-item");
                classItem.style.background = cls.color;
                classItem.innerHTML = `
                    <div><strong>${cls.name}</strong></div>
                    <div>${cls.time}</div>
                    <div>${cls.room}</div>
                    `;
                dayBox.appendChild(classItem);
            })
            week.appendChild(dayBox);
        });
    }
    renderWeek();

    let pendingDeleteIndex = null;

    const deleteOverlay = document.getElementById("delete-overlay");
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
    const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

    confirmDeleteBtn.addEventListener("click", () => {
        if (pendingDeleteIndex !== null) {
            classes.splice(pendingDeleteIndex, 1);
            localStorage.setItem("classes", JSON.stringify(classes));
            renderClasses();
            renderWeek();
        }
        deleteOverlay.classList.add("hidden");
        pendingDeleteIndex = null;
    });

    cancelDeleteBtn.addEventListener("click", () => {
        deleteOverlay.classList.add("hidden");
        pendingDeleteIndex = null;
    });
// side tab
    const hamburger = document.getElementById("hamburger");
    const sidebar = document.getElementById("sidebar");

    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
});
