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
      res.cookie("usernameBlogify", userDetails.fullName, {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          httpOnly: false, // can be accessed in JS
        })
      

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
