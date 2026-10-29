const express = require("express");
const cors = require("cors");
const canvasService = require("../Homework_Tracker/services/canvasService");

const app = express();

app.use(express.json());
app.use(cors());

require("dotenv").config();

app.get("/cors-test", (req, res) => {
    res.json({
        cors: "working"
    });
});

app.get("/version", (req, res) => {
  res.send("backend version 2");
});

app.get("/", (req, res) => {
  res.send("Homework Tracker API Online");
});

// calling courses from canvasServices
app.post("/courses", async (req, res) => {  try {
  const { token } = req.body;
  const courses = await canvasService.getCourses(token);    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

// calling assignments from canvasServices
app.get("/assignments", async (req, res) => {
  try {
    const assignments =
      await canvasService.getAssignments();

    res.json(assignments);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/unfinishedHomework", async (req, res) => {
  try {
    const assignments =
      await canvasService.getAssignments();

    const unfinished = assignments.filter(
      assignment =>
        assignment.dueDate &&
        !assignment.submitted
    );

    res.json(unfinished);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Canvas Bot running on ${PORT}`);
});