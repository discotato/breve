var express = require('express');
var exphbs  = require('express-handlebars');
var app = express();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var path = require('path');
var usermanage = require('user-management');
var validator = require('email-validator');

//voice token
//6171474455627452724a45454d5741754e59546c4e67515353685979657252475959486b58586e746f484558 
//https://api.tropo.com/1.0/sessions?action=create&token=6171474455627452724a45454d5741754e59546c4e67515353685979657252475959486b58586e746f484558 

//messaging token
//547076715655474264757843696c4465737855556d476b546b464167425165415a73726d4176575071785952
//https://api.tropo.com/1.0/sessions?action=create&token=547076715655474264757843696c4465737855556d476b546b464167425165415a73726d4176575071785952 

//sip client
//9996392019@sip.tropo.com

//phone test
//+1 519-900-2139

//tropo functions
var tropowebapi = require('tropo-webapi');
var sys = require('sys');
//Install multi part to access files >npm install --save multer
var multer = require('multer');
var upload = multer({ dest: 'uploads/' });
var fs = require('fs');

//var http = require('http').Server(app);
//var io = require('socket.io')(http);

var http = require('http');

var server = http.createServer(app);
var io = require('socket.io').listen(server);
var session = require('express-session')({
	secret: 'eUlGcu7OtC5hPRnp9Np1',
	resave: true,
	saveUninitialized: true,
	cookie: { secure: false, maxAge: 31556952000 }
});

//express-socket.io-session
var sharedsession = require("express-socket.io-session");

//attach session
app.use(session);

//keep track of rooms
//roomSockets['g@g.com'] = {createdByUser: 'g@g.com', name:'h@h.com', sockets:[{socketUser:'user', socket:'socketA'}]};
//roomSockets['g@g.com'].sockets.push({socketUser:'user', socket:'socketA'});
var roomSockets = {};
var hostSockets = {};

mongoose.connect('mongodb://localhost/breve', {useMongoClient: true}, function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log("mongodb connected");
	}
});

var Message = require('./models/message');
var Room = require('./models/room');
var RemoteUser = require('./models/remoteuser');
var RoomUser = require('./models/roomuser');
var SubscribeUser = require('./models/subscribe');

app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//app.set('view engine', 'jade');
//app.set('views', './views');
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');


app.use('/breve', require('./routes/api')); //breve is the route and points to the api
//express.static provides a route to the static folder
app.use('/breve/static', express.static(__dirname + '/static')); //go to http://209.135.132.117:3000/breve/static/main.css
//for chat (move to static?
app.use('/breve/elements', express.static(__dirname + '/elements')); //go to http://209.135.132.117:3000/breve/elements/
app.use('/breve/bower_components', express.static(__dirname + '/bower_components/')); //go to http://209.135.132.117:3000/breve/bower_components/
app.use('/socket.io', express.static(__dirname + '/node_modules/socket.io')); //go to http://209.135.132.117:3000/breve/socket.io

var setRemoteHost = function(err, req, host){
	req.session.room['remoteuser'] = host;
	return;
};

function getRemoteHost(username, callback){
	Room.find({user: username, host: {'$ne': username}, name: "default"}, function(err, docs){
		if (err) throw err;
		callback(req, docs[0].host);
	});
}

function createRoomSocket(createdBy, roomName){
	var found = false;
	for(var key in roomSockets){
		if(roomSockets[key].name == createdBy || roomSockets[key].name == roomName){
			found = true;
			break;
		}
	}
	if(!found){
		roomSockets[createdBy] = {createdByUser:createdBy, name:roomName, sockets:[]};
	}
	return;
}

function removeRoomSocket(username){
	for(var key in roomSockets){
		if(roomSockets[key].createdByUser == username || roomSockets[key].name == username){
			for(var i = 0; i < roomSockets[key].sockets.length; i++){
				roomSockets[key].sockets.splice(i, 1);
			}
			break;
		}
	}
}

//Keep a record of live rooms. See model for a description.
//roomName is the email of the remote user.
//A live room is an ongoing tally of rooms that have users chatting
function addLiveRoom(createdBy, roomName){
	createRoomSocket(createdBy, roomName);
	Room.count({'$or':[{name:createdBy}, {name:roomName}]}, function (err, count){
		if(err) throw err;
		if(count == 0){
			//room with name matching createdUser or roomName is not found
			var room = new Room({createdByUser: createdBy, name: roomName});
			room.save(function(err){
				if(err) throw err;
			});
		}
	});
}

//only supports one on one messaging and not conference calls.
function saveRoomMessage(user, remoteUser, message){
	var queryRoom = Room.find({'$or':[{'$and':[{createdByUser:user}, {name:remoteUser}]}, {'$and':[{createdByUser:remoteUser}, {name:user}]}]});
	queryRoom.exec(function(err, docs){
		if(docs.length > 0){
			console.log("message saved:" + message);
			var mesg = new Message({user:user, message:message, room:docs[0]});
			mesg.save(function(err){
				if(err) throw err;
			});
		}
	});
}

function removeLiveRoom(roomName){
	Room.count({name:roomName}, function (err, count){
		if(err) throw err;
		if(count == 1){
			Room.deleteOne({name: roomName}, function (err, obj){
				if(err) throw err;
			});
		}
	});
}

//Add a buddy if the user does not exist exists (buddy = remote user)
function addRemoteUser(user, remoteuser){
	RemoteUser.count({user: user, remoteUser: remoteuser}, function (err, count){
		if(err) throw err;
		if(count == 0){
			var remoteUser = new RemoteUser({user: user, remoteUser: remoteuser, nick: ""});
			remoteUser.save(function(err){
				if(err) throw err;
			});
		}
	});
}

//Add a user to the list of remote users (remote users = room users)
function addUserToRoom(roomname, user){
	RoomUser.count({user: user, roomName: roomname}, function (err, count){
		if(err) throw err;
		if(count == 0){
			var roomUser = new RoomUser({user: user, roomName: roomname});
			roomUser.save(function(err){
				if(err) throw err;
			});
		}
	});
}

//Check if buddy exists in the buddy list
//RemoteUser.count({user: user, remoteUser: remoteuser}, function (err, count){
//	if(err) throw err;
//	console.log('count: ' + count);
//	if(count > 0){
//		return true;
//	}
//});

//telephone functions
app.post('/tel/voice', function(req, res){
	var tropo = new tropowebapi.TropoWebAPI();

	if(req.body['session']['from']['channel'] == "TEXT") {
        tropo.say("This application is voice only.  Please call in using a regular phone or SIP phone.");
        tropo.on("continue", null, null, true);
        res.send(TropoJSON(tropo));
    }
	else{
		tropo.say("Hello! You have reached Raspberry Minit. A reliable source for Japanese watches.");
		var say = new Say("Please ree cord your message after the beep and do not hang up until further instructions.");
		var choices = new Choices(null, null, "#");
		tropo.record(3, false, true, true, choices, 'audio/wav', 3, 60, null, null, "recording", null, say, 5, null, "https://breve.me/tel/voice/rec?callerid=" + req.body['session']['from']['id'], null, null);
		//WORKING! tropo.record(3, false, true, true, choices, 'audio/wav', 4, 60, null, null, "recording", null, say, 5, null, "ftp://ftp.tropo.com/recordings/1.wav", 'Seppljd1', 'matcha');
		// use the on method https://www.tropo.com/docs/webapi/on
		tropo.on("continue", null, "/tel/voice/answer", true);
		tropo.on("incomplete", null, "/tel/voice/timeout", true);
		tropo.on("error", null, "/tel/voice/error", true);
	}
	res.send(tropowebapi.TropoJSON(tropo));
	
});

app.post('/tel/voice/answer', function(req, res){
	var tropo = new tropowebapi.TropoWebAPI();
	tropo.say("Perfecto! Your recording saved and we will contact you shortly! Thank you! Have a great day! Goodbye!");
	res.send(tropowebapi.TropoJSON(tropo));
});

app.post('/tel/voice/timeout', function(req, res){
    var tropo = new tropowebapi.TropoWebAPI();
    tropo.say("Sorry, I didn't hear anything. Please call back and try again.");
    res.send(tropowebapi.TropoJSON(tropo));
});

app.post('/tel/voice/error', function(req, res){
    // Create a new instance of the TropoWebAPI object.
    var tropo = new tropowebapi.TropoWebAPI();
    tropo.say("Recording failed. Please call back and try again.");
    res.send(tropowebapi.TropoJSON(tropo));
});

//must be named filename to upload
app.post('/tel/voice/rec', upload.single('filename'), function (req, res, next) {
	console.log(req.file.filename);
	var tmp_path = req.file.path;
	var target_path = 'uploads/' + req.file.filename + '-' + req.query.callerid + '.wav';
	var log_path = 'logs/voice.log';
	var src = fs.createReadStream(tmp_path);
	var dest = fs.createWriteStream(target_path);
	src.pipe(dest);
	fs.appendFile(log_path, 'wrote file: ' + target_path + '\n', function(err) {
		if(err) {
			return console.log(err);
		}
		console.log("The file was saved!");
	});
    var tropo = new tropowebapi.TropoWebAPI();
    res.send(tropowebapi.TropoJSON(tropo));
});

app.get('/subscribe/new', function(req, res){
	//res.sendFile(path.join(__dirname + '/views/register.html'));
	res.render('subscribe', { websiteName: "Traderbate"});
	//res.redirect('/breve/login');
});

app.get('/subscribe/success', function(req, res){
	//res.sendFile(path.join(__dirname + '/views/register.html'));
	res.render('subscribe-success');
});

app.post('/subscribe/new', function(req, res){
	var user = req.body.email;
	var resource = req.body.resource;
	if(!validator.validate(user)){
		var emailMsg = "This is not a valid email address.";
		res.render('subscribe', { websiteName: "Traderbate", emailMessage: emailMsg, email: user});
		return;
	}
	var subscription = new SubscribeUser({user: user, resource: resource});
	subscription.save(function(err){
		if(err) throw err;
	});
	res.redirect('/subscribe/success');
});

app.get('/', function(req, res){
	if(req.session.auth){
		console.log(req.session.auth['token']);
		var users = new usermanage({ tokenExpiration: 8064 }); //1 year hours (eg. 1 week is 168 hours)
		users.load(function(err) {
			users.isTokenValid(req.session.auth['token'], function(err, valid) {
				users.close();
				if (!valid) {
					console.log('The token is not valid');
					res.redirect('/breve/login');
				} else {
					console.log('The token is valid');
					//check to ensure user is connected to a room (remove any stale rooms)
					//RoomUser.count({user: req.session.auth['username']}, function (err, count){
					//	if(err) throw err;
					//	if(count == 0){
					//		res.redirect('/breve/room');
					//		return;
					//	}
					//});
					res.sendFile(path.join(__dirname + '/views/index.html'));
				}
			});
		});
	}
	else{
		console.log('invalid session');
		res.redirect('/breve/login');
	}
});

app.get('/breve/room', function(req, res){
	//res.sendFile(path.join(__dirname + '/views/register.html'));
	if(req.session.auth){
		res.render('room');
		return;
	}
	res.redirect('/breve/login');
});

app.post('/breve/room', function(req, res){
	//authenticate in separate function
	var users = new usermanage();
	var username = req.body.email.trim();
	if(username == req.session.auth['username']){
		res.render('room', { userStatus: "You cannot chat with yourself. Please enter an email of your friend.", email: username });
		return;
	}

	if(validator.validate(username)){
		users.load(function(err) {
			users.userExists(username, function(err, exists) {
				if(exists){
					console.log("user exists:" + username);
					req.session.room['remoteuser'] = username;
					//Room.count({'$or':[{hostUser:req.session.auth['username']}, {hostUser:username}]}, function (err, count){
					//	if(err) throw err;
					//	if (count == 0){
					//		//no room exists
					//		req.session.room['roomname'] = req.session.auth['username'];
					//		var room = new Room({hostUser: req.session.auth['username'], remoteUser: "", name: req.session.auth['username']});
					//		room.save(function(err){
					//			if(err) throw err;
					//		});
					//	}
					//	else {
					//		req.session.room['roomname'] = username;
					//	}
					//});
					//var remoteUser = new RemoteUser({user: req.session.auth['username'], remoteUser: username, nick: username});
					//remoteUser.save(function(err){
					//	if(err) throw err;
					//});
			
					//add the remote user to buddy list
					addRemoteUser(req.session.auth['username'], username);
					//add user to remote user buddy list
					addRemoteUser(username, req.session.auth['username']);
					//add the remote user to room
					addUserToRoom(req.session.auth['username'], username);
					//add the host to the room
					addUserToRoom(req.session.auth['username'], req.session.auth['username']);
					//create a record of the live rooms
					addLiveRoom(req.session.auth['username'], username);
					
					users.close();
					res.redirect('/');
					//res.redirect('/breve/room');
				}
				else {
					console.log("remote user does not exists:" + username);
					users.close();
					res.render('room', { userStatus: "The user is not a member of Breve. Please ask them to sign up!", email: username });
				}
			});
		});
	}
	else{
		res.render('room', { emailMessage: "Email format is invalid", email: username });
	}
});

app.get('/breve/remotehost', function(req, res){
	if(req.session.auth){
		var queryRemoteUser = RemoteUser.find({user: req.session.auth['username'], remoteUser: {'$ne': req.session.auth['username']}});
		queryRemoteUser.exec(function(err, docs){
			if(docs.length > 0){
				console.log("remotehost" + docs[0]);
				res.render('remotehost', {hosts: docs, remoteUser: docs[0].remoteUser});
			}
			else{
				res.redirect('/breve/room');
			}
		});
	}
	else{
		res.redirect('/breve/login');
	}
});

//add remote user to buddy list
app.post('/breve/remotehost', function(req, res){
	if(req.session.auth){
		req.session.room['remoteuser'] = req.body.remoteHost;
		//add the remote user to room
		addUserToRoom(req.session.auth['username'], req.body.remoteHost);
		//add the host to the room
		addUserToRoom(req.session.auth['username'], req.session.auth['username']);
		//create a record of the live rooms
		addLiveRoom(req.session.auth['username'], req.body.remoteHost);
		
		//get the room
		//if(req.session.room['roomname'] == "")
		//{
		//	var queryRoom = Room.find({'$or':[{hostUser:req.session.auth['username']}, {hostUser:req.body.remoteHost}]});
		//	queryRoom.exec(function(err, docs){
		//		var currentRoom = "";
		//		if(docs[0].hostUser == req.body.remoteHost){
		//			currentRoom = req.body.remoteHost;
		//		}
		//		else{
		//			currentRoom = req.session.auth['username'];
		//		}
		//		var roomUser = new RoomUser({user: req.session.auth['username'], roomName: currentRoom});
		//		roomUser.save(function(err){
		//			if(err) throw err;
		//		});
		//	});
		//}
		res.redirect('/');
	}
	else{
		req.session.room['remoteuser'] = "";
		res.redirect('/breve/login');
	}
});	

app.get('/breve/register', function(req, res){
	//res.sendFile(path.join(__dirname + '/views/register.html'));
	//if(req.session.auth){
	//	res.redirect('/breve');
	//}
	//else{
	//	res.render('register');
	//}
	res.render('register');
});

app.post('/breve/register', function(req, res){
	//if(req.session.auth){
	//	res.redirect('/');
	//}
	var username = req.body.email.trim().toLowerCase();
	var ph = req.body.phone.trim();
	var p = req.body.password;
	var p1 = req.body.password1;
	
	var validEmail = true;
	var validPassword = true;
	var validPhone = true;
	
	var validUser = true;
	if(!validator.validate(username)){
		validEmail = false;
	}
	if(p != p1){
		validPassword = false;
	}
	if(ph.length == 0){
		validPhone = false;
	}
	if(!validPassword || !validEmail || !validPhone){
		var emailMsg = "";
		var passwordMsg = "";
		if (!validEmail){
			emailMsg = "This is not a valid email address.";
		}
		if (!validPassword){
			passwordMsg = "The passwords do not match.";
		}
		if (!validPhone){
			phoneMsg = "The phone number is invalid.";
		}
		res.render('register', { emailMessage: emailMsg, passwordMessage: passwordMsg, phoneMessage: phoneMsg, email: username, phone: ph });
		return;
	}

	var users = new usermanage();
	users.load(function(err) {
		console.log('Checking if the user exists');
		users.userExists(username, function(err, exists, validUser) {
			if (exists) {
				validUser = false;
				console.log('User already exists');
				users.close();
				var userMsg = "This user already exists. Have you forgotten your password?";
				res.render('register', { userStatus: userMsg });
				return;
			} else {
				console.log('User does not exist');
				console.log('Creating the user');
				var handleTemp = username.split('@');
				var extras = {
					handle: handleTemp[0],
					phone: ph
				};
				users.createUser(username, p, extras, function (err) {
					console.log('User created');
					//create a default room
					var room = new Room({hostUser: username, remoteUser: "", name: "default"});
					room.save(function(err){
						if(err) throw err;
					});
					users.close();
					res.render('register-result', { email: username });
					return;
				});
			}
		});
	});
	//res.sendFile(path.join(__dirname + '/views/register.html'));
});

app.get('/breve/login', function(req, res){
	res.render('login');
});

app.post('/breve/login', function(req, res){
	var username = req.body.email.trim();
	var p = req.body.password;
	if(username.length > 0 && p.length > 0){
		var users = new usermanage({ tokenExpiration: 8064 }); //1 year hours (eg. 1 week is 168 hours)
		users.load(function(err) {
			users.authenticateUser(username, p, function(err, result) {
				var userMsg = "";
				if (!result.userExists) {
					console.log('Invalid username');
					userMsg = "Invalid username";
					res.render('login', { loginMessage: userMsg });
					return;
				} else if (!result.passwordsMatch) {
					console.log('Invalid password');
					userMsg = "Invalid password";
					res.render('login', { loginMessage: userMsg, email: username });
					return;
				} else {
					console.log('User token is: '+ result.token);
					//clean up old sockets
					//removeRoomSocket(username);
					if(!req.session.auth){
						req.session.auth = {}
					}
					if(!req.session.room){
						req.session.room = {}
					}
					req.session.auth['token'] = result.token;
					req.session.auth['username'] = username;
					req.session.room['remoteuser'] = "";
					req.session.room['roomname'] = "";
					//If the room was deleted, create one
					//addHostRoom(username);
					res.redirect('/breve/remotehost');
				}
				users.close();
			});
		});
	}
});

app.get('/breve/about', function(req, res){
	var caller = "/";
	if(Object.keys(req.query).length != 0){
		caller = req.query.caller;
		console.log(caller);
	}
	res.render('about', {returnPage: caller});
});

app.get('/breve/logout', function(req, res){
	if(req.session.auth){
		var users = new usermanage({ tokenExpiration: 8064 }); //1 year hours (eg. 1 week is 168 hours)
		users.load(function(err) {
			users.expireToken(req.session.auth['token'], function(err) {
				console.log(err);
				users.close();
				res.redirect('/breve/login');
			});
		});
	}
	else{
		console.log('invalid session');
		res.redirect('/breve/login');
	}
});

// Use shared session middleware for socket.io
io.use(sharedsession(session));

//everytime a user connects, they get their own socket
io.on('connection', function(socket) {
	if(!socket.handshake.session.auth){
		io.emit('redirect', '/breve/login');
	}
	//load user messages and store all sockets of the room
	if(socket.handshake.session.auth){
		//room name is the hostUser
		socket.user = socket.handshake.session.auth['username'];
		hostSockets[socket.handshake.session.auth['username']] = socket;
		//store the socket
		for(var key in roomSockets){
			if((roomSockets[key].createdByUser == socket.handshake.session.auth['username'] && roomSockets[key].name == socket.handshake.session.room['remoteuser']) || (roomSockets[key].createdByUser == socket.handshake.session.room['remoteuser'] && roomSockets[key].name == socket.handshake.session.auth['username'])){
				roomSockets[key].sockets.push({socketUser:socket.handshake.session.auth['username'], socket:socket, socketTime:Date.now()});
			}
		}
		console.log(roomSockets);
		//find the room
		//var queryRoom = Room.find({'$or':[{createdByUser:socket.handshake.session.auth['username']}, {name:socket.handshake.session.auth['username']}]});
		//queryRoom.exec(function(err, docs){
		//	console.log("xxxrrr" + docs[0].name);
		//});
		
		//{'$or':[{'room.name' : socket.handshake.session.auth['username']}, {'room.createdByUser' : socket.handshake.session.auth['username']}]}
		//db.messages.find({'$or':[{"room.name" : "g@g.com"}, {"room.createdByUser" : "g@g.com"}]})
		//db.messages.find({'$or':[{'$and':[{"room.name" : "g@g.com"}, {"room.createdByUser" : "i@i.com"}]}, {'$and':[{"room.name" : "i@i.com"}, {"room.createdByUser" : "g@g.com"}]}]})
		var queryMessage = Message.find({'$or':[{'$and':[{"room.name" : socket.handshake.session.auth['username']}, {"room.createdByUser" : socket.handshake.session.room['remoteuser']}]}, {'$and':[{"room.name" : socket.handshake.session.room['remoteuser']}, {"room.createdByUser" : socket.handshake.session.auth['username']}]}]});
		//queryMessage.sort('-time').limit(8).exec(function(err, docs){
		queryMessage.sort('+time').exec(function(err, docs){
			if(err) throw err;
			socket.emit('load message', docs);
		});
	}

	socket.on('chat message', function(data, callback) {
		var username = "";
		if(socket.handshake.session.auth){
			username = socket.handshake.session.auth['username'];
		}
		else{
			io.emit('redirect', '/breve/login');
		}
		//Emit sockets. Client will emit back to server to store the messages to the database.
		//for (var key in hostSockets){
			//console.log( key, hostSockets[key] );
		//	hostSockets[key].emit('chat message', {message: data, user: username});
		//}
		console.log(roomSockets);
		saveRoomMessage(socket.handshake.session.auth['username'], socket.handshake.session.room['remoteuser'], data);
		var sockets = null;
		for(var key in roomSockets){
			if((roomSockets[key].createdByUser == socket.handshake.session.auth['username'] && roomSockets[key].name == socket.handshake.session.room['remoteuser']) || (roomSockets[key].createdByUser == socket.handshake.session.room['remoteuser'] && roomSockets[key].name == socket.handshake.session.auth['username'])){
				sockets = roomSockets[key].sockets;
				break;
			}
		}

		if(sockets != null){
			for(var i = 0; i < sockets.length; i++){
				//console.log("sending" + sockets[i]);
				sockets[i].socket.emit('chat message', {message: data, user: username});
			}
		}
		
		//find the room
		//var queryRoom = Room.find({user: username, name: "default"});
		//queryRoom.exec(function(err, docs){
		//});
	});
	
	socket.on('add user', function(data, callback) {
		//users.indexOf(data)
		if(data in hostSockets){
			callback(false);
		}
		else{
			callback(true);
			//you can set data directly on the socket!
			//socket.user = data;
			//users.push(socket.user);
			hostSockets[socket.user] = socket;
			//updateUsers();
			//io.emit('usernames', hostSockets);
		}
	});
	
	//function updateUsers(){
	//	io.emit('usernames', Object.keys(hostSockets));
	//}
	
	socket.on('disconnect', function() {
		//users.splice(users.indexOf(socket.user), 1); //remove 1 user
		if(socket.handshake.session.auth){
			//io.emit('usernames', socket.handshake.session.auth['username']);
			//for(var key in roomSockets){
			//	if(roomSockets[key].createdByUser == socket.handshake.session.auth['username'] || roomSockets[key].name == socket.handshake.session.auth['username']){
			//		console.log("disconnecting: "+ socket.handshake.session.auth['username']);
			//		for(var i = 0; i < roomSockets[key].sockets.length; i++){
			//			//roomSockets[key].sockets.splice(i, 1);
			//		}
			//		//notify connected clients of all remaining room users
			//		var socketUsers = [];
			//		for(var i = 0; i < roomSockets[key].sockets.length; i++){
			//			socketUsers.push(roomSockets[key].sockets[i].socketUser);
			//		}
			//		io.emit('usernames', socketUsers);
			//		break;
			//	}
			//}
		}
	});
});


//app.get('/', function(req, res){
//	res.send('working');
//});

//app.listen(3000);
server.listen(3000);
console.log('API is running on port 3000');
