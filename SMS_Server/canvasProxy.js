const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/canvas", async (req, res) => {
    const { endpoint, token } = req.body;

    try {
        const response = await fetch(`https://lawrencetech.instructure.com/api/v1/${endpoint}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Canvas proxy failed" });
    }
});

app.listen(3001, () => console.log("Canvas Proxy running on port 3001"));
