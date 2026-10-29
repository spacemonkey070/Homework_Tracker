/*console.log("Settings page loaded");

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
*/
alert("SCRIPT LOADED");
console.log("SettingsScript loaded");

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

            console.log("Response:", response);

            const data = await response.json();

            console.log("Assignments:", data);

            localStorage.setItem(
                "homework",
                JSON.stringify(data)
            );

            alert("Assignments synced!");

        } catch (err) {

            console.error(err);

            alert(err.message);
        }

    });

});