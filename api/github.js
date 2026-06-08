const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_PAT;

// Support Node.js < 18 yang tidak punya native fetch
let fetchFn;
try {
  fetchFn = fetch;
} catch (e) {
  fetchFn = require("node-fetch");
}

const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

async function githubRequest(path) {
  if (!TOKEN) {
    throw new Error("GITHUB_PAT environment variable tidak ditemukan");
  }
  if (!OWNER || !REPO) {
    throw new Error("GITHUB_OWNER atau GITHUB_REPO environment variable tidak ditemukan");
  }

  const response = await fetchFn(`${BASE_URL}/${path}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "LMS-Unmuh-Babel"
    }
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`GitHub API Error ${response.status}: ${errBody}`);
  }

  return await response.json();
}

async function readJsonFile(path) {
  const file = await githubRequest(path);
  const content = Buffer.from(file.content, "base64").toString("utf8");
  return JSON.parse(content);
}

async function updateJsonFile(path, data) {
  const currentFile = await githubRequest(path);

  const content = Buffer.from(
    JSON.stringify(data, null, 2)
  ).toString("base64");

  const response = await fetchFn(`${BASE_URL}/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "LMS-Unmuh-Babel"
    },
    body: JSON.stringify({
      message: `Update ${path}`,
      content,
      sha: currentFile.sha
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API Error ${response.status}: ${error}`);
  }

  return await response.json();
}

module.exports = { readJsonFile, updateJsonFile };
