const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      stories: {}
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readStore() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function getOrCreateStory(store, storyId) {
  if (!store.stories[storyId]) {
    store.stories[storyId] = {
      sessionId: storyId,
      storyId,
      adminKey: crypto.randomBytes(12).toString("hex"),
      revealed: false,
      votes: {}
    };
  }

  if (!store.stories[storyId].adminKey) {
    store.stories[storyId].adminKey = crypto.randomBytes(12).toString("hex");
  }

  if (!store.stories[storyId].sessionId) {
    store.stories[storyId].sessionId = storyId;
  }

  return store.stories[storyId];
}

function createFreshStory(store, storyId) {
  const sessionId = `${storyId}-${crypto.randomBytes(6).toString("hex")}`;
  store.stories[sessionId] = {
    sessionId,
    storyId,
    adminKey: crypto.randomBytes(12).toString("hex"),
    revealed: false,
    votes: {}
  };

  return store.stories[sessionId];
}

function toStoryResponse(story, includeVotes, isAdmin) {
  const voteEntries = Object.values(story.votes)
    .sort((left, right) => left.name.localeCompare(right.name));
  const canShowPoints = includeVotes;
  const canShowNames = isAdmin || includeVotes;

  return {
    sessionId: story.sessionId || story.storyId,
    storyId: story.storyId,
    isAdmin,
    revealed: story.revealed,
    totalVotes: voteEntries.length,
    votes: canShowNames
      ? voteEntries.map((entry) => ({
          name: entry.name,
          points: canShowPoints ? entry.points : null
        }))
      : []
  };
}

function normalizeId(value, fallback) {
  const cleaned = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || fallback;
}

function isAdminRequest(url, story) {
  return url.searchParams.get("adminKey") === story.adminKey;
}

function routeApi(req, res, url) {
  const storyId = normalizeId(url.searchParams.get("story"), "default-story");

  if (req.method === "POST" && url.pathname === "/api/story/create") {
    parseBody(req)
      .then((body) => {
        const requestedStoryId = normalizeId(body.storyId, storyId);
        const store = readStore();
        const story = createFreshStory(store, requestedStoryId);
        writeStore(store);
        sendJson(res, 200, {
          sessionId: story.sessionId,
          storyId: story.storyId,
          adminKey: story.adminKey
        });
      })
      .catch(() => {
        sendJson(res, 400, { error: "Invalid request body." });
      });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/story") {
    const store = readStore();
    const story = getOrCreateStory(store, storyId);
    const isAdmin = isAdminRequest(url, story);
    writeStore(store);
    sendJson(res, 200, toStoryResponse(story, story.revealed, isAdmin));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/vote") {
    parseBody(req)
      .then((body) => {
        const name = String(body.name || "").trim();
        const points = String(body.points || "").trim();

        if (!name || !points) {
          sendJson(res, 400, { error: "Name and story point are required." });
          return;
        }

        const store = readStore();
        const story = getOrCreateStory(store, storyId);
        const voterKey = normalizeId(name, `user-${Date.now()}`);

        story.votes[voterKey] = {
          name,
          points
        };

        writeStore(store);
        sendJson(res, 200, {
          message: "Vote submitted successfully.",
          story: toStoryResponse(story, story.revealed, isAdminRequest(url, story))
        });
      })
      .catch(() => {
        sendJson(res, 400, { error: "Invalid request body." });
      });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reveal") {
    parseBody(req)
      .then(() => {
        const store = readStore();
        const story = getOrCreateStory(store, storyId);
        if (!isAdminRequest(url, story)) {
          sendJson(res, 403, { error: "Only BA can reveal votes." });
          return;
        }
        story.revealed = true;
        writeStore(store);
        sendJson(res, 200, {
          message: "Votes revealed.",
          story: toStoryResponse(story, true, true)
        });
      })
      .catch(() => {
        sendJson(res, 400, { error: "Invalid request body." });
      });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    parseBody(req)
      .then(() => {
        const store = readStore();
        const story = getOrCreateStory(store, storyId);
        if (!isAdminRequest(url, story)) {
          sendJson(res, 403, { error: "Only BA can reset the story." });
          return;
        }
        store.stories[storyId] = {
          sessionId: story.sessionId || storyId,
          storyId: story.storyId || storyId,
          adminKey: story.adminKey,
          revealed: false,
          votes: {}
        };
        writeStore(store);
        sendJson(res, 200, {
          message: "Story reset.",
          story: toStoryResponse(store.stories[storyId], false, true)
        });
      })
      .catch(() => {
        sendJson(res, 400, { error: "Invalid request body." });
      });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    routeApi(req, res, url);
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, requestedPath);
  sendFile(res, filePath);
});

server.listen(PORT, () => {
  ensureStorage();
  console.log(`Story planning app running at http://localhost:${PORT}`);
});
