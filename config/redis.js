const redis = require("redis");
const redisClient = redis.createClient({
	host: "localhost",
	port: 6379
});

redisClient.on("error", err => {
	console.error("Redis error:", err);
});

// Connect to Redis
redisClient.connect()
.then(()=>{
   console.log('connected to redis.')
})

module.exports = redisClient;
