const { getFile } = require("./github");

module.exports = async (req, res) => {
  const nim = req.query.nim;

  const users = await getFile(
    "data/users.json"
  );

  const user = users.find(
    x => x.nim === nim
  );

  if (!user) {
    return res.status(404).json({
      success: false
    });
  }

  delete user.password;

  res.json(user);
};
