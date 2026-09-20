require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "ajv-collegeconnect-local-secret";
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const FRONTEND = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND));

const departments = [
  "Information Technology",
  "Computer Science and Engineering",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Artificial Intelligence and Data Science"
];
const years = ["I Year", "II Year", "III Year", "IV Year"];

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb(createSeedDb());
}
function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}
function nextId(items) {
  return items.length ? Math.max(...items.map(x => Number(x.id) || 0)) + 1 : 1;
}
function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}
function tokenFor(u) {
  return jwt.sign({ id: u.id, role: u.role, loginId: u.loginId }, JWT_SECRET, { expiresIn: "8h" });
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required." });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Access denied for this account." });
}
function clean(v) { return String(v ?? "").trim(); }
function gradeFor(total) {
  if (total >= 90) return { grade: "O", point: 10 };
  if (total >= 80) return { grade: "A+", point: 9 };
  if (total >= 70) return { grade: "A", point: 8 };
  if (total >= 60) return { grade: "B+", point: 7 };
  if (total >= 50) return { grade: "B", point: 6 };
  if (total >= 40) return { grade: "C", point: 5 };
  return { grade: "RA", point: 0 };
}
function calculateAcademic(db, studentId) {
  const rows = db.enrollments
    .filter(e => e.studentId === studentId)
    .map(e => ({ e, c: db.courses.find(c => c.id === e.courseId) }))
    .filter(x => x.c);

  const totalMax = rows.length * 100;
  const totalObtained = rows.reduce((sum, x) => sum + Number(x.e.totalMark || 0), 0);
  const overallPercentage = totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const totalCredits = rows.reduce((sum, x) => sum + Number(x.c.credits || 0), 0);
  const weightedPoints = rows.reduce((sum, x) => sum + Number(x.e.gradePoint || 0) * Number(x.c.credits || 0), 0);
  const cgpa = totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0;
  const attendance = rows.length ? Number((rows.reduce((s, x) => s + Number(x.e.attendance || 0), 0) / rows.length).toFixed(2)) : 0;
  return { overallPercentage, cgpa, attendance, totalObtained, totalMax };
}
function refreshStudentAcademic(db, student) {
  const a = calculateAcademic(db, student.id);
  student.cgpa = a.cgpa;
  student.overallPercentage = a.overallPercentage;
  student.attendance = a.attendance;
  return a;
}

function createSeedDb() {
  const hash = p => bcrypt.hashSync(p, 10);
  const db = {
    meta: { college: "AJV College of Engineering", version: 3 },
    counters: { student: 3 },
    users: [
      { id: 1, loginId: "ADMIN001", passwordHash: hash("Admin@123"), role: "admin", fullName: "AJV Administrator", email: "admin@ajv.edu", phone: "+91 90000 00001", registerNo: "ADMIN001", department: "Administration", year: "Staff", section: "Office", status: "active" },
      { id: 2, loginId: "FAC001", passwordHash: hash("Faculty@123"), role: "staff", fullName: "Dr. Priya Faculty", email: "faculty01@ajv.edu", phone: "+91 90000 00002", registerNo: "FAC001", department: "Information Technology", year: "Staff", section: "Faculty", status: "active" },
      { id: 3, loginId: "AJVSTU001", passwordHash: hash("Student@123"), role: "student", fullName: "Ananya Kumar", email: "stu001@ajv.edu", phone: "+91 90000 00003", parentName: "R. Kumar", dob: "2007-04-15", gender: "Female", registerNo: "AJVSTU001", department: "Information Technology", year: "I Year", section: "A", address: "Coimbatore, Tamil Nadu", cgpa: 0, overallPercentage: 0, attendance: 0, status: "active" },
      { id: 4, loginId: "AJVSTU002", passwordHash: hash("Student@123"), role: "student", fullName: "Kavin Raj", email: "stu002@ajv.edu", phone: "+91 90000 00004", parentName: "S. Raj", dob: "2007-08-20", gender: "Male", registerNo: "AJVSTU002", department: "Computer Science and Engineering", year: "I Year", section: "A", address: "Tiruppur, Tamil Nadu", cgpa: 0, overallPercentage: 0, attendance: 0, status: "active" },
      { id: 5, loginId: "AJVSTU003", passwordHash: hash("Student@123"), role: "student", fullName: "Meera S", email: "stu003@ajv.edu", phone: "+91 90000 00005", parentName: "S. Sekar", dob: "2007-02-12", gender: "Female", registerNo: "AJVSTU003", department: "Information Technology", year: "I Year", section: "B", address: "Erode, Tamil Nadu", cgpa: 0, overallPercentage: 0, attendance: 0, status: "active" }
    ],
    courses: [
      { id: 1, code: "IT101", name: "Programming in C", credits: 3, department: "Information Technology" },
      { id: 2, code: "IT102", name: "Data Structures", credits: 3, department: "Information Technology" },
      { id: 3, code: "IT103", name: "Digital Principles", credits: 3, department: "Information Technology" },
      { id: 4, code: "IT104", name: "Object Oriented Programming", credits: 4, department: "Information Technology" },
      { id: 5, code: "MA101", name: "Probability & Statistics", credits: 4, department: "Common" },
      { id: 6, code: "CS101", name: "Computer Fundamentals", credits: 3, department: "Common" }
    ],
    enrollments: [],
    announcements: [
      { id: 1, title: "Internal Assessment", body: "Staff can now enter and update student marks from the Academic Records section.", createdAt: new Date().toISOString() },
      { id: 2, title: "College Portal", body: "Student registration automatically generates a secure login ID.", createdAt: new Date().toISOString() }
    ]
  };
  const demoMarks = [
    [3, 1, 92, 36, 54], [3, 2, 89, 34, 51], [3, 3, 94, 37, 55], [3, 4, 91, 38, 56], [3, 5, 88, 35, 50],
    [4, 1, 87, 34, 49], [4, 2, 83, 32, 47], [4, 3, 90, 36, 53],
    [5, 1, 96, 38, 57], [5, 2, 93, 37, 55], [5, 3, 95, 39, 58]
  ];
  for (const [studentId, courseId, attendance, internal, external] of demoMarks) {
    const total = internal + external;
    const g = gradeFor(total);
    db.enrollments.push({ id: db.enrollments.length + 1, studentId, courseId, attendance, internalMark: internal, externalMark: external, totalMark: total, percentage: total, grade: g.grade, gradePoint: g.point, updatedAt: new Date().toISOString() });
  }
  for (const s of db.users.filter(u => u.role === "student")) refreshStudentAcademic(db, s);
  return db;
}

ensureDb();

app.get("/api/health", (_req, res) => res.json({ ok: true, backend: "online", database: "local-persistent-json", college: "AJV College of Engineering" }));
app.get("/api/config", (_req, res) => res.json({ college: "AJV College of Engineering", departments, years }));

app.post("/api/auth/login", (req, res) => {
  const loginId = clean(req.body.loginId);
  const password = String(req.body.password || "");
  const requestedRole = clean(req.body.role).toLowerCase();
  if (!loginId || !password || !requestedRole) return res.status(400).json({ message: "Login ID, password and account type are required." });
  const db = readDb();
  const user = db.users.find(u => u.loginId.toLowerCase() === loginId.toLowerCase() && u.role === requestedRole && u.status === "active");
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ message: "Invalid Login ID or password." });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

app.post("/api/students/register", (req, res) => {
  const fullName = clean(req.body.fullName), email = clean(req.body.email).toLowerCase(), phone = clean(req.body.phone);
  const parentName = clean(req.body.parentName), dob = clean(req.body.dob), gender = clean(req.body.gender);
  const department = clean(req.body.department), year = clean(req.body.year), section = clean(req.body.section), address = clean(req.body.address);
  const password = String(req.body.password || "");
  if (![fullName, email, phone, parentName, dob, gender, department, year, section, address, password].every(Boolean)) return res.status(400).json({ message: "Please fill every mandatory field." });
  if (!departments.includes(department)) return res.status(400).json({ message: "Please select a valid department." });
  if (!years.includes(year)) return res.status(400).json({ message: "Please select a valid year." });
  if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) return res.status(400).json({ message: "Enter a valid 10-digit phone number." });
  if (password.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email)) return res.status(409).json({ message: "Email is already registered." });
  const studentNumber = Number(db.counters?.student || 0) + 1;
  db.counters = db.counters || {};
  db.counters.student = studentNumber;
  const loginId = `AJVSTU${String(studentNumber).padStart(3, "0")}`;
  const user = { id: nextId(db.users), loginId, passwordHash: bcrypt.hashSync(password, 10), role: "student", fullName, email, phone: phone.replace(/\D/g, ""), parentName, dob, gender, registerNo: loginId, department, year, section, address, cgpa: 0, overallPercentage: 0, attendance: 0, status: "active" };
  db.users.push(user); writeDb(db);
  res.status(201).json({ message: "Registration completed successfully.", loginId, registerNo: loginId, studentName: fullName });
});

app.get("/api/me", auth, (req, res) => {
  const db = readDb(); const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  res.json(publicUser(u));
});

function courseRecords(db, studentId) {
  return db.enrollments.filter(e => e.studentId === studentId).map(e => ({ ...e, course: db.courses.find(c => c.id === e.courseId) })).filter(x => x.course);
}

app.get("/api/student/dashboard", auth, role("student"), (req, res) => {
  const db = readDb(); const profile = db.users.find(x => x.id === req.user.id);
  if (!profile) return res.status(404).json({ message: "Student not found." });
  const academic = refreshStudentAcademic(db, profile); writeDb(db);
  res.json({ profile: publicUser(profile), academic, courses: courseRecords(db, profile.id), announcements: db.announcements.slice(-6).reverse() });
});

app.get("/api/staff/dashboard", auth, role("staff", "admin"), (_req, res) => {
  const db = readDb(); const students = db.users.filter(u => u.role === "student");
  students.forEach(s => refreshStudentAcademic(db, s)); writeDb(db);
  res.json({ counts: { students: students.length, staff: db.users.filter(u => ["staff", "admin"].includes(u.role)).length, courses: db.courses.length, departments: new Set(students.map(s => s.department)).size }, recent: students.slice(-8).reverse().map(publicUser) });
});

app.get("/api/staff/students", auth, role("staff", "admin"), (_req, res) => {
  const db = readDb(); const students = db.users.filter(u => u.role === "student");
  students.forEach(s => refreshStudentAcademic(db, s)); writeDb(db);
  res.json(students.sort((a,b) => a.registerNo.localeCompare(b.registerNo)).map(publicUser));
});

app.get("/api/staff/students/:id", auth, role("staff", "admin"), (req, res) => {
  const db = readDb(); const student = db.users.find(u => u.id === Number(req.params.id) && u.role === "student");
  if (!student) return res.status(404).json({ message: "Student not found." });
  const academic = refreshStudentAcademic(db, student); writeDb(db);
  res.json({ student: publicUser(student), academic, courses: courseRecords(db, student.id) });
});

app.get("/api/courses", auth, role("staff", "admin"), (_req, res) => res.json(readDb().courses));

app.put("/api/staff/students/:id/marks", auth, role("staff", "admin"), (req, res) => {
  const db = readDb(); const studentId = Number(req.params.id); const courseId = Number(req.body.courseId);
  const student = db.users.find(u => u.id === studentId && u.role === "student");
  const course = db.courses.find(c => c.id === courseId);
  if (!student || !course) return res.status(404).json({ message: "Student or course not found." });
  const attendance = Number(req.body.attendance), internalMark = Number(req.body.internalMark), externalMark = Number(req.body.externalMark);
  if (![attendance, internalMark, externalMark].every(Number.isFinite)) return res.status(400).json({ message: "Enter valid numeric marks." });
  if (attendance < 0 || attendance > 100) return res.status(400).json({ message: "Attendance must be between 0 and 100." });
  if (internalMark < 0 || internalMark > 40) return res.status(400).json({ message: "Internal mark must be between 0 and 40." });
  if (externalMark < 0 || externalMark > 60) return res.status(400).json({ message: "External mark must be between 0 and 60." });
  const totalMark = internalMark + externalMark;
  const g = gradeFor(totalMark);
  const existing = db.enrollments.find(e => e.studentId === studentId && e.courseId === courseId);
  const record = { id: existing?.id || nextId(db.enrollments), studentId, courseId, attendance, internalMark, externalMark, totalMark, percentage: totalMark, grade: g.grade, gradePoint: g.point, updatedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, record); else db.enrollments.push(record);
  const academic = refreshStudentAcademic(db, student); writeDb(db);
  res.json({ message: "Marks saved. Percentage, grade and CGPA updated automatically.", record, academic });
});

app.post("/api/staff/students/:id/reset-password", auth, role("admin"), (req, res) => {
  const db = readDb(); const student = db.users.find(u => u.id === Number(req.params.id) && u.role === "student");
  if (!student) return res.status(404).json({ message: "Student not found." });
  const newPassword = String(req.body.password || "Student@123");
  if (newPassword.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
  student.passwordHash = bcrypt.hashSync(newPassword, 10); writeDb(db);
  res.json({ message: "Student password reset successfully." });
});

app.put("/api/profile", auth, (req, res) => {
  const fullName = clean(req.body.fullName), email = clean(req.body.email).toLowerCase(), phone = clean(req.body.phone);
  if (!fullName || !email) return res.status(400).json({ message: "Name and email are required." });
  const db = readDb(); const duplicate = db.users.find(u => u.id !== req.user.id && u.email.toLowerCase() === email);
  if (duplicate) return res.status(409).json({ message: "Email is already in use." });
  const u = db.users.find(x => x.id === req.user.id); if (!u) return res.status(404).json({ message: "User not found." });
  u.fullName = fullName; u.email = email; u.phone = phone; writeDb(db); res.json({ message: "Profile updated successfully." });
});

app.use("/api", (_req, res) => res.status(404).json({ message: "API endpoint not found." }));
app.get("*", (_req, res) => res.sendFile(path.join(FRONTEND, "index.html")));

app.listen(PORT, () => console.log(`AJV College of Engineering portal running at http://localhost:${PORT}`));
