const { Router } = require("express");
const User = require("../models/user");

const router = Router();

router.get("/signin", (req, res) => {
  return res.render("signin");
});

router.get("/signup", (req, res) => {
  return res.render("signup");
});

router.post("/signin", async (req, res) => {
  const email = req.body.email ? req.body.email.trim() : "";
  const password = req.body.password ? req.body.password.trim() : "";

  if (!email) {
    return res.render("signup", {
      error: "Email cannot be empty or spaces only",
    });
  }
  if (!password) {
    return res.render("signup", {
      error: "Password cannot be empty or spaces only",
    });
  }

  try {
    const { token, user } = await User.matchPasswordAndGenerateToken(
      email,
      password
    );

    return res.cookie("token", token).redirect("/");
  } catch (error) {
    console.log(error);
    
    return res.render("signin", {
      error: "Incorrect Email or Password",
    });
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("token").redirect("/");
});

router.post("/signup", async (req, res) => {
  const fullName = req.body.fullName ? req.body.fullName.trim() : "";
  const email = req.body.email ? req.body.email.trim() : "";
  const password = req.body.password ? req.body.password.trim() : "";

  if (!fullName) {
    return res.render("signup", {
      error: "Full name cannot be empty or spaces only",
    });
  }
  if (!email) {
    return res.render("signup", {
      error: "Email cannot be empty or spaces only",
    });
  }
  if (!password) {
    return res.render("signup", {
      error: "Password cannot be empty or spaces only",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("signup", { error: "Email already in use" });
    }

    await User.create({
      fullName,
      email,
      password,
    });

    const { token, user } = await User.matchPasswordAndGenerateToken(
      email,
      password
    );

    return res.cookie("token", token).redirect("/");
  } catch (error) {
    return res.render("signin", {
      error: "Incorrect Email or Password",
    });
  }
});

module.exports = router;
