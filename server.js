var express = require('express');
var app = express();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
//var http = require('http').Server(app);
//var io = require('socket.io')(http);

var http = require('http');

var server = http.createServer(app);
var io = require('socket.io').listen(server);

mongoose.connect('mongodb://localhost/breve');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'jade');
app.set('views', './views');

app.use('/breve', require('./routes/api'));
app.use('/breve/static', express.static(__dirname + '/static')); //go to http://209.135.132.117:3000/breve/static/main.css

//for chat (move to static?
app.use('/breve/elements', express.static(__dirname + '/elements')); //go to http://209.135.132.117:3000/breve/elements/
app.use('/breve/bower_components', express.static(__dirname + '/bower_components')); //go to http://209.135.132.117:3000/breve/bower_components/
app.use('/socket.io', express.static(__dirname + '/node_modules/socket.io')); //go to http://209.135.132.117:3000/breve/socket.io

app.get('/breve', function(req, res){
	res.render('home');
});

io.on('connection', function(socket) {
	socket.on('chat message', function(msg) {
		io.emit('chat message', msg);
	});
});

//app.get('/', function(req, res){
//	res.send('working');
//});

//app.listen(3000);
server.listen(3000);
console.log('API is running on port 3000');