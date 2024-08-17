const mongoose = require("mongoose");
const userSchema = mongoose.Schema({
	username: String,
	password: String,
	email: String,
});

module.exports = mongoose.model("user", userSchema);
