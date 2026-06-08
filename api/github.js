const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_PAT;

async function getFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const data = await res.json();

  return JSON.parse(
    Buffer.from(data.content, "base64").toString("utf8")
  );
}

module.exports = {
  getFile
};
