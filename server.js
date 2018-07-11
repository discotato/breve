var express = require('express');
var exphbs  = require('express-handlebars');
var app = express();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var path = require('path');
var usermanage = require('user-management');
var validator = require('email-validator');
var nodemailer = require('nodemailer');
var httpMin = require('http.min')

var tropoApi = "api.tropo.com";
var tropoApiVer = "1.0";
var tropoPhoneNumber = "15199002139"; //phone assigned to the tropo app
//voice token
//6171474455627452724a45454d5741754e59546c4e67515353685979657252475959486b58586e746f484558 
//https://api.tropo.com/1.0/sessions?action=create&token=6171474455627452724a45454d5741754e59546c4e67515353685979657252475959486b58586e746f484558 

//messaging token
var msgTok = "547076715655474264757843696c4465737855556d476b546b464167425165415a73726d4176575071785952";
//https://api.tropo.com/1.0/sessions?action=create&token=547076715655474264757843696c4465737855556d476b546b464167425165415a73726d4176575071785952 

//sip client
//9996392019@sip.tropo.com

//phone test
//+1 519-900-2139

//tropo functions
var tropowebapi = require('tropo-webapi');
//var sys = require('sys');
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

//keep track of rooms and phone pairs.
//roomSockets['g@g.com'] = {createdByUser: 'g@g.com', name:'h@h.com', sockets:[{socketUser:'user', socket:'socketA'}], phoneNumbers:[{user:'acapeg@gmail.com', phone:'17807421221'}]};
//roomSockets['g@g.com'].sockets.push({socketUser:'user', socket:'socketA'});
//roomSockets['g@g.com'].phoneNumbers.push({user:'acapeg@gmail.com', phone:'17807421221'});
var roomSockets = {};
//keep track of user settings.
//userSettings['g@g.com'] = [{name:'offline', value:'sms'}]; //sms or voice
var userSettings = {};
//offlineSetting['17807887937'] = "sms";
var offlineSetting = {};
//var hostSockets = {};

mongoose.connect('mongodb://localhost/breve', {useMongoClient: true}, function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log("mongodb connected");
	}
});

//service: 'gmail',
var transporter = nodemailer.createTransport({
	host: 'mail.robobean.com',
	port: 587,
	secure: false,
	requireTLS: true,
	auth: {
		user: 'breve',
		pass: 'imjosed1'
	},
	tls: {
		rejectUnauthorized: false
	}
});

var Message = require('./models/message');
var Room = require('./models/room');
var RemoteUser = require('./models/remoteuser');
var RoomUser = require('./models/roomuser');
var SubscribeUser = require('./models/subscribe');
var UserSetting = require('./models/usersetting');

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

function sendEmail(toEmail, subject, body){
	var mailOptions = {
		from: 'breve@mail.robobean.com',
		to: toEmail,
		subject: subject,
		text: body
	};
	transporter.sendMail(mailOptions, function(error, info){
		if (error) {
			console.log(error);
		} else {
			console.log('Email sent: ' + info.response);
		}
	});
}

function getRemoteHost(username, callback){
	Room.find({user: username, host: {'$ne': username}, name: "default"}, function(err, docs){
		if (err) throw err;
		callback(req, docs[0].host);
	});
}

function setUserSetting(username, settingName, settingValue){
	UserSetting.findOne({user:username, name:settingName}, function(error, result){
		if(result){
			result.value = settingValue;
			result.save(function (err, updatedSetting) {
				if (err) throw err;
			});
		}
		else{
			var uSetting = new UserSetting({user:username, name:settingName, value:settingValue});
			uSetting.save(function(err){
				if(err) throw err;
			});
		}
	});
}

//userSettings['g@g.com'] = [{name:'offline', value:'sms'}]; //sms or voice
function loadUserSettings(username){
	userSettings[username] = [];
	var querySetting = UserSetting.find({user:username});
	querySetting.exec(function(err, docs){
		if(docs.length > 0){
			for(var i = 0; i < docs.length; i++){
				var uSetting = new Object();
				uSetting.name = docs[i].name;
				uSetting.value = docs[i].value;
				userSettings[username].push(uSetting);
				console.log("Loaded: " + uSetting);
			} 
		}
	});
}

function loadAllUserSettings(){
	userSettings = {};
	var querySetting = UserSetting.find({});
	querySetting.exec(function(err, docs){
		for(var i = 0; i < docs.length; i++){
			userSettings[docs[i].user] = [];
			var uSetting = new Object();
			uSetting.name = docs[i].name;
			uSetting.value = docs[i].value;
			userSettings[docs[i].user].push(uSetting);
			console.log("pushing:" + uSetting + " to " + docs[i].user);
		}
	});
	for(var i = 0; i < userSettings.length; i++){
		console.log("xxxxXXXXXX" + userSettings[i]);
	}
	//console.log("Loaded: " + userSettings);
}

function getUserSetting(username, name){
	var uSettings = userSettings[username];
	for(var i = 0; i < uSettings.length; i++){
		var obj = uSettings[i];
		if(obj.name == name){
			return obj.value;
		}
	}
	return null;
}

function getRoomSocket(createdBy, roomName){
	for(var key in roomSockets){
		var room = roomSockets[key];
		if((room.createdByUser == createdBy && room.name == roomName) || (room.createdByUser == roomName && room.name == createdBy)){
			for(var i = 0; i < room.sockets.length; i++){
				if(room.sockets[i].socketUser == roomName){
					return room.sockets[i];
				}
			}
		}
	}
	return null;
}

function createRoomSocket(createdBy, roomName){
	var found = false;
	//createdByUser: 'g@g.com', name:'h@h.com'
	for(var key in roomSockets){
		if((roomSockets[key].createdByUser == createdBy && roomSockets[key].name == roomName) || (roomSockets[key].createdByUser == roomName && roomSockets[key].name == createdBy)){
			found = true;
			break;
		}
	}
	if(!found){
		roomSockets[createdBy] = {createdByUser:createdBy, name:roomName, sockets:[], phoneNumbers:[]};
		//add phone number pairs
		var conn = mongoose.createConnection('mongodb://localhost/user_management');
		var userModel = conn.model('User', new mongoose.Schema({username: String, extras:{handle: String, phone: String, phone1: String}}));
		userModel.find({'$or':[{username:createdBy}, {username:roomName}]}, function(error, result){
			for(var i = 0; i < result.length; i++){
				roomSockets[createdBy].phoneNumbers.push({user:result[i].username, phone:result[i].extras.phone1});
				//console.log(result[i]);
			}
			conn.close();
		});
	}
	return;
}

//returns phoneNumbers:[{user:'acapeg@gmail.com', phone:'17807421221'}]
function getPhoneNumbers(username){
	var room = null;
	console.log(roomSockets);
	for(var key in roomSockets){
		if(roomSockets[key].createdByUser == username || roomSockets[key].name == username){
			room = roomSockets[key];
			break;
		}
	}
	if(room){
		console.log("getPhNums" + room.phoneNumbers);
		return room.phoneNumbers;
	}
	return null;
}

//returns username
function getSenderPhone(receiverPhone){
	//roomSockets['g@g.com'] = {createdByUser: 'g@g.com', name:'h@h.com', sockets:[{socketUser:'user', socket:'socketA'}], phoneNumbers:[{user:'acapeg@gmail.com', phone:'17807421221'}]};
	for(var key in roomSockets){
		var phoneNums = roomSockets[key].phoneNumbers;
		for(var i = 0; i < phoneNums.length; i++){
			if(phoneNums[i].phone == receiverPhone){
				return phoneNums[i].user;
			}
		}
	}
	return null;
}

function getPhoneNumber(username){
	var phoneNums = getPhoneNumbers(username);
	if(phoneNums){
		for(var i = 0; i < phoneNums.length; i++){
			if(phoneNums[i].user == username){
				return phoneNums[i].phone;
			}
		}
	}
	return null;
}

function removeRoomSocket(socketId){
	for(var key in roomSockets){
		for(var i = 0; i < roomSockets[key].sockets.length; i++){
			if(roomSockets[key].sockets[i].socket.id == socketId){
				roomSockets[key].sockets.splice(i, 1);
				console.log("removed:" + socketId);
				console.log(roomSockets[key]);
			}
		}
		break;
	}
}

//Keep a record of live rooms. See model for a description.
//roomName is the email of the remote user.
//A live room is an ongoing tally of rooms that have users chatting
function addLiveRoom(createdBy, roomName){
	createRoomSocket(createdBy, roomName);
	Room.count({'$or':[{'$and':[{createdByUser:createdBy}, {name:roomName}]}, {'$and':[{createdByUser:roomName}, {name:createdBy}]}]}, function (err, count){
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

//number format: (780) 799 9999 to 17807999999
function cleanPhone(number){
	var newNumber = number.replace(/\(|\)|\-|\s+/gi, '');
	newNumber = "1" + newNumber;
	return newNumber;
}

//unclean number format: (780) 799 9999
function sendTropoSMS(msg, number, clean){
	var newNumber = "";
	if(clean){
		newNumber = cleanPhone(number);
	}
	else{
		newNumber = number;
	}
	console.log("calling tropo");
	var getPath = "https://" + tropoApi + "/" + tropoApiVer + "/sessions?action=create&token=" + msgTok + "&msg=" + msg + "&number=" + newNumber;
	httpMin(getPath).then(function (result){
		console.log('Code: ' + result.response.statusCode)
		console.log('Response: ' + result.data)
	})
}

function saveSMS(numberFrom, msg, timestamp){
	console.log("Storing text: " + numberFrom + " " + msg + " " + timestamp);
	var conn = mongoose.createConnection('mongodb://localhost/user_management');
	var userModel = conn.model('User', new mongoose.Schema({username: String}));
	userModel.findOne({'extras.phone1': numberFrom}, function(error, result){
		//save message
		//console.log("result" + result);
		if(result != null){
			var remoteUser = result['username'];
			var user = "";
			//get phone pair
			var phoneNumbers = getPhoneNumbers(remoteUser);
			if(phoneNumbers){
				for(var i = 0; i < phoneNumbers.length; i++){
					if(phoneNumbers[i].user != remoteUser){
						user = phoneNumbers[i].user;
						break;
					}
				}
				if(user != ""){
					console.log("saveRoomMessage:" + user + " " + remoteUser + " " + msg);
					saveRoomMessage(user, remoteUser, msg);
				}
			}
		}
		conn.close();
	});
}


//telephone functions
app.post('/tel/voice', function(req, res){
	var tropo = new tropowebapi.TropoWebAPI();

	if(req.body['session']['from']['channel'] == "TEXT") {
        tropo.say("This application is voice only.  Please call in using a regular phone or SIP phone.");
        tropo.on("continue", null, null, true);
        res.send(TropoJSON(tropo));
    }
	else{
		tropo.say("Hello! You have reached our automated voice system!");
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

app.post('/tel/text', function(req, res){
	var tropo = new tropowebapi.TropoWebAPI();
	console.log(res.statusCode);
	console.log(req.body);
	//loadAllUserSettings();
	//try{
		if(req.body['session']['userType'] == "NONE"){
			if(req.body['session']['parameters']['action'] == 'create'){
				var medium = offlineSetting[req.body['session']['parameters']['number']];
				console.log("medium: " + medium);
				if(medium == "sms"){
					tropo.call("+" + req.body['session']['parameters']['number'], null, null, null, null, null, "SMS", null, null, null);
				}
				else if(medium == "voice"){
					tropo.call([req.body['session']['parameters']['number']]);
				}
				tropo.say(req.body['session']['parameters']['msg']);
				res.end(TropoJSON(tropo));
			}
		}
		else if(req.body['session']['userType'] == "HUMAN"){
			//text from tropo server, store the message in the db
			if(req.body['session']['to']['id'] == tropoPhoneNumber){
				saveSMS(req.body['session']['from']['id'], req.body['session']['initialText'], req.body['session']['timestamp']);
			}
			else{
				tropo.call("+" + req.body['session']['to']['id'], null, null, null, null, null, "SMS", null, null, null);
				tropo.say(req.body['session']['initialText']);
				res.end(TropoJSON(tropo));
			}
		}
	//}
	//catch(err){
		//do nothing
	//	console.log("Text sending failed");
	//}
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
		var users = new usermanage({ tokenExpiration: 8064 }); //1 year hours (eg. 1 week is 168 hours)
		users.load(function(err) {
			users.isTokenValid(req.session.auth['token'], function(err, valid) {
				users.close();
				if (!valid) {
					res.redirect('/breve/login');
				} else {
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
		
		res.redirect('/');
	}
	else{
		req.session.room['remoteuser'] = "";
		res.redirect('/breve/login');
	}
});	

app.get('/breve/register', function(req, res){
	res.render('register');
});

app.post('/breve/register', function(req, res){
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
					phone: ph,
					phone1: cleanPhone(ph)
				};
				users.createUser(username, p, extras, function (err) {
					console.log('User created');
					//create default user settings
					setUserSetting(username, "offline", "sms");
					users.close();
					res.render('register-result', { email: username });
					return;
				});
			}
		});
	});
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
					//loadUserSettings(username);
					//loadAllUserSettings();
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
		//hostSockets[socket.handshake.session.auth['username']] = socket;
		//store the socket
		for(var key in roomSockets){
			if((roomSockets[key].createdByUser == socket.handshake.session.auth['username'] && roomSockets[key].name == socket.handshake.session.room['remoteuser']) || (roomSockets[key].createdByUser == socket.handshake.session.room['remoteuser'] && roomSockets[key].name == socket.handshake.session.auth['username'])){
				roomSockets[key].sockets.push({socketUser:socket.handshake.session.auth['username'], socket:socket, socketTime:Date.now()});
			}
		}
		//
		console.log(roomSockets);
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

		console.log(roomSockets);
		saveRoomMessage(socket.handshake.session.auth['username'], socket.handshake.session.room['remoteuser'], data.msg);
		var sockets = null;
		for(var key in roomSockets){
			if((roomSockets[key].createdByUser == socket.handshake.session.auth['username'] && roomSockets[key].name == socket.handshake.session.room['remoteuser']) || (roomSockets[key].createdByUser == socket.handshake.session.room['remoteuser'] && roomSockets[key].name == socket.handshake.session.auth['username'])){
				sockets = roomSockets[key].sockets;
				break;
			}
		}
		
		//send SMS if remote user is not logged in
		if(getRoomSocket(socket.handshake.session.auth['username'], socket.handshake.session.room['remoteuser']) == null){
			var remoteUserPhone = getPhoneNumber(socket.handshake.session.room['remoteuser']);
			offlineSetting[remoteUserPhone] = data.offline;
			if(remoteUserPhone != null){
				sendTropoSMS(data.msg, remoteUserPhone, false);
			}
		}

		if(sockets != null){
			for(var i = 0; i < sockets.length; i++){
				//console.log("sending" + sockets[i]);
				sockets[i].socket.emit('chat message', {message: data.msg, user: username});
			}
		}

	});
	
	socket.on('username', function(data, callback) {
		socket.emit('username', {user: socket.handshake.session.auth['username']});
	});
	
	//data = { user: 'matcha@gmail.com', name: 'offline', value: 'voice' }
	socket.on('user setting', function(data, callback) {
		var uSetting = data;
		console.log(uSetting);
		setUserSetting(uSetting.user, uSetting.name, uSetting.value);
	});
	
	socket.on('add user', function(data, callback) {
		//users.indexOf(data)
		//if(data in hostSockets){
		//	callback(false);
		//}
		//else{
		//	callback(true);
			//you can set data directly on the socket!
			//socket.user = data;
			//users.push(socket.user);
		//	hostSockets[socket.user] = socket;
			//updateUsers();
			//io.emit('usernames', hostSockets);
		//}
	});
	
	//function updateUsers(){
	//	io.emit('usernames', Object.keys(hostSockets));
	//}
	
	socket.on('disconnect', function() {
		//users.splice(users.indexOf(socket.user), 1); //remove 1 user
		console.log("socket id:" + socket.id);
		removeRoomSocket(socket.id);
	});
});

//app.listen(3000);
server.listen(3000);
console.log('API is running on port 3000');
