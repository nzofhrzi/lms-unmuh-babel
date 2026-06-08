const { readJsonFile } = require("./github");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function (req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { nim, password } = req.body;

    if (!nim || !password) {
      return res.status(400).json({ success: false, message: "NIM dan password wajib diisi" });
    }

    const users = await readJsonFile("data/users.json");

    const user = users.find(
      u => u.nim === nim && u.password === password
    );

    if (!user) {
      return res.status(401).json({ success: false, message: "NIM atau password salah" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        nama: user.nama,
        nim: user.nim,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
