const { Router } = require("express");
const Blog = require("../models/blog");
const User = require("../models/user");
const Comment = require("../models/comment");
const multer = require("multer");
const path = require("path");
const Like = require("../models/like");
const Notification = require("../models/notifications");
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
  if (!req.user) {
    return res.redirect("/login");
  }

  const blog = await Blog.findById(req.params.id).populate("createdBy");

  if (!blog) {
    return res.status(404).send("Blog not found");
  }
  const comments = await Comment.find({ blogId: req.params.id }).populate(
    "createdBy"
  );
  const likes = await Like.find({ blogId: req.params.id }).populate(
    "createdBy"
  );

  const now = new Date();
  const lastReset = blog.createdBy.lastReset || new Date();

  // Ensure logged-in user is the author
  let shouldIncrement = false;

  if (!req.user) {
    // Not logged in → increment
    shouldIncrement = true;
  } else if (blog.createdBy._id.toString() !== req.user._id.toString()) {
    // Logged in but not the author → increment
    shouldIncrement = true;
  }

  if (
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    // Reset views and update lastReset
    await User.updateOne(
      { _id: blog.createdBy._id },
      { $set: { userBlogViews: 0, lastReset: now } }
    );
    blog.createdBy.userBlogViews = 0;
    blog.createdBy.lastReset = now;
  }

  if (shouldIncrement) {
    await Blog.updateOne({ _id: blog._id }, { $inc: { views: 1 } });

    await User.updateOne(
      { _id: blog.createdBy._id },
      { $inc: { userBlogViews: 1 } }
    );
    // also increment in memory so template shows updated value
    blog.views += 1;
    blog.createdBy.userBlogViews += 1;
  }

  return res.render("blog", {
    user: req.user,
    blog,
    comments,
    likes,
  });
});

router.post("/comment/:blogId", async (req, res) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.user._id;

    await Comment.create({
      content: req.body.content,
      blogId: req.params.blogId,
      createdBy: req.user._id,
    });

    const blog = await Blog.findById(blogId).populate("createdBy");

    const currentUser = await User.findById(userId);

    if (blog && blog.createdBy._id.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: blog.createdBy._id, // blog owner
        sender: req.user._id, // commenter
        type: "comment",
        blog: blog._id,
        message: `${currentUser.fullName} commented on your blog "${blog.title}"`,
      });
    }

    return res.redirect(`/blog/${req.params.blogId}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

router.post("/like/:blogId", async (req, res) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.user._id;

    // Check if the user already liked the blog
    let like = await Like.findOne({ blogId, createdBy: userId });
    const currentUser = await User.findById(userId);

    const blog = await Blog.findById(blogId).populate("createdBy", "fullName");

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    if (like) {
      // User unlikes
      await Like.deleteOne({ _id: like._id });
    } else {
      // Add new like
      await Like.create({ blogId, createdBy: userId });
    }

    // Count total likes for this blog
    const likesCount = await Like.countDocuments({ blogId });

    // inside your like controller
    if (blog.createdBy._id.toString() !== userId.toString()) {
      await Notification.create({
        user: blog.createdBy._id, // blog owner
        sender: userId,
        type: "like",
        blog: blog._id,
        message: `${currentUser.fullName} liked your blog "${blog.title}"`,
      });
    }

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

    const user = await User.findById(req.user._id);

    const userWithFollowers = await User.findById(req.user._id).populate(
      "followers"
    );
    if (userWithFollowers && userWithFollowers.followers.length > 0) {
      for (const follower of userWithFollowers.followers) {
        await Notification.create({
          user: follower._id, // follower is a User object after populate
          sender: req.user._id,
          type: "post",
          blog: blog._id,
          message: `${user.fullName} posted a new blog "${blog.title}"`,
        });
      }
    }

    return res.redirect(`/blog/${blog._id}`);
  } catch (error) {
    console.error("Error in /add-new:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Delete a blog post
router.post("/delete/:id", async (req, res) => {
  try {
    const blogId = req.params.id;

    // Make sure user is logged in
    if (!req.user) {
      return res.status(401).send("You must be logged in to delete a post");
    }

    // Find the blog post
    const post = await Blog.findById(blogId);

    if (!post) {
      return res.status(404).send("Post not found");
    }

    // Ensure the logged-in user is the creator
    if (post.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send("You are not authorized to delete this post");
    }

    // Delete the post
    await post.deleteOne();

    // Redirect back to profile
    return res.redirect("/profile");
  } catch (err) {
    console.error("Error deleting post:", err);
    return res.status(500).send("Server Error");
  }
});

router.get("/edit/:id", async (req, res) => {
  try {
    const blogId = req.params.id;

    // Make sure user is logged in
    if (!req.user) {
      return res.redirect("/login");
    }

    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    // Ensure logged-in user is the author
    if (blog.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send("You are not authorized to edit this blog");
    }

    res.render("editBlog", {
      user: req.user,
      blog,
    });
  } catch (err) {
    console.error("Error loading edit page:", err);
    res.status(500).send("Server Error");
  }
});

// POST update blog
router.post("/edit/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    const { title, body } = req.body;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    // Ensure logged-in user is the author
    if (blog.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send("You are not authorized to edit this blog");
    }

    // Update blog details
    blog.title = title;
    blog.body = body;

    // Optional: handle new cover image
    if (req.files && req.files.coverImage) {
      const file = req.files.coverImage;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "blogify_uploads",
      });
      blog.coverImageURL = result.secure_url;
    }

    await blog.save();

    res.redirect(`/blog/${blog._id}`);
  } catch (err) {
    console.error("Error updating blog:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
