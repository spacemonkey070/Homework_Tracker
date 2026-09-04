// load saved hw from localStorage
const saved = localStorage.getItem("homework");
let homework = saved ? JSON.parse(saved) : [];
renderHW();

// save hw when changes
function saveHW() {
    localStorage.setItem("homework", JSON.stringify(homework));
}

// correcting the date for box
function formatDate(iso) {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
}

document.getElementById("hw-form").addEventListener("submit", function(e) {
    e.preventDefault();

    const hw = {
        class: document.getElementById("class-input").value,
        name: document.getElementById("name-input").value,
        due: document.getElementById("date-input").value,
        info: document.getElementById("info-input").value,
        finished: false
    };
    homework.push(hw);
    saveHW();
    renderHW();
    this.reset();
});

function renderHW() {
    homework.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? 1 : -1;
        return new Date(a.due) - new Date(b.due);
    });

    const list = document.getElementById("hw-list");
    list.innerHTML = "";

    homework.forEach((hw, index) => {
        const item = document.createElement("div");
        item.classList.add("hw-item");
        item.classList.add(hw.finished ? "hw-green" : "hw-red");

        item.innerHTML = `
            <div class="hw-top">
                <div class="hw-details">
                    <span class="hw-class"><strong>${hw.class}</strong></span>
                    <span class="hw-name">${hw.name}</span>
                </div>
                <button class="finish-btn">${hw.finished ? "Undo" : "Finish"}</button>
            </div>
            <p>${hw.info}</p>

            <span class="hw-due"><strong>Due:</strong> ${formatDate(hw.due)}</span>

            <button class="delete-btn">🗑️</button>
        `;

        item.querySelector(".finish-btn").addEventListener("click", () =>{
            hw.finished = !hw.finished;
            saveHW();
            renderHW();
        });
        item.querySelector(".delete-btn").addEventListener("click", () => {
            homework.splice(index, 1);
            saveHW();
            renderHW();
        });

        list.appendChild(item);
    });

    updateProgress();
}


function updateProgress() {
    const total = homework.length;
    const done = homework.filter(hw => hw.finished).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById("progress-bar").style.width = percent + "%";

    const circle = document.getElementById("circle-progress");
    circle.style.strokeDasharray = `${percent}, 100`;

    document .getElementById("circle-text").textContent = `${done} / ${total}`;
}


// Sidebar
const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");

hamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

function showHomework() {
    document.getElementById("homework-tab").style.display = "block";
    document.getElementById("classes-tab").style.display = "none";
}

function showClasses() {
    document.getElementById("homework-tab").style.display = "none";
    document.getElementById("classes-tab").style.display = "block";
}

function loadClassesIntoDropdown() {
    const dropdown = document.getElementById("class-input");
    const classes = JSON.parse(localStorage.getItem("classes")) || [];

    dropdown.innerHTML = "";

    classes.forEach(cls => {
        const option = document.createElement("option");
        option.value = cls.name;   // or cls.className depending on your structure
        option.textContent = cls.name;
        dropdown.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", loadClassesIntoDropdown);

