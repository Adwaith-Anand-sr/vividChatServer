const mongoose = require("mongoose");
const chatSchema = mongoose.Schema({
   chatId: String,
	participants: [{
			type: mongoose.Schema.Types.ObjectId,
			ref: "user"
		}],
	messages: [{
	   sender: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
	   reciever: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
	   message: String,
	   isrecieved: { type: Boolean, default: false },
	   isreaded: { type: Boolean, default: false },
	   timestamp: { type: Date, default: Date.now },
	}],
	
});

module.exports = mongoose.model("chat", chatSchema);
