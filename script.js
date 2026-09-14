// load saved hw
const saved = localStorage.getItem("homework");
let homework = saved ? JSON.parse(saved) : [];
renderHW();

// save hw to local storage
function saveHW() {
    localStorage.setItem("homework", JSON.stringify(homework));
}

// format date for display
function formatDate(iso) {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
}
// add HW
document.getElementById("hw-form").addEventListener("submit", function(e) {
    e.preventDefault();

    const hw = {
        class: document.getElementById("class-input").value,
        name: document.getElementById("name-input").value,
        due: document.getElementById("date-input").value,
        info: document.getElementById("info-input").value.trim(),
        finished: false
    };

    homework.push(hw);
    saveHW();
    renderHW();
    this.reset();
});


//render HW items
function renderHW() {
    homework.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? 1 : -1;
        return new Date(a.due) - new Date(b.due);
    });

    const unfinished = document.getElementById("unfinished-container");
    const finished = document.getElementById("finished-container");

    unfinished.innerHTML = "";
    finished.innerHTML = "";

    //class collor mapping
    const classes = JSON.parse(localStorage.getItem("classes")) || [];
    const colorMap = {};
    classes.forEach(cls => {
        colorMap[cls.name] = cls.color || "#888";
    });

    homework.forEach((hw, index) => {
        const item = document.createElement("div");
        item.classList.add("hw-item");
        item.classList.add(hw.finished ? "hw-green" : "hw-red");

        const classColor = colorMap[hw.class] || "#888";

        item.innerHTML = `
            <div class="hw-top">
                <div class="hw-details">
                    <span class="hw-name">${hw.name}</span>
                    <span class="hw-class" style="background:${classColor}">${hw.class}</span>

                </div>
                <button class="finish-btn">${hw.finished ? "Undo" : "Finish"}</button>
            </div>

            <div class="hw-info">
                <p>${hw.info || ""}</p>
            </div>

            <span class="hw-due">Due: ${formatDate(hw.due)}</span>

            <button class="delete-btn">🗑️</button>
        `;

        // finish toggle
        item.querySelector(".finish-btn").addEventListener("click", () =>{
            hw.finished = !hw.finished;
            saveHW();
            renderHW();
        });

        // delete toggle
        item.querySelector(".delete-btn").addEventListener("click", () => {
            homework.splice(index, 1);
            saveHW();
            renderHW();
        });

        //append tocorrect container
        if (hw.finished) {
            finished.appendChild(item);
        } else {
            unfinished.appendChild(item);
        }
    });

    updateProgress();
}

//update progress bar and circle
function updateProgress() {
    const total = homework.length;
    const done = homework.filter(hw => hw.finished).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    //progress bar
    document.getElementById("progress-bar").style.width = percent + "%";
    //circle progress
    const circle = document.getElementById("circle-progress");
    circle.style.strokeDasharray = `${percent}, 100`;
    //circle text
    document .getElementById("circle-text").textContent = `${done} / ${total}`;
}


// Sidebar
const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");

hamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

//load classes into dropdown
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

// Dropdown toggles
document.getElementById("unfinished-toggle").addEventListener("click", () => {
    const box = document.getElementById("unfinished-container");
    const current = getComputedStyle(box).display;
    const arrow = document.querySelector("#unfinished-toggle .arrow");
    const isOpen = current !== "none";  

    arrow.classList.toggle("closed", isOpen);
    box.style.display = isOpen ? "none" : "block";
});

document.getElementById("finished-toggle").addEventListener("click", () => {
    const box = document.getElementById("finished-container");
    const current = getComputedStyle(box).display;
    const arrow = document.querySelector("#finished-toggle .arrow");
    const isOpen = current !== "none";   

    arrow.classList.toggle("closed", isOpen);
    box.style.display = isOpen ? "none" : "block";
});

