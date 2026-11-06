import { useState, useEffect, useRef } from "react";

const API = "http://localhost:5000/api";

function App() {
  const [tasks, setTasks] = useState([]);
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("studyTrackDarkMode") === "true";
  });

  // ── Load tasks & exam on mount ──────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/tasks`)
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => console.error("Could not reach backend"));

    fetch(`${API}/exam`)
      .then((r) => r.json())
      .then((data) => {
        setExamSubject(data.subject || "");
        setExamDate(data.date || "");
      })
      .catch(() => console.error("Could not reach backend"));
  }, []);

  // ── Persist dark mode preference ────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("studyTrackDarkMode", darkMode);
  }, [darkMode]);

  // ── Exam countdown timer ─────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!examDate) { setTimeLeft(null); return; }

    const update = () => {
      const diff = new Date(`${examDate}T23:59:59`) - new Date();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [examDate]);

  // ── Form state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("Assignment");
  const [editingId, setEditingId] = useState(null);

  // ── Search / filter / sort ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("deadline-asc");
  const [page, setPage] = useState("dashboard");

  // ── Exam save (debounced) ────────────────────────────────────────────
  const examTimer = useRef(null);
  const saveExam = (sub, dt) => {
    clearTimeout(examTimer.current);
    examTimer.current = setTimeout(() => {
      fetch(`${API}/exam`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: sub, date: dt }),
      });
    }, 600);
  };

  // ── Add / Edit task ──────────────────────────────────────────────────
  const addTask = async () => {
    if (!title || !subject || !deadline) { alert("Please fill all fields"); return; }

    if (editingId !== null) {
      const res = await fetch(`${API}/tasks/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, deadline, priority, category }),
      });
      const updated = await res.json();
      setTasks(tasks.map((t) => (t.id === editingId ? updated : t)));
      setEditingId(null);
    } else {
      const res = await fetch(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, deadline, priority, category }),
      });
      const newTask = await res.json();
      setTasks([...tasks, newTask]);
    }

    setTitle(""); setSubject(""); setDeadline("");
    setPriority("Medium"); setCategory("Assignment");
  };

  // ── Toggle complete ──────────────────────────────────────────────────
  const toggleTask = async (id) => {
    const task = tasks.find((t) => t.id === id);
    const nowCompleted = !task.completed;
    const res = await fetch(`${API}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date().toISOString() : null,
      }),
    });
    const updated = await res.json();
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  };

  // ── Delete task ──────────────────────────────────────────────────────
  const deleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // ── Edit task (populate form) ────────────────────────────────────────
  const editTask = (task) => {
    setTitle(task.title);
    setSubject(task.subject);
    setDeadline(task.deadline);
    setPriority(task.priority);
    setCategory(task.category || "Assignment");
    setEditingId(task.id);
  };

  // ── Derived values ───────────────────────────────────────────────────
  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const completionPercentage = tasks.length === 0
    ? 0 : Math.round((completedTasks.length / tasks.length) * 100);

  const overdueTasks = tasks.filter((t) => !t.completed && new Date(t.deadline) < new Date());
  const highPriorityTasks = tasks.filter((t) => t.priority === "High" && !t.completed);

  const categoryStats = {
    Assignment: tasks.filter((t) => (t.category || "Assignment") === "Assignment").length,
    Lab: tasks.filter((t) => t.category === "Lab").length,
    Project: tasks.filter((t) => t.category === "Project").length,
    Exam: tasks.filter((t) => t.category === "Exam").length,
    Other: tasks.filter((t) => t.category === "Other").length,
  };

  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.subject.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Pending" && !task.completed) ||
        (filter === "Completed" && task.completed) ||
        (filter === "Overdue" && !task.completed && new Date(task.deadline) < new Date());
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sort === "deadline-asc") return new Date(a.deadline) - new Date(b.deadline);
      if (sort === "deadline-desc") return new Date(b.deadline) - new Date(a.deadline);
      return 0;
    });

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className={darkMode ? "app dark-mode" : "app"}>
      {/* Navbar */}
      <nav>
        <h2>StudyTrack</h2>
        <div>
          <button className={page === "dashboard" ? "active-nav" : ""} onClick={() => setPage("dashboard")}>Dashboard</button>
          <button className={page === "tasks" ? "active-nav" : ""} onClick={() => setPage("tasks")}>Tasks</button>
          <button className={page === "profile" ? "active-nav" : ""} onClick={() => setPage("profile")}>Profile</button>
          <button onClick={() => setDarkMode(!darkMode)}>{darkMode ? "☀️ Light" : "🌙 Dark"}</button>
        </div>
      </nav>

      <main>

        {/* ================= DASHBOARD ================= */}
        {page === "dashboard" && (
          <>
            <section className="exam-section">
              <h2>🎓 Exam Countdown</h2>
              <div className="exam-form">
                <input
                  type="text"
                  placeholder="Exam subject"
                  value={examSubject}
                  onChange={(e) => {
                    setExamSubject(e.target.value);
                    saveExam(e.target.value, examDate);
                  }}
                />
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => {
                    setExamDate(e.target.value);
                    saveExam(examSubject, e.target.value);
                  }}
                />
                <button
                  className="delete-btn"
                  onClick={() => {
                    setExamSubject("");
                    setExamDate("");
                    fetch(`${API}/exam`, { method: "DELETE" });
                  }}
                >
                  Clear Exam
                </button>
              </div>
            </section>

            {examDate && timeLeft && (
              <div className="countdown">
                <h3>{examSubject || "Upcoming Exam"}</h3>
                <p>
                  📅 Exam Date:{" "}
                  {new Date(examDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 ? (
                  <p>🎓 Exam day is here!</p>
                ) : (
                  <div className="countdown-time">
                    <div><strong>{timeLeft.days}</strong><span>Days</span></div>
                    <div><strong>{timeLeft.hours}</strong><span>Hours</span></div>
                    <div><strong>{timeLeft.minutes}</strong><span>Minutes</span></div>
                    <div><strong>{timeLeft.seconds}</strong><span>Seconds</span></div>
                  </div>
                )}
              </div>
            )}

            <h1>Welcome back! 👋</h1>
            <p>Here is an overview of your academic tasks.</p>
            <p className="today-date">
              Today:{" "}
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            {overdueTasks.length > 0 && (
              <div className="overdue-warning">
                ⚠️ You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}.
              </div>
            )}

            {/* Study Progress */}
            <section className="progress-section">
              <div className="progress-header">
                <h2>Study Progress</h2>
                <span>{completionPercentage}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${completionPercentage}%` }}></div>
              </div>
              <p>{completedTasks.length} of {tasks.length} tasks completed</p>
            </section>

            {/* High Priority Tasks */}
            <section className="priority-section">
              <div className="section-header">
                <h2>🎯 High Priority Tasks</h2>
                <span>{highPriorityTasks.length} remaining</span>
              </div>
              {highPriorityTasks.length === 0 ? (
                <p className="no-priority">🎉 No high priority tasks remaining!</p>
              ) : (
                highPriorityTasks.map((task) => (
                  <div className="priority-task" key={task.id}>
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.subject} • Due: {task.deadline}</p>
                    </div>
                    <button onClick={() => toggleTask(task.id)} className="complete-btn">Complete</button>
                  </div>
                ))
              )}
            </section>

            {/* Statistics */}
            <section className="stats">
              <div className="card"><h3>{tasks.length}</h3><p>Total Tasks</p></div>
              <div className="card"><h3>{pendingTasks.length}</h3><p>Pending</p></div>
              <div className="card"><h3>{completedTasks.length}</h3><p>Completed</p></div>
              <div className="card"><h3>{overdueTasks.length}</h3><p>Overdue</p></div>
            </section>
          </>
        )}

        {/* ================= TASKS PAGE ================= */}
        {page === "tasks" && (
          <>
            <h1>My Tasks 📋</h1>
            <p>Manage all your academic tasks here.</p>

            {/* Add / Edit Task */}
            <section className="add-task-section">
              <h2>{editingId !== null ? "Edit Task" : "Add New Task"}</h2>
              <div className="task-form">
                <input type="text" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Assignment</option>
                  <option>Lab</option>
                  <option>Project</option>
                  <option>Exam</option>
                  <option>Other</option>
                </select>

                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>

                <button className="add-btn" onClick={addTask}>
                  {editingId !== null ? "Update Task" : "Add Task"}
                </button>

                {editingId !== null && (
                  <button
                    className="delete-btn"
                    onClick={() => {
                      setEditingId(null);
                      setTitle(""); setSubject(""); setDeadline("");
                      setPriority("Medium"); setCategory("Assignment");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </section>

            {/* Task List */}
            <section className="tasks-section">
              <div className="section-header">
                <h2>All Tasks</h2>
                <input type="text" placeholder="🔍 Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="All">All Tasks</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="deadline-asc">Deadline: Earliest</option>
                  <option value="deadline-desc">Deadline: Latest</option>
                </select>
              </div>

              {filteredTasks.length === 0 ? (
                <p className="no-priority">No tasks found.</p>
              ) : (
                filteredTasks.map((task) => {
                  const isCompletedLate =
                    task.completed && task.completedAt &&
                    new Date(task.completedAt) > new Date(task.deadline);
                  return (
                    <div className="task" key={task.id}>
                      <div>
                        <h3>{task.title}</h3>
                        <p>{task.subject} • Due: {task.deadline}</p>
                      </div>
                      <span className={task.priority.toLowerCase()}>{task.priority}</span>
                      <span className="category-badge">{task.category || "Assignment"}</span>

                      {task.completed && (
                        <span>
                          {isCompletedLate ? "⚠️ Completed Late" : "✅ Completed"}
                          {task.completedAt && (
                            <small className="completed-date">
                              {" "}• {new Date(task.completedAt).toLocaleDateString("en-IN")}
                            </small>
                          )}
                        </span>
                      )}

                      <button className="complete-btn" onClick={() => toggleTask(task.id)}>
                        {task.completed ? "Undo" : "Complete"}
                      </button>
                      <button className="edit-btn" onClick={() => editTask(task)}>Edit</button>
                      <button className="delete-btn" onClick={() => deleteTask(task.id)}>Delete</button>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {/* ================= PROFILE PAGE ================= */}
        {page === "profile" && (
          <>
            <h1>My Profile 👤</h1>
            <p>Track your overall productivity and progress.</p>

            <section className="profile-section">
              <h2>Study Summary</h2>
              <div className="profile-stats">
                <div><h3>{tasks.length}</h3><p>Total Tasks Created</p></div>

                <div className="category-stats">
                  <h3>Tasks by Category</h3>
                  <div className="category-grid">
                    <div><strong>{categoryStats.Assignment}</strong><span>📚 Assignment</span></div>
                    <div><strong>{categoryStats.Lab}</strong><span>🧪 Lab</span></div>
                    <div><strong>{categoryStats.Project}</strong><span>💻 Project</span></div>
                    <div><strong>{categoryStats.Exam}</strong><span>📝 Exam</span></div>
                    <div><strong>{categoryStats.Other}</strong><span>📌 Other</span></div>
                  </div>
                </div>

                <div><h3>{completedTasks.length}</h3><p>Tasks Completed</p></div>
                <div><h3>{pendingTasks.length}</h3><p>Tasks Pending</p></div>
                <div><h3>{completionPercentage}%</h3><p>Overall Progress</p></div>
              </div>
            </section>

            <section className="profile-section">
              <h2>About StudyTrack</h2>
              <p>StudyTrack helps students organize academic tasks, track deadlines, and monitor study progress.</p>
            </section>
          </>
        )}

      </main>
    </div>
  );
}

export default App;