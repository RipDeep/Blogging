const { validateToken } = require("../services/authentication");
const User = require("../models/user.js");

function checkForAuthenticationCookie(cookieName) {
  return async (req, res, next) => {
    const tokenCookieValue = req.cookies[cookieName];
    if (!tokenCookieValue) {
      return next();
    }

    try {
      const userPayload = validateToken(tokenCookieValue);

      const userDetails = await User.findById(userPayload._id);
      res.cookie("usernameBlogify", userDetails.fullName)

      req.user = userPayload;
    } catch (error) {
      if (!error) {
        return next();
      }
    }
    return next();
  };
}

module.exports = {
  checkForAuthenticationCookie,
};
