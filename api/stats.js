const { getFile } = require("./github");

module.exports = async (req, res) => {
  try {
    const [
      matkul,
      tugas,
      absensi,
      diskusi
    ] = await Promise.all([
      getFile("data/matkul.json"),
      getFile("data/tugas.json"),
      getFile("data/absensi.json"),
      getFile("data/diskusi.json")
    ]);

    res.json({
      totalMatkul: matkul.length,
      totalTugas: tugas.length,
      totalAbsensi: absensi.length,
      totalDiskusi: diskusi.length
    });
  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
};
