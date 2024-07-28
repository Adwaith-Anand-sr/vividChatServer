const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const app = express();
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: [
			"http://localhost:5173",
			"http://localhost:8081",
			"exp://127.0.0.1:8081",
			"exp://10.161.232.167:8081" //local device (changeable)
		]
	}
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
	cors({
		origin: [
			"http://localhost:5173", 
			"http://localhost:8081", 
			"exp://127.0.0.1:8081", 
			"exp://10.161.232.167:8081" 
		]
	})
);

app.use(express.static(path.join(__dirname, "public")));

module.exports = { server, io, app };
