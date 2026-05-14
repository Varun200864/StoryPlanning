const elements = {
  modeEyebrow: document.getElementById("modeEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  pageIntro: document.getElementById("pageIntro"),
  homeBtn: document.getElementById("homeBtn"),
  fileModeNotice: document.getElementById("fileModeNotice"),
  adminView: document.getElementById("adminView"),
  participantView: document.getElementById("participantView"),
  storyForm: document.getElementById("storyForm"),
  newStoryId: document.getElementById("newStoryId"),
  createStoryBtn: document.getElementById("createStoryBtn"),
  createStatus: document.getElementById("createStatus"),
  participantLink: document.getElementById("participantLink"),
  controlPanel: document.getElementById("controlPanel"),
  storyLabel: document.getElementById("storyLabel"),
  responseLabel: document.getElementById("responseLabel"),
  revealBtn: document.getElementById("revealBtn"),
  resetBtn: document.getElementById("resetBtn"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  adminStatus: document.getElementById("adminStatus"),
  hiddenNotice: document.getElementById("hiddenNotice"),
  resultsPanel: document.getElementById("resultsPanel"),
  voteForm: document.getElementById("voteForm"),
  name: document.getElementById("name"),
  points: document.getElementById("points"),
  voteStatus: document.getElementById("voteStatus"),
  participantStoryTitle: document.getElementById("participantStoryTitle"),
  participantSummary: document.getElementById("participantSummary"),
  participantResults: document.getElementById("participantResults")
};

let storyPollingId = null;
let storyIdHasManualEdit = false;
let syncedStoryId = "";
let isCreatingParticipantLink = false;

function getUrl() {
  return new URL(window.location.href);
}

function isFileMode() {
  return window.location.protocol === "file:";
}

function getAdminKey() {
  return getUrl().searchParams.get("adminKey") || "";
}

function hasStoryParam() {
  return getUrl().searchParams.has("story");
}

function getStoryId() {
  return getUrl().searchParams.get("story") || "default-story";
}

function setPageUrl(storyId, adminKey = "") {
  const url = getUrl();
  url.searchParams.set("story", storyId);
  if (adminKey) {
    url.searchParams.set("adminKey", adminKey);
  } else {
    url.searchParams.delete("adminKey");
  }
  window.history.replaceState({}, "", url);
}

function buildApiUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("story", getStoryId());
  if (getAdminKey()) {
    url.searchParams.set("adminKey", getAdminKey());
  }
  return url;
}

function buildPhpApiUrl(path) {
  const url = new URL("/api.php", window.location.origin);
  url.searchParams.set("route", path.replace(/^\/api/, ""));
  url.searchParams.set("story", getStoryId());
  if (getAdminKey()) {
    url.searchParams.set("adminKey", getAdminKey());
  }
  return url;
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = bodyText.trim().slice(0, 80);
    throw new Error(
      preview.startsWith("<")
        ? "The server returned HTML instead of JSON. The app will retry with the PHP API path."
        : "The server returned an unexpected response."
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    throw new Error("The server returned invalid JSON.");
  }
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const fetchOptions = {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  };

  const endpoints = [buildApiUrl(path), buildPhpApiUrl(path)].map((endpoint) => {
    const requestUrl = new URL(endpoint);
    if (method === "GET") {
      requestUrl.searchParams.set("_ts", Date.now().toString());
    }
    return requestUrl;
  });

  let lastError = new Error("Request failed");

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, fetchOptions);
      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function setMode(mode) {
  const isSetup = mode === "setup";
  const isAdmin = mode === "admin";
  const isParticipant = mode === "participant";

  elements.adminView.style.display = isSetup || isAdmin ? "grid" : "none";
  elements.participantView.style.display = isParticipant ? "grid" : "none";
  elements.adminView.classList.toggle("setup-mode", isSetup);
  elements.homeBtn.style.display = "inline-flex";
  elements.controlPanel.style.display = isSetup ? "none" : "block";
  elements.revealBtn.style.display = isSetup ? "none" : "inline-flex";
  elements.resetBtn.style.display = isSetup ? "none" : "inline-flex";
  elements.newSessionBtn.style.display = isSetup ? "none" : "inline-flex";

  if (isSetup) {
    elements.modeEyebrow.textContent = "BA Workspace";
    elements.pageTitle.textContent = "Create a planning round and share it in seconds.";
    elements.pageIntro.textContent = "Create one link for participants.";
    elements.storyLabel.textContent = "Not created yet";
    elements.responseLabel.textContent = "-";
  } else if (isAdmin) {
    elements.modeEyebrow.textContent = "BA Workspace";
    elements.pageTitle.textContent = "Run the reveal when the room is ready.";
    elements.pageIntro.textContent = "Track responses and reveal points.";
  } else {
    elements.modeEyebrow.textContent = "Participant View";
    elements.pageTitle.textContent = "Estimate privately, reveal together.";
    elements.pageIntro.textContent = "Enter your name after opening the shared link, submit your point, and wait for the BA to reveal the session.";
  }
}

function setLinks(storyId, adminKey = "") {
  if (isFileMode()) {
    elements.participantLink.value = "Run with http://localhost:3000 to generate shareable links";
    return;
  }

  const participantUrl = new URL(window.location.origin);
  participantUrl.searchParams.set("story", storyId);
  elements.participantLink.value = participantUrl.toString();

}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderVoteCards(container, votes) {
  if (!votes.length) {
    container.innerHTML = '<div class="empty-card">No revealed votes yet.</div>';
    return;
  }

  container.innerHTML = votes
    .map(
      (vote) => `
        <article class="vote-card">
          <div class="vote-name">${escapeHtml(vote.name)}</div>
          <div class="vote-points">${escapeHtml(vote.points)}</div>
        </article>
      `
    )
    .join("");
}

function renderAdminStory(story) {
  elements.storyLabel.textContent = story.storyId;
  elements.responseLabel.textContent = String(story.totalVotes);
  elements.hiddenNotice.style.display = story.revealed ? "none" : "block";
  elements.resultsPanel.style.display = "grid";

  if (story.revealed) {
    renderVoteCards(elements.resultsPanel, story.votes);
  } else {
    renderHiddenVoteCards(elements.resultsPanel, story.votes);
  }
}

function renderHiddenVoteCards(container, votes) {
  if (!votes.length) {
    container.innerHTML = '<div class="empty-card">No votes submitted yet.</div>';
    return;
  }

  container.innerHTML = votes.map((vote) => `
    <article class="hidden-vote-card">
      <span class="hidden-vote-dot"></span>
      <span>${escapeHtml(vote.name)}</span>
      <strong class="hidden-points">Hidden</strong>
    </article>
  `).join("");
}

function renderParticipantStory(story) {
  elements.participantStoryTitle.textContent = `Story: ${story.storyId}`;

  if (story.revealed) {
    elements.participantSummary.textContent = "Reveal is complete. Final points are now visible below.";
    renderVoteCards(elements.participantResults, story.votes);
  } else {
    elements.participantSummary.textContent = `${story.totalVotes} vote(s) submitted so far. Names and points stay hidden until reveal.`;
    elements.participantResults.innerHTML = '<div class="empty-card">Waiting for BA to reveal the session.</div>';
  }
}

function renderStory(story) {
  setMode(story.isAdmin ? "admin" : "participant");
  setLinks(story.sessionId || getStoryId());
  const canSyncStoryId =
    !storyIdHasManualEdit &&
    (elements.newStoryId.value === "" || elements.newStoryId.value === syncedStoryId);

  if (canSyncStoryId) {
    elements.newStoryId.value = story.storyId;
    syncedStoryId = story.storyId;
  }
  if (story.isAdmin) {
    renderAdminStory(story);
  } else {
    renderParticipantStory(story);
  }
}

function renderSetupState() {
  setMode("setup");
  storyIdHasManualEdit = false;
  syncedStoryId = "";
  elements.newStoryId.value = "";
  elements.participantLink.value = "";
  elements.createStatus.textContent = "";
  elements.adminStatus.textContent = "";
  elements.hiddenNotice.style.display = "block";
  elements.hiddenNotice.innerHTML = `
    <h3>Create your first session</h3>
  `;
  elements.resultsPanel.style.display = "none";
  elements.resultsPanel.innerHTML = "";
}

function renderFileModeState() {
  elements.fileModeNotice.classList.remove("hidden");
  renderSetupState();
  elements.createStatus.textContent = "Direct file open cannot create links. Open the site through a web server or your Hostinger domain first.";
  elements.createStoryBtn.disabled = true;
}

async function loadStory() {
  try {
    if (document.activeElement === elements.newStoryId) {
      return;
    }

    const story = await request("/api/story");
    renderStory(story);
  } catch (error) {
    elements.adminStatus.textContent = error.message;
    elements.voteStatus.textContent = error.message;
  }
}

function startStoryPolling() {
  if (storyPollingId) {
    return;
  }

  storyPollingId = setInterval(loadStory, 1000);
}

function stopStoryPolling() {
  if (!storyPollingId) {
    return;
  }

  clearInterval(storyPollingId);
  storyPollingId = null;
}

function clearPageUrl() {
  const url = getUrl();
  url.searchParams.delete("story");
  url.searchParams.delete("adminKey");
  window.history.replaceState({}, "", url);
}

async function createParticipantLink() {
  if (isCreatingParticipantLink) {
    return;
  }

  isCreatingParticipantLink = true;
  elements.createStatus.textContent = "";
  const requestedStoryId = elements.newStoryId.value;

  try {
    const data = await request("/api/story/create", {
      method: "POST",
      body: JSON.stringify({
        storyId: requestedStoryId
      })
    });

    storyIdHasManualEdit = false;
    syncedStoryId = data.storyId;
    elements.newStoryId.value = data.storyId;
    setPageUrl(data.sessionId, data.adminKey);
    setLinks(data.sessionId, data.adminKey);
    elements.createStatus.textContent = "New session created.";
    await loadStory();
    startStoryPolling();
  } catch (error) {
    elements.createStatus.textContent = error.message;
  } finally {
    isCreatingParticipantLink = false;
  }
}

if (elements.storyForm) {
  elements.storyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createParticipantLink();
  });
}

elements.createStoryBtn.addEventListener("click", (event) => {
  event.preventDefault();
  createParticipantLink();
});

elements.voteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.voteStatus.textContent = "";

  try {
    const data = await request("/api/vote", {
      method: "POST",
      body: JSON.stringify({
        name: elements.name.value,
        points: elements.points.value
      })
    });

    elements.voteStatus.textContent = `Submitted point: ${elements.points.value}`;
    elements.points.classList.add("is-submitted");
    renderStory(data.story);
  } catch (error) {
    elements.voteStatus.textContent = error.message;
  }
});

elements.newStoryId.addEventListener("input", () => {
  storyIdHasManualEdit = true;
});

elements.newStoryId.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  createParticipantLink();
});

elements.newStoryId.addEventListener("keyup", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  createParticipantLink();
});

elements.points.addEventListener("change", () => {
  elements.points.classList.remove("is-submitted");
  elements.voteStatus.textContent = "";
});

elements.revealBtn.addEventListener("click", async () => {
  elements.adminStatus.textContent = "";

  try {
    const data = await request("/api/reveal", {
      method: "POST",
      body: JSON.stringify({})
    });

    elements.adminStatus.textContent = data.message;
    renderStory(data.story);
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.resetBtn.addEventListener("click", async () => {
  elements.adminStatus.textContent = "";

  try {
    const data = await request("/api/reset", {
      method: "POST",
      body: JSON.stringify({})
    });

    elements.adminStatus.textContent = data.message;
    renderStory(data.story);
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

function goHome() {
  stopStoryPolling();
  clearPageUrl();
  renderSetupState();
}

elements.newSessionBtn.addEventListener("click", goHome);
elements.homeBtn.addEventListener("click", goHome);

if (isFileMode()) {
  renderFileModeState();
} else if (!hasStoryParam()) {
  renderSetupState();
} else {
  setLinks(getStoryId());
  loadStory();
  startStoryPolling();
}
