const { Router } = require("express");
const Blog = require("../models/blog");
const Comment = require("../models/comment");
const multer = require("multer");
const path = require("path");
const Like = require("../models/like");
const cloudinary = require("cloudinary").v2;

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/add-new", (req, res) => {
  return res.render("addBlog", {
    user: req.user,
  });
});

router.get("/:id", async (req, res) => {
  const blog = await Blog.findById(req.params.id).populate("createdBy");
  const comments = await Comment.find({ blogId: req.params.id }).populate(
    "createdBy"
  );
  const likes = await Like.find({ blogId: req.params.id }).populate(
    "createdBy"
  );
  console.log("req.user:", req.user);

  return res.render("blog", {
    user: req.user,
    blog,
    comments,
    likes,
  });
});

router.post("/comment/:blogId", async (req, res) => {
  await Comment.create({
    content: req.body.content,
    blogId: req.params.blogId,
    createdBy: req.user._id,
  });
  return res.redirect(`/blog/${req.params.blogId}`);
});

router.post("/like/:blogId", async (req, res) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.user._id;

    // Check if the user already liked the blog
    let like = await Like.findOne({ blogId, createdBy: userId });

    if (like) {
      // User unlikes
      await Like.deleteOne({ _id: like._id });
    } else {
      // Add new like
      await Like.create({ blogId, createdBy: userId });
    }

    // Count total likes for this blog
    const likesCount = await Like.countDocuments({ blogId });

    return res.redirect(`/blog/${req.params.blogId}`);
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
});

router.post("/add-new", async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!req.files || !req.files.coverImage) {
      return res.status(400).send("No file uploaded");
    }
    const file = req.files.coverImage;

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "blogify_uploads",
    });

    const blog = await Blog.create({
      body,
      title,
      createdBy: req.user._id,
      coverImageURL: result.secure_url,
    });
    return res.redirect(`/blog/${blog._id}`);
  } catch (error) {
    console.error("Error in /add-new:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
