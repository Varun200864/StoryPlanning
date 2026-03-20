const elements = {
  modeEyebrow: document.getElementById("modeEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  pageIntro: document.getElementById("pageIntro"),
  voteCount: document.getElementById("voteCount"),
  statusLabel: document.getElementById("statusLabel"),
  fileModeNotice: document.getElementById("fileModeNotice"),
  adminView: document.getElementById("adminView"),
  participantView: document.getElementById("participantView"),
  newStoryId: document.getElementById("newStoryId"),
  createStoryBtn: document.getElementById("createStoryBtn"),
  createStatus: document.getElementById("createStatus"),
  participantLink: document.getElementById("participantLink"),
  adminLink: document.getElementById("adminLink"),
  storyLabel: document.getElementById("storyLabel"),
  responseLabel: document.getElementById("responseLabel"),
  revealBtn: document.getElementById("revealBtn"),
  resetBtn: document.getElementById("resetBtn"),
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

async function request(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function setMode(mode) {
  const isSetup = mode === "setup";
  const isAdmin = mode === "admin";
  const isParticipant = mode === "participant";

  elements.adminView.style.display = isSetup || isAdmin ? "grid" : "none";
  elements.participantView.style.display = isParticipant ? "grid" : "none";
  elements.revealBtn.style.display = isSetup ? "none" : "inline-flex";
  elements.resetBtn.style.display = isSetup ? "none" : "inline-flex";

  if (isSetup) {
    elements.modeEyebrow.textContent = "BA Workspace";
    elements.pageTitle.textContent = "Create a planning round and share it in seconds.";
    elements.pageIntro.textContent = "Generate both links here, send only the participant link to the team, and keep the BA link private.";
    elements.voteCount.textContent = "-";
    elements.statusLabel.textContent = "Setup";
    elements.storyLabel.textContent = "Not created yet";
    elements.responseLabel.textContent = "-";
  } else if (isAdmin) {
    elements.modeEyebrow.textContent = "BA Workspace";
    elements.pageTitle.textContent = "Run the reveal when the room is ready.";
    elements.pageIntro.textContent = "Track total responses, then reveal all names and points together when the team is done.";
  } else {
    elements.modeEyebrow.textContent = "Participant View";
    elements.pageTitle.textContent = "Estimate privately, reveal together.";
    elements.pageIntro.textContent = "Enter your name after opening the shared link, submit your point, and wait for the BA to reveal the session.";
  }
}

function setLinks(storyId, adminKey = "") {
  if (isFileMode()) {
    elements.participantLink.value = "Run with http://localhost:3000 to generate shareable links";
    elements.adminLink.value = "Run with http://localhost:3000 to generate BA private link";
    return;
  }

  const participantUrl = new URL(window.location.origin);
  participantUrl.searchParams.set("story", storyId);
  elements.participantLink.value = participantUrl.toString();

  const effectiveAdminKey = adminKey || getAdminKey();
  elements.adminLink.value = effectiveAdminKey
    ? `${window.location.origin}/?story=${encodeURIComponent(storyId)}&adminKey=${encodeURIComponent(effectiveAdminKey)}`
    : "";
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
          <div class="vote-name">${vote.name}</div>
          <div class="vote-points">${vote.points}</div>
        </article>
      `
    )
    .join("");
}

function renderAdminStory(story) {
  elements.storyLabel.textContent = story.storyId;
  elements.responseLabel.textContent = String(story.totalVotes);
  elements.hiddenNotice.style.display = story.revealed ? "none" : "block";
  elements.resultsPanel.style.display = story.revealed ? "grid" : "none";

  if (story.revealed) {
    renderVoteCards(elements.resultsPanel, story.votes);
  } else {
    elements.resultsPanel.innerHTML = "";
  }
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
  setLinks(story.storyId);
  elements.newStoryId.value = story.storyId;
  elements.voteCount.textContent = String(story.totalVotes);
  elements.statusLabel.textContent = story.revealed ? "Revealed" : "Hidden";

  if (story.isAdmin) {
    renderAdminStory(story);
  } else {
    renderParticipantStory(story);
  }
}

function renderSetupState() {
  setMode("setup");
  elements.newStoryId.value = "";
  elements.participantLink.value = "";
  elements.adminLink.value = "";
  elements.createStatus.textContent = "";
  elements.adminStatus.textContent = "";
  elements.hiddenNotice.style.display = "block";
  elements.hiddenNotice.innerHTML = `
    <h3>Create your first session</h3>
    <p>Choose a story ID, generate the links, and then share only the participant link with your users.</p>
  `;
  elements.resultsPanel.style.display = "none";
  elements.resultsPanel.innerHTML = "";
}

function renderFileModeState() {
  elements.fileModeNotice.classList.remove("hidden");
  renderSetupState();
  elements.createStatus.textContent = "Direct file open cannot create links. Start the local server first.";
  elements.createStoryBtn.disabled = true;
}

async function loadStory() {
  try {
    const story = await request("/api/story");
    renderStory(story);
  } catch (error) {
    elements.adminStatus.textContent = error.message;
    elements.voteStatus.textContent = error.message;
  }
}

elements.createStoryBtn.addEventListener("click", async () => {
  elements.createStatus.textContent = "";

  try {
    const response = await fetch("/api/story/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        storyId: elements.newStoryId.value
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not create story");
    }

    setPageUrl(data.storyId, data.adminKey);
    setLinks(data.storyId, data.adminKey);
    elements.createStatus.textContent = "Session created. Share the participant link and keep the BA link private.";
    await loadStory();
  } catch (error) {
    elements.createStatus.textContent = error.message;
  }
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

    elements.voteStatus.textContent = "Your point has been submitted.";
    elements.points.value = "";
    renderStory(data.story);
  } catch (error) {
    elements.voteStatus.textContent = error.message;
  }
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

if (isFileMode()) {
  renderFileModeState();
} else if (!hasStoryParam()) {
  renderSetupState();
} else {
  setLinks(getStoryId());
  loadStory();
  setInterval(loadStory, 5000);
}
