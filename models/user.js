const { Schema, model } = require("mongoose");
const { createHmac, randomBytes } = require("crypto");
const { createTokenForUser } = require("../services/authentication");

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    salt: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    profileImageURL: {
      type: String,
      default: "/images/default.jpg",
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  const user = this;

  if (user.fullName) user.fullName = user.fullName.trim();
  if (user.email) user.email = user.email.trim();
  if (user.password) user.password = user.password.trim();

   if (!user.password) {
    return next(new Error("Password cannot be empty or spaces only"));
  }

  if (!user.isModified("password")) {
    return;
  }



  const salt = randomBytes(16).toString("hex");

  const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

  this.salt = salt;
  this.password = hashPassword;

  next();
});

userSchema.static(
  "matchPasswordAndGenerateToken",
  async function (email, password) {
    const user = await this.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    const salt = user.salt;
    const hashedPassword = user.password;

    const userProvidedHashed = createHmac("sha256", salt)
      .update(password)
      .digest("hex");

    if (hashedPassword !== userProvidedHashed) {
      throw new Error("Incorrect password");
    }

    const token = createTokenForUser(user);

    return { token, user };
  }
);

const User = model("user", userSchema);

module.exports = User;
