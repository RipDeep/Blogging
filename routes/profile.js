const { Router } = require("express");
const Blog = require("../models/blog");
const Notification = require("../models/notifications");
const User = require("../models/user");
const cloudinary = require("cloudinary").v2;

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Profile page
router.get("/", async (req, res) => {
  try {
    // Make sure user is logged in
    if (!req.user) {
      return res.redirect("/login"); // redirect to login if not authenticated
    }

    // Fetch user's posts
    const userPosts = await Blog.find({ createdBy: req.user._id });
    const userDetails = await User.find({ _id: req.user._id });

    const followerIds = userDetails[0].followers.map((f) => f.toString());

    const followersData =
      followerIds.length > 0
        ? await User.find({ _id: { $in: followerIds } })
        : [];



    return res.render("profile", {
      userDetails,
      user: req.user,
      userPosts, // pass user's blogs to template
      totalPosts: userPosts.length, // optional
      followersData: followersData ? followersData : [],
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    return res.status(500).send("Internal Server Error");
  }
});

router.get("/view/:id", async (req, res) => {
  const userId = req.params.id;

  // Fetch the user whose profile we want to view
  const userDetails = await User.find({ _id: userId });

  if (!userDetails) {
    return res.status(404).send("User not found");
  }

  const followerIds = userDetails[0].followers.map((f) => f.toString());

  const user = await User.findById(userId);

  let shouldIncrement = false;
  if (!req.user) {
    shouldIncrement = true;
  } else if (req.user._id.toString() !== user._id.toString()) {
    shouldIncrement = true;
  }

  const now = new Date();
  if (
    !userDetails[0].lastResetProfileViews ||
    now.getMonth() !== userDetails[0].lastResetProfileViews.getMonth() ||
    now.getFullYear() !== userDetails[0].lastResetProfileViews.getFullYear()
  ) {
    await User.updateOne(
      { _id: userId },
      { $set: { profileViews: 0, lastResetProfileViews: now } }
    );
    userDetails[0].profileViews = 0; // reset in memory
    userDetails[0].lastResetProfileViews = now;
  }

  if (shouldIncrement) {
    await User.updateOne({ _id: userId }, { $inc: { profileViews: 1 } });
    userDetails.profileViews += 1; // keep in sync for rendering
  }

  const followersData =
    followerIds.length > 0
      ? await User.find({ _id: { $in: followerIds } })
      : [];

  const notifications = req.user
    ? await Notification.find({ user: req.user._id })
        .populate("sender blog")
        .sort({ createdAt: -1 })
        .lean()
    : [];

    
  if (!userDetails) return res.status(404).send("User not found");

  // Fetch that user's posts
  const userPosts = await Blog.find({ createdBy: userId });
  console.log("notifications", );
  

  res.render("profile", {
    userDetails, // the profile being viewed
    user: req.user, // currently logged-in user
    userPosts,
    currentUser: req.user,     // ✅ so nav.ejs can use this
    notifications,             // ✅ so nav.ejs won’t crash
    totalPosts: userPosts.length,
    followersData: followersData ? followersData : [],
  });
});

// Follow/Unfollow a user
router.post("/follow/:id", async (req, res) => {
  try {
    const targetUserId = req.params.id; // user to follow/unfollow
    const currentUserId = req.user._id; // logged-in user

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).send("You cannot follow yourself.");
    }

    // Fetch the target user to check if exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).send("User not found");

    // Check if already following
    const isFollowing = targetUser.followers
      .map((id) => id.toString())
      .includes(currentUserId.toString());

    if (isFollowing) {
      // Unfollow: remove currentUserId from followers
      await User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUserId },
      });
    } else {
      // Follow: add currentUserId to followers if not exists
      await User.findByIdAndUpdate(targetUserId, {
        $addToSet: { followers: currentUserId },
      });
    }

    const currentUser = await User.findById(currentUserId);

    if (!isFollowing) { // only when following
  // Follow: add currentUserId to followers
  await User.findByIdAndUpdate(targetUserId, {
    $addToSet: { followers: currentUserId },
  });

  // Notification for follow
  if (targetUser._id.toString() !== req.user._id.toString()) {
    await Notification.create({
      user: targetUser._id,   // ✅ corrected
      sender: currentUserId,
      type: "follow",
      message: `${currentUser.fullName} started following you`
    });
  }
}

    return res.redirect(`/profile/view/${targetUserId}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

router.post("/update", async (req, res) => {
  try {
    const userId = req.user._id; // logged in user

    let updateData = {
      fullName: req.body.username, // from your form
    };

    // If a new profile image is uploaded
    if (req.files && req.files.profileImage) {
      const file = req.files.profileImage;

      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "profile_uploads",
      });

      updateData.profileImageURL = result.secure_url;
    }

    // Update user in DB
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    // Redirect back to profile page
    return res.redirect(`/profile/view/${userId}`);
  } catch (err) {
    console.error("Error in /profile/update:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
