const {
  readJsonFile
} = require("./github");

module.exports =
async function(req,res){

  try{

    const [
      matkul,
      tugas,
      absensi,
      diskusi
    ] = await Promise.all([

      readJsonFile(
        "data/matkul.json"
      ),

      readJsonFile(
        "data/tugas.json"
      ),

      readJsonFile(
        "data/absensi.json"
      ),

      readJsonFile(
        "data/diskusi.json"
      )

    ]);

    return res.json({

      totalMatkul:
        matkul.length,

      totalTugas:
        tugas.length,

      totalAbsensi:
        absensi.length,

      totalDiskusi:
        diskusi.length

    });

  }catch(error){

    return res
      .status(500)
      .json({
        success:false,
        message:error.message
      });

  }

}
