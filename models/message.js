var mongoose = require('mongoose');
var Room = require('./room.js');

//All messages in a room
var messageSchema = new mongoose.Schema({
	user: { type: String, required: true },
	message: {type: String, required: true },
	time: { type: Date, default: Date.now },
	room: [ Room.schema ],
});

module.exports = mongoose.model('Message', messageSchema);