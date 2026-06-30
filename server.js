/**
 * WebFTP backend — a real FTP bridge for the browser UI.
 * Browsers can't open raw FTP sockets, so this small Express server does the
 * actual FTP protocol work (via the "basic-ftp" npm package) and exposes it
 * as a simple JSON/REST API that the frontend calls with fetch().
 *
 * Run:  node server.js
 * Then open client.html in your browser (or serve it via `npx serve .`).
 */
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const ftp = require("basic-ftp");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: os.tmpdir() });

// One FTP client per browser "session" (very small in-memory session store).
// In production you'd back this with proper auth + expiry.
const sessions = new Map();
function newSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function getSession(req) {
  const id = req.headers["x-session-id"];
  const s = sessions.get(id);
  if (!s) throw { status: 401, message: "Not connected. Call /api/connect first." };
  return s;
}

// ---------- Connect ----------
app.post("/api/connect", async (req, res) => {
  const { host, user, password, port, secure } = req.body;
  if (!host) return res.status(400).json({ error: "Host is required." });

  const client = new ftp.Client(15000); // 15s timeout
  client.ftp.verbose = false;
  try {
    await client.access({
      host,
      user: user || "anonymous",
      password: password || "",
      port: port ? Number(port) : 21,
      secure: !!secure, // true = FTPS
    });
    const id = newSessionId();
    sessions.set(id, { client, host, cwd: "/" });
    const list = await client.list();
    res.json({
      sessionId: id,
      message: `Connected to ${host} as ${user || "anonymous"}.`,
      cwd: "/",
      list: list.map(formatEntry),
    });
  } catch (err) {
    client.close();
    res.status(502).json({ error: err.message || "Connection failed." });
  }
});

// ---------- Disconnect ----------
app.post("/api/disconnect", (req, res) => {
  const id = req.headers["x-session-id"];
  const s = sessions.get(id);
  if (s) {
    s.client.close();
    sessions.delete(id);
  }
  res.json({ ok: true });
});

// ---------- List directory ----------
app.get("/api/list", async (req, res) => {
  try {
    const s = getSession(req);
    const dir = req.query.path || s.cwd;
    await s.client.cd(dir);
    s.cwd = await s.client.pwd();
    const list = await s.client.list();
    res.json({ cwd: s.cwd, list: list.map(formatEntry) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Make directory ----------
app.post("/api/mkdir", async (req, res) => {
  try {
    const s = getSession(req);
    await s.client.send("MKD " + req.body.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Rename ----------
app.post("/api/rename", async (req, res) => {
  try {
    const s = getSession(req);
    await s.client.rename(req.body.from, req.body.to);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Delete file ----------
app.post("/api/delete", async (req, res) => {
  try {
    const s = getSession(req);
    if (req.body.isDir) await s.client.removeDir(req.body.name);
    else await s.client.remove(req.body.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Download (stream remote file to browser) ----------
app.get("/api/download", async (req, res) => {
  try {
    const s = getSession(req);
    const remoteName = req.query.name;
    const tmp = path.join(os.tmpdir(), Date.now() + "-" + remoteName);
    await s.client.downloadTo(tmp, remoteName);
    res.download(tmp, remoteName, () => fs.unlink(tmp, () => {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Upload (browser file -> remote server) ----------
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const s = getSession(req);
    await s.client.uploadFrom(req.file.path, req.file.originalname);
    fs.unlink(req.file.path, () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function formatEntry(e) {
  return {
    name: e.name,
    isDir: e.isDirectory,
    size: e.size,
    date: e.modifiedAt ? e.modifiedAt.toISOString().slice(0, 16).replace("T", " ") : "",
    permissions: e.permissions ? e.rawModifiedAt || "" : "",
    raw: e.type,
  };
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`WebFTP backend listening on port ${PORT}`);
});
