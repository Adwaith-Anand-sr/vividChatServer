const mongoose = require("mongoose");

const chatSchema = mongoose.Schema({
	chatId: { type: String, required: true },
	participants: {
		user1: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "user",
			required: true
		},
		user2: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "user",
			required: true
		}
	},
	messages: [
		{
			sender: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "user",
				required: true
			},
			receiver: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "user",
				required: true
			},
			message: { type: String, required: true },
			status: {
				type: String,
				enum: ["sent", "delivered", "read"],
				default: "sent"
			},
			timestamp: { type: Date, default: Date.now }
		}
	]
});

module.exports = mongoose.model("chat", chatSchema);
