/*
document.addEventListener("DOMContentLoaded", () => {

    console.log("DOM loaded");

    const btn = document.getElementById("sync-assignments-btn");

    console.log("Button found:", btn);

    btn.addEventListener("click", async () => {
    console.log("BUTTON CLICKED");

    try {
        const response = await fetch(
          "https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework"
        );

        console.log("status:", response.status);
        console.log("ok:", response.ok);

        const text = await response.text();
        console.log("response body:", text);

    } catch (err) {
        console.error("FULL ERROR:", err);
    }
});
});
*/
document.addEventListener("DOMContentLoaded", () => {
    const syncButton = document.getElementById("sync-assignments-btn");

    if (!syncButton) {
        console.error("Sync button not found");
        return;
    }

    syncButton.addEventListener("click", syncAssignments);
});

async function syncAssignments() {
    try {
        const response = await fetch(
            "https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework"
        );

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const assignments = await response.json();

        console.log(`Loaded ${assignments.length} assignments`);

        renderAssignments(assignments);

    } catch (error) {
        console.error("Assignment sync failed:", error);
        alert("Unable to sync assignments.");
    }
}