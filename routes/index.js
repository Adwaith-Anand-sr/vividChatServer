const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");

const { server, app, io } = require("../server.js");
const mongodbConfig = require("../config/mongoose.js");

const userModel = require("../models/users.js");
const chatModel = require("../models/chats.js");

let users = [];

io.on("connection", socket => {
	socket.on("join", userId => {
		const existingUserIndex = users.findIndex(user => user.userId === userId);
		if (existingUserIndex !== -1) {
			users.splice(existingUserIndex, 1);
		}
		users.push({ id: socket.id, userId });
	});
	socket.on("sendMessage", async ({ sender, receiver, message }) => {
		let chat = await chatModel.create({
			sender,
			receiver,
			message
		});
		const receiverSocketId = users.find(user => user.userId === receiver)?.id;
		if (receiverSocketId)
			io.to(receiverSocketId).emit("receiveMessage", chat);
		socket.emit("sendMessage", chat);

		let user1 = await userModel.findOne({ _id: sender });
		let user2 = await userModel.findOne({ _id: receiver });
		if (user1) {
			if (!user1.recent.includes(user2._id)) {
				user1.recent.push(user2._id);
				await user1.save();
			}
		}
		if (user2) {
			if (!user2.recent.includes(user1._id)) {
				user2.recent.push(user1._id);
				await user2.save();
			}
		}
	});
	socket.on("seenMessage", async chat => {
		try {
			let message = await chatModel.findOne({ _id: chat._id });
			if (message) {
				message.isreaded = true;
				await message.save();
				const senderSocketId = users.find(
					user => user.userId === message.sender.toString()
				)?.id;
				if (senderSocketId)
					io.to(senderSocketId).emit("seenMessage", message);
			}
		} catch (err) {
			console.log("err: ", err);
		}
	});
	socket.on("seenAllMessages", async ({ userId, oppId }) => {
		let messages = await chatModel.find({
			$or: [{ sender: oppId, receiver: userId }]
		});
		if (messages && messages.length > 0) {
			messages.map(async message => {
				message.isreaded = true;
				await message.save();
				const senderSocketId = users.find(
					user => user.userId === oppId.toString()
				)?.id;
				if (senderSocketId)
					io.to(senderSocketId).emit("seenMessage", message);
			});
		}
	});

	socket.on("disconnect", () => {
		users = users.filter(user => user.id !== socket.id);
	});
});

app.get("/", async (req, res) => {
	console.log(users);
});

app.post("/signup", async (req, res) => {
	console.log("signuping....");
	let { password, username, fullname, email } = req.body;
	let existUser = await userModel.findOne({ username });
	if (existUser) {
		res.status(400).json({
			success: false,
			message: "User already exists",
			data: { username, email }
		});
		return;
	}
	bcrypt.genSalt(10, (err, salt) => {
		bcrypt.hash(password, salt, async (err, hash) => {
			const user = await userModel.create({
				username,
				fullname,
				password: hash,
				email
			});
			let token = jwt.sign({ username, email }, "WTF");
			res.cookie("token", token);
			req.user = user;
			res.status(200).json({
				success: true,
				message: "User signed up successfully",
				data: { username, email, token, userId: user._id }
			});
		});
	});
});

app.post("/signin", async (req, res) => {
	let { password, username } = req.body;
	const user = await userModel.findOne({ username });

	if (!user) {
		return res.status(400).json({
			success: false,
			message: "invalid username!"
		});
	}
	bcrypt.compare(password, user.password, (err, result) => {
		if (result) {
			let token = jwt.sign({ email: user.email, username }, "WTF");
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
				message: "invalid password!"
			});
		}
	});
});

app.post("/getUser", async (req, res) => {
	try {
		let user = await userModel.findOne({ _id: req.body.userId });
		res.status(200).json({
			success: true,
			message: "get user successfully.",
			user
		});
	} catch (err) {
		console.log("err: ", err);
	}
});

app.get("/getAllUsers", async (req, res) => {
	let users = await userModel.find();
	res.status(200).json({
		success: true,
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
				console.log(usr);
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
			message: "get recent user failed.",
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
