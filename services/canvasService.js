require("dotenv").config();

// Every call gets the token of the person using the site.
// Nothing here reads CANVAS_TOKEN from the server's environment anymore.
function authHeaders(token) {
  if (!token) {
    const err = new Error("Missing Canvas token");
    err.status = 401;
    throw err;
  }
  return { Authorization: `Bearer ${token}` };
}

// follows Canvas pagination via the Link header
async function canvasFetchAll(path, token) {
  const headers = authHeaders(token);
  let url = `${process.env.CANVAS_URL}${path}`;
  const results = [];

  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      // status is kept on the error so server.js can tell a bad token (401)
      // apart from other failures
      const err = new Error(`Canvas ${response.status} for ${path}`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    results.push(...data);

    const link = response.headers.get("link");
    const next = link && link.split(",").find(p => p.includes('rel="next"'));
    url = next ? next.match(/<([^>]+)>/)[1] : null;
  }

  return results;
}

async function getCourses(token) {
  const courses = await canvasFetchAll(
    "/api/v1/courses?enrollment_state=active&per_page=100",
    token
  );
  return courses.filter(c => c.id && c.name); // drop restricted stubs
}

async function getAssignments(token) {
  const courses = await getCourses(token);
  const allAssignments = [];

  for (const course of courses) {
    try {
      const assignments = await canvasFetchAll(
        `/api/v1/courses/${course.id}/assignments?per_page=100&include[]=submission&include[]=all_dates`,
        token
      );

      console.log(`${course.name}: ${assignments.length} assignments`);

      for (const a of assignments) {
        const state = a.submission?.workflow_state;
        allAssignments.push({
          id: a.id,
          title: a.name,
          courseName: course.name,
          courseId: course.id,
          dueDate: a.due_at ?? a.all_dates?.[0]?.due_at ?? null,
          points: a.points_possible,
          submitted: state === "submitted" || state === "graded",
          url: a.html_url,
          published: a.published
        });
      }
    } catch (err) {
      console.error(`Failed for ${course.name}:`, err.message);
    }
  }

  return allAssignments;
}

module.exports = { getCourses, getAssignments };
