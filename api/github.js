const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_PAT;

const BASE_URL =
  `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

async function githubRequest(path) {

  const response = await fetch(
    `${BASE_URL}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (!response.ok) {

    throw new Error(
      `GitHub API Error: ${response.status}`
    );

  }

  return await response.json();
}

async function readJsonFile(path) {

  const file =
    await githubRequest(path);

  const content =
    Buffer
      .from(
        file.content,
        "base64"
      )
      .toString("utf8");

  return JSON.parse(content);
}

async function updateJsonFile(
  path,
  data
) {

  const currentFile =
    await githubRequest(path);

  const content =
    Buffer
      .from(
        JSON.stringify(
          data,
          null,
          2
        )
      )
      .toString("base64");

  const response =
    await fetch(
      `${BASE_URL}/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization:
            `Bearer ${TOKEN}`,
          Accept:
            "application/vnd.github+json",
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          message:
            `Update ${path}`,
          content,
          sha:
            currentFile.sha
        })
      }
    );

  if (!response.ok) {

    const error =
      await response.text();

    throw new Error(error);

  }

  return await response.json();
}

module.exports = {

  readJsonFile,
  updateJsonFile

};
