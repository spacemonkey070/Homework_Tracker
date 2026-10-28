console.log("Settings page loaded");

async function syncAssignments() {

    try {

        const response = await fetch(
            "https://all-in-1-b8acdzcyhyhxdpen.centralus-01.azurewebsites.net/unfinishedHomework"
        );

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const assignments = await response.json();

        console.log(assignments);

        localStorage.setItem(
            "homework",
            JSON.stringify(assignments)
        );

        alert(
            `${assignments.length} assignments imported`
        );

    } catch (err) {

        console.error(err);

        alert(
            "Failed to load assignments"
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .getElementById("sync-assignments-btn")
            .addEventListener(
                "click",
                syncAssignments
            );

    }
);