const { readJsonFile } = require("./github");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function (req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const nim = req.query.nim;

    if (!nim) {
      return res.status(400).json({ success: false, message: "Parameter nim wajib diisi" });
    }

    const users = await readJsonFile("data/users.json");

    const user = users.find(u => u.nim === nim);

    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }

    return res.json({
      id: user.id,
      nama: user.nama,
      nim: user.nim,
      role: user.role
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
