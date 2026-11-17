require("dotenv").config();

const express = require("express");
const cors = require("cors");
const canvasService = require("./services/canvasService.js");
const app = express();

app.use(express.json());
app.use(cors());

app.use(cors({
  origin: "https://spacemonkey070.github.io"
}));

// Reads the Canvas token the site sends: "Authorization: Bearer <token>".
// (POST /courses can still send it in the JSON body as { token }.)
function getToken(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (match) return match[1];
  return (req.body && typeof req.body.token === "string") ? req.body.token.trim() : "";
}

function requireToken(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing Canvas token" });
  }
  req.canvasToken = token;
  next();
}

// Log only the message. Logging the whole error can print request headers,
// and that would put the user's token in the server logs.
function sendError(res, err) {
  console.error(err && err.message ? err.message : "Canvas request failed");

  const status = err && (err.status || (err.response && err.response.status));
  const message = (err && err.message) || "";
  const rejected = status === 401 || /\b401\b|unauthori[sz]ed|invalid access token/i.test(message);

  if (rejected) {
    return res.status(401).json({ error: "Canvas rejected that token" });
  }
  res.status(500).json({ error: message || "Something went wrong" });
}

app.get("/version", (req, res) => {
    res.send("version-test");
});


app.get("/", (req, res) => {
  res.send("Homework Tracker API Online");
});

// calling courses from canvasServices
app.post("/courses", requireToken, async (req, res) => {
  try {
    const courses = await canvasService.getCourses(req.canvasToken);
    res.json(courses);
  } catch (err) {
    sendError(res, err);
  }
});

// calling assignments from canvasServices
app.get("/assignments", requireToken, async (req, res) => {
  try {
    const assignments =
      await canvasService.getAssignments(req.canvasToken);

    res.json(assignments);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/unfinishedHomework", requireToken, async (req, res) => {
  try {
    const assignments =
      await canvasService.getAssignments(req.canvasToken);

    const unfinished = assignments.filter(
      assignment =>
        assignment.dueDate &&
        !assignment.submitted
    );

    res.json(unfinished);
  } catch (err) {
    sendError(res, err);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Canvas Bot running on ${PORT}`);
});
