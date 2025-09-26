const { Router } = require("express");
const Blog = require("../models/blog");
const Comment = require("../models/comment");
const multer = require("multer");
const path = require("path");
const Like = require("../models/like");
const cloudinary = require("cloudinary").v2;

const router = Router();

router.get("/", (req, res) => {
  return res.render("profile", {
    user: req.user,
  });
});



module.exports = router;