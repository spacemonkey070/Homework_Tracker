require("dotenv").config();
// getting courses from canvas api
async function getCourses() {
  const response = await fetch(
    `${process.env.CANVAS_URL}/api/v1/courses`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CANVAS_TOKEN}`
      }
    }
  );

  return response.json();
}
//getting assignments from canvas api
async function getAssignments() {
  const courses = await getCourses();

  let allAssignments = [];

  for (const course of courses) {
    const response = await fetch(
      `${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CANVAS_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      continue;
    }

    const assignments = await response.json();

    const assignmentsWithCourse =
      assignments.map(assignment => ({
        id: assignment.id,
        title: assignment.name,
        courseName: course.name,
        courseId: course.id,
        dueDate: assignment.due_at,
        points: assignment.points_possible,
        submitted: assignment.has_submitted_submissions,
        url: assignment.html_url,
        published: assignment.published
      }));

    allAssignments.push(...assignmentsWithCourse);
  }

  return allAssignments;
}

module.exports = {
  getCourses,
  getAssignments
};