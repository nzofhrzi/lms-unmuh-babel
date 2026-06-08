const {
  readJsonFile
} = require("./github");

module.exports =
async function(req,res){

  try{

    const nim =
      req.query.nim;

    const users =
      await readJsonFile(
        "data/users.json"
      );

    const user =
      users.find(
        u => u.nim === nim
      );

    if(!user){

      return res
        .status(404)
        .json({
          success:false,
          message:
            "User tidak ditemukan"
        });

    }

    return res.json({
      id:user.id,
      nama:user.nama,
      nim:user.nim,
      role:user.role
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
