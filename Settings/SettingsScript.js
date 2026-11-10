document.addEventListener("DOMContentLoaded", () => {
    const syncButton = document.getElementById("sync-assignments-btn");

    if (!syncButton) {
        console.error("Sync button not found");
        return;
    }

    syncButton.addEventListener("click", syncAssignments);
});

document.getElementById("syncBtn")
  .addEventListener("click", syncToGoogleCalendar);

async function syncAssignments() {
    try {
        const response = await fetch(
            "https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework"
        );

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const assignments = await response.json();
        localStorage.setItem("CanvasAssignments", JSON.stringify(assignments));
        console.log(`Loaded ${assignments.length} assignments`);

        renderAssignments(assignments);
        console.log("Assignments received:", assignments);
        alert("Assignments synced");

    } catch (error) {
        console.error("Assignment sync failed:", error);
        alert("Unable to sync assignments");
    }
}

function renderAssignments(assignments) {
    if (!Array.isArray(assignments)) {
        console.error("Expected an array of assignments");
        return;
    }

    assignments.forEach((assignment) => {
        console.log(
            assignment.name,
            assignment.courseName,
            assignment.dueDate
        );
    });
}