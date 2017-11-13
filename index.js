const app = require('express')();
app.set('view engine', 'pug');

var SerialPort = require('serialport');

const http = require('http').Server(app);

const port = process.argv[2] || '8000'
const USBPort = process.argv[3] || 'COM12';

const io = require('socket.io')(http);

require('./routes')(app);

const sp = new SerialPort(USBPort, {
	baudRate: 9600
});

const Readline = SerialPort.parsers.Readline;
const parser = sp.pipe(new Readline({ delimiter: '\r\n' }));

parser.on('data', (data) =>
{
	console.log(data);
	// io.emit('arduino input', JSON.parse(input));
});

io.on('connection', (socket) =>
{
	// console.log('A browser window is connected');
	
	// socket.on('disconnect', () =>
	// {
	// 	console.log('Browser closed');
	// });

	socket.on('rec', () =>
	{
		console.log('rec');
	});

	socket.on('stop', () =>
	{
		console.log('stop');
	});

	socket.on('playback', (data) =>
	{
		for(var i = 0; i < data.length; i++)
		{
			sp.write(new Buffer(data[i], 'ascii'), (err, results) =>
			{
				// console.log('Error: ' + err);
				// console.log('Results ' + results);
			});
		}

		sp.write(new Buffer('\n', 'ascii'), (err, results) =>
		{
			// console.log('err ' + err);
			// console.log('results ' + results);
		});	
	});

});


http.listen(port, () =>
{
	console.log('Server is up and running. Go to http://localhost:' + port + '/');
});
