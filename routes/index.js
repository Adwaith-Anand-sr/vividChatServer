const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const { server, app, io } = require("../server.js");
const mongodbConfig = require("../config/mongoose.js");

const userModel = require("../models/users.js");
const chatModel = require("../models/chats.js");

let users = [];

const getConversationId = (userId1, userId2) => {
	return [userId1, userId2].sort().join("_");
};

io.on("connection", socket => {
	socket.on("join", userId => {
		const existingUserIndex = users.findIndex(user => user.userId === userId);
		if (existingUserIndex !== -1) {
			users.splice(existingUserIndex, 1);
		}
		users.push({ id: socket.id, userId });
	});
	
	
   socket.on('hey', ()=>{
      socket.emit("hoi");
   })
   
	socket.on("sendMessage", dets => {
		const { senderId, receiverId, message } = dets;
		const conversationId = getConversationId(senderId, receiverId);
		const messageData = {
		   id: uuidv4(),
			senderId,
			receiverId,
			message,
			createdAt: Date.now()
		};
		const ref = db.ref(`messages/${conversationId}`);
		ref.push(messageData)
			.then(() => {
				io.emit("receiveMessage", messageData);
			})
			.catch(error => res.status(500).send(error));
	});

	socket.on("disconnect", () => {
		users = users.filter(user => user.id !== socket.id);
	});
});

app.get("/health", (req, res) => {
	res.status(200).json({ status: "ok" });
	console.log("first");
});

app.post("/signup", async (req, res) => {
	try {
		let { password, username, email } = req.body;
		let existUser = await userModel.findOne({ username });
		if (existUser) {
			res.status(400).json({
				success: false,
				message: "USERNAME_EXISTS",
				data: { username, email }
			});
			return;
		}
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(password, salt, async (err, hash) => {
				const user = await userModel.create({
					username,
					password: hash,
					email
				});
				let token = jwt.sign({ username, email }, "WTF", {
					expiresIn: "30d"
				});
				res.cookie("token", token);
				req.user = user;
				res.status(200).json({
					success: true,
					message: "User signed up successfully",
					data: { username, email, token, userId: user._id }
				});
			});
		});
	} catch (err) {
	   return res.status(400).json({
			success: false,
			message: err,
		});
	}
});

app.post("/signin", async (req, res) => {
	let { password, username } = req.body;
	const user = await userModel.findOne({ username });

	if (!user) {
		return res.status(400).json({
			success: false,
			message: "INVALID_USERNAME"
		});
	}
	bcrypt.compare(password, user.password, (err, result) => {
		if (result) {
			let token = jwt.sign({ email: user.email, username }, "WTF", {
				expiresIn: "30d"
			});
			res.cookie("token", token);
			req.user = user;
			res.status(200).json({
				success: true,
				message: "User signed in successfully.",
				token,
				userId: user._id
			});
		} else {
			return res.status(400).json({
				success: false,
				message: "INVALID_PASSWORD"
			});
		}
	});
});

app.post("/getUser", async (req, res) => {
	try {
		let user = await userModel.findOne({ _id: req.body.chatPartnerId });
		if (user) {
			res.status(200).json({
				success: true,
				message: "get user successfully.",
				user
			});
		} else {
			res.status(400).json({
				success: false,
				message: "no user found!"
			});
		}
	} catch (err) {
		console.log("err: ", err);
	}
});

app.get("/getAllUsers", async (req, res) => {
	let users = await userModel.find();
	res.status(200).json({
		success: true,
		status: "ok",
		message: "get all user successfully.",
		users
	});
});

app.post("/getRecentUsers", async (req, res) => {
	try {
		let user = await userModel.findOne({ _id: req.body.userId });
		let users = [];
		if (user.recent && user.recent.length > 0) {
			for (let item of user.recent) {
				let usr = await userModel.findOne({ _id: item });
				users.push(usr);
			}
		}
		res.status(200).json({
			success: true,
			message: "get recent user successfully.",
			users
		});
	} catch (err) {
		console.log("err: ", err);
		res.status(500).json({
			success: false,
			message: "get recent user failed."
		});
	}
});

app.post("/getMassages", async (req, res) => {
	const { userId, oppId } = req.body;
	let messages = await chatModel.find({
		$or: [
			{ sender: userId, receiver: oppId },
			{ sender: oppId, receiver: userId }
		]
	});
	res.status(200).json({
		success: true,
		messages
	});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}.`);
});
