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
    const [matkul, tugas, absensi, diskusi] = await Promise.all([
      readJsonFile("data/matkul.json"),
      readJsonFile("data/tugas.json"),
      readJsonFile("data/absensi.json"),
      readJsonFile("data/diskusi.json")
    ]);

    return res.json({
      totalMatkul: matkul.length,
      totalTugas: tugas.length,
      totalAbsensi: absensi.length,
      totalDiskusi: diskusi.length
    });
  } catch (error) {
    console.error("Stats error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
