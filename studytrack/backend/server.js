const express = require("express");
const cors = require("cors");
const { getDb, save } = require("./database");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Helper: run a SELECT and return rows as plain objects
function query(db, sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// Helper: run INSERT / UPDATE / DELETE
function run(db, sql, params = []) {
    db.run(sql, params);
    save(); // persist to disk after every write
}

// ─────────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────────

// GET all tasks
app.get("/api/tasks", async (req, res) => {
    try {
        const db = await getDb();
        const tasks = query(db, "SELECT * FROM tasks ORDER BY deadline ASC");
        const mapped = tasks.map((t) => ({ ...t, completed: t.completed === 1 }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST — add new task
app.post("/api/tasks", async (req, res) => {
    try {
        const db = await getDb();
        const { title, subject, deadline, priority = "Medium", category = "Assignment" } = req.body;
        if (!title || !subject || !deadline) {
            return res.status(400).json({ error: "title, subject and deadline are required" });
        }

        run(db,
            `INSERT INTO tasks (title, subject, deadline, priority, category, completed, completedAt)
       VALUES (?, ?, ?, ?, ?, 0, NULL)`,
            [title, subject, deadline, priority, category]
        );

        const rows = query(db, "SELECT * FROM tasks ORDER BY id DESC LIMIT 1");
        const newTask = { ...rows[0], completed: rows[0].completed === 1 };
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT — update task (edit or toggle complete)
app.put("/api/tasks/:id", async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const rows = query(db, "SELECT * FROM tasks WHERE id = ?", [id]);
        if (!rows.length) return res.status(404).json({ error: "Task not found" });

        const existing = rows[0];
        const {
            title = existing.title,
            subject = existing.subject,
            deadline = existing.deadline,
            priority = existing.priority,
            category = existing.category,
            completed = existing.completed,
            completedAt = existing.completedAt,
        } = req.body;

        run(db,
            `UPDATE tasks
       SET title=?, subject=?, deadline=?, priority=?, category=?, completed=?, completedAt=?
       WHERE id=?`,
            [title, subject, deadline, priority, category,
                completed ? 1 : 0,
                completedAt !== undefined ? completedAt : existing.completedAt,
                id]
        );

        const updated = query(db, "SELECT * FROM tasks WHERE id = ?", [id])[0];
        res.json({ ...updated, completed: updated.completed === 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE — remove task
app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const rows = query(db, "SELECT id FROM tasks WHERE id = ?", [id]);
        if (!rows.length) return res.status(404).json({ error: "Task not found" });
        run(db, "DELETE FROM tasks WHERE id = ?", [id]);
        res.json({ message: "Task deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
//  EXAM
// ─────────────────────────────────────────────

// GET exam details
app.get("/api/exam", async (req, res) => {
    try {
        const db = await getDb();
        const rows = query(db, "SELECT * FROM exam WHERE id = 1");
        res.json(rows[0] || { id: 1, subject: "", date: "" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT — save / update exam
app.put("/api/exam", async (req, res) => {
    try {
        const db = await getDb();
        const { subject = "", date = "" } = req.body;
        run(db, "UPDATE exam SET subject=?, date=? WHERE id=1", [subject, date]);
        const rows = query(db, "SELECT * FROM exam WHERE id = 1");
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE — clear exam
app.delete("/api/exam", async (req, res) => {
    try {
        const db = await getDb();
        run(db, "UPDATE exam SET subject='', date='' WHERE id=1");
        res.json({ message: "Exam cleared" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
//  ADMIN DASHBOARD
// ─────────────────────────────────────────────
app.get("/", async (req, res) => {
    const db = await getDb();
    const tasks = query(db, "SELECT * FROM tasks ORDER BY deadline ASC");
    const exam = query(db, "SELECT * FROM exam WHERE id = 1")[0] || {};

    const rows = tasks.map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${t.title}</td>
        <td>${t.subject}</td>
        <td>${t.deadline}</td>
        <td><span class="badge ${t.priority.toLowerCase()}">${t.priority}</span></td>
        <td><span class="badge cat">${t.category}</span></td>
        <td>${t.completed ? "✅ Done" : "⏳ Pending"}</td>
        <td>${t.completedAt ? new Date(t.completedAt).toLocaleDateString("en-IN") : "—"}</td>
      </tr>`).join("");

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="refresh" content="5"/>
  <title>StudyTrack — Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { color: #818cf8; margin-bottom: .25rem; font-size: 1.8rem; }
    p.sub { color: #64748b; margin-bottom: 2rem; font-size:.85rem; }
    h2 { color: #94a3b8; margin: 1.5rem 0 .75rem; font-size: 1rem; text-transform: uppercase; letter-spacing:.05em; }
    .exam-box { background:#1e293b; border:1px solid #334155; border-radius:10px; padding:1rem 1.5rem; display:inline-flex; gap:2rem; margin-bottom:1.5rem; }
    .exam-box span { color:#64748b; font-size:.8rem; display:block; }
    .exam-box strong { color:#e2e8f0; font-size:1.1rem; }
    table { width:100%; border-collapse:collapse; background:#1e293b; border-radius:10px; overflow:hidden; }
    th { background:#1a2540; color:#64748b; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; padding:.75rem 1rem; text-align:left; }
    td { padding:.75rem 1rem; border-top:1px solid #334155; font-size:.88rem; }
    tr:hover td { background:#263044; }
    .badge { padding:.2rem .6rem; border-radius:99px; font-size:.75rem; font-weight:600; }
    .high   { background:#450a0a; color:#fca5a5; }
    .medium { background:#451a03; color:#fcd34d; }
    .low    { background:#052e16; color:#86efac; }
    .cat    { background:#1e1b4b; color:#a5b4fc; }
    .count  { display:inline-block; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:.5rem 1.2rem; margin:0 .5rem .5rem 0; font-size:.85rem; }
    .count strong { color:#818cf8; font-size:1.3rem; display:block; }
    footer { margin-top:2rem; color:#334155; font-size:.75rem; }
  </style>
</head>
<body>
  <h1>🎓 StudyTrack Admin</h1>
  <p class="sub">Auto-refreshes every 5 seconds &nbsp;·&nbsp; Backend: <a href="/api/tasks" style="color:#818cf8">/api/tasks</a> &nbsp;·&nbsp; <a href="/api/exam" style="color:#818cf8">/api/exam</a></p>

  <h2>📊 Stats</h2>
  <div>
    <div class="count"><strong>${tasks.length}</strong>Total</div>
    <div class="count"><strong>${tasks.filter(t => !t.completed).length}</strong>Pending</div>
    <div class="count"><strong>${tasks.filter(t => t.completed).length}</strong>Completed</div>
    <div class="count"><strong>${tasks.filter(t => !t.completed && new Date(t.deadline) < new Date()).length}</strong>Overdue</div>
  </div>

  <h2>🎓 Exam</h2>
  <div class="exam-box">
    <div><span>Subject</span><strong>${exam.subject || "—"}</strong></div>
    <div><span>Date</span><strong>${exam.date || "—"}</strong></div>
  </div>

  <h2>📋 Tasks (${tasks.length})</h2>
  ${tasks.length === 0
            ? `<p style="color:#475569;padding:1rem">No tasks yet. Add one from the app!</p>`
            : `<table>
        <thead><tr>
          <th>#</th><th>Title</th><th>Subject</th><th>Deadline</th>
          <th>Priority</th><th>Category</th><th>Status</th><th>Completed On</th>
        </tr></thead>
        <tbody>${rows}</tbody>
       </table>`}

  <footer>StudyTrack API · http://localhost:5000</footer>
</body>
</html>`);
});

// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ StudyTrack API running at http://localhost:${PORT}`);
});
