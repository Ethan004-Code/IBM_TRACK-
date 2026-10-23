const API_BASE_URL = "http://127.0.0.1:5000";

const form = document.querySelector("#recommend-form");
const problemInput = document.querySelector("#problem");
const count = document.querySelector("#char-count");
const submitButton = document.querySelector("#submit-button");
const notice = document.querySelector("#notice");
const result = document.querySelector("#result");
const statusDot = document.querySelector("#status-dot");
const statusText = document.querySelector("#status-text");

problemInput.addEventListener("input", () => {
  count.textContent = `${problemInput.value.length} / 2000`;
});

function setBackendStatus(online) {
  statusDot.classList.toggle("online", online);
  statusDot.classList.toggle("offline", !online);
  statusText.textContent = online ? "Backend connected" : "Backend unavailable";
}

async function checkBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    setBackendStatus(response.ok);
  } catch {
    setBackendStatus(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const problem = problemInput.value.trim();
  notice.hidden = true;
  result.hidden = true;

  if (!problem) {
    notice.textContent = "Please describe the problem first.";
    notice.hidden = false;
    problemInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span:first-child").textContent = "Sending…";
  try {
    const response = await fetch(`${API_BASE_URL}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");

    document.querySelector("#result-problem").textContent = data.problem;
    result.hidden = false;
    setBackendStatus(true);
  } catch (error) {
    notice.textContent = error instanceof TypeError
      ? "Could not reach Flask. Start the backend with `python app.py` in the backend folder, then try again."
      : error.message;
    notice.hidden = false;
    setBackendStatus(false);
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent = "Get recommendations";
  }
});

checkBackend();
