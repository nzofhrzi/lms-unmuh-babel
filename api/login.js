const {
  readJsonFile
} = require("./github");

module.exports =
async function(req,res){

  if(req.method!=="POST"){

    return res
      .status(405)
      .json({
        success:false,
        message:"Method not allowed"
      });

  }

  try{

    const {
      nim,
      password
    } = req.body;

    const users =
      await readJsonFile(
        "data/users.json"
      );

    const user =
      users.find(
        u =>
          u.nim === nim &&
          u.password === password
      );

    if(!user){

      return res
        .status(401)
        .json({
          success:false,
          message:
            "NIM atau password salah"
        });

    }

    const result = {
      id:user.id,
      nama:user.nama,
      nim:user.nim,
      role:user.role
    };

    return res.json({
      success:true,
      user:result
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
