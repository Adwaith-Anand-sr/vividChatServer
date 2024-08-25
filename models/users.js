const mongoose = require("mongoose");
const userSchema = mongoose.Schema({
	username: String,
	password: String,
	email: String,
	pushToken: String,
	dp: {
	   type: String,
	   default: null
	}
});

module.exports = mongoose.model("user", userSchema);
