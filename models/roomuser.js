var mongoose = require('mongoose');

//keeps track of all users in each room. They may leave or join a room.
var roomUserSchema = new mongoose.Schema({
	user: { type: String, required: false },
	roomName: { type: String, required: false },
	created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RoomUser', roomUserSchema);