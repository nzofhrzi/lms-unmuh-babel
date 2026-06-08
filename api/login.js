const { getFile } = require("./github");

module.exports = async (req, res) => {
  try {
    const { nim, password } = req.body;

    const users = await getFile("data/users.json");

    const user = users.find(
      u =>
        u.nim === nim &&
        u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Login gagal"
      });
    }

    delete user.password;

    return res.json({
      success: true,
      user
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
