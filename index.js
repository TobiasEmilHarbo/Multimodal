const app = require('express')();
const Database = require('./Database');
const DB = new Database();

app.set('view engine', 'pug');

var SerialPort = require('serialport');

global.ACTION = {
	RECORD 				: '1',
	STOP_RECORDING 		: '2',
	PLAYBACK 			: '3',
	STOP_PLAYBACK 		: '4',
	SUBMIT 				: '5',
	CALIBRATE 			: '6',
	STOP_CALIBRATION	: '7',
}

global.GESTURES = [
	'ScMzIvxBSi4',
	'NpEaa2P7qZI'
];

const http = require('http').Server(app);

const USBPort = process.argv[2] || 'COM12';
const port = process.argv[3] || '8000'

const io = require('socket.io')(http);

require('./routes')(app);

const sp = new SerialPort(USBPort, {
	baudRate: 9600
});

var playbackInterval;
var participant = null;

const Readline = SerialPort.parsers.Readline;
const parser = sp.pipe(new Readline({ delimiter: '\r\n' }));

const dataRecordings = [300, 100, 300, 100, 300, 300];

parser.on('data', (response) =>
{
	let res = JSON.parse(response);
	dataRecordings.push(res.data);

	console.log(res.data);
});

io.on('connection', (socket) =>
{
	socket.on(ACTION.RECORD, () =>
	{
		dataRecordings.length = 0; //reset

		let request = createRequest({
				action : ACTION.RECORD,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.STOP_RECORDING, () =>
	{
		console.log(dataRecordings);

		let request = createRequest({
				action : ACTION.STOP_RECORDING,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.PLAYBACK, (data) =>
	{
		let i = 0;

		io.emit(ACTION.STOP_RECORDING);

		playbackInterval = setInterval(function()
		{
			let data = dataRecordings[i];
			if(data != undefined)
			{			
				let request = createRequest({
						action : ACTION.PLAYBACK,
						data : dataRecordings[i]
				});

				sendDataToArduino(request);
				
				i++;
			}
			else
			{
				clearInterval(playbackInterval);

				let request = createRequest({
						action : ACTION.STOP_PLAYBACK,
				});

				sendDataToArduino(request);

				io.emit(ACTION.STOP_PLAYBACK);
			}


		}, 100);

	});

	socket.on(ACTION.STOP_PLAYBACK, (data) =>
	{
		clearInterval(playbackInterval);

		let request = createRequest({
				action : ACTION.STOP_PLAYBACK,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.CALIBRATE, (data) =>
	{
		let request = createRequest({
				action : ACTION.CALIBRATE,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.STOP_CALIBRATION, (data) =>
	{
		let request = createRequest({
				action : ACTION.STOP_CALIBRATION,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.SUBMIT, (data) =>
	{
		var doc = {
			amplitude 	: dataRecordings,
			gesture_id 	: data.id,
			participant : participant
		};

		DB.insert(VIBRATION_PATTERN_COLLECTION, [doc], function(err, doc)
		{
			console.log(doc);
		});
	});
});


http.listen(port, () =>
{
	console.log('Server is up and running. Go to http://localhost:' + port + '/');
});

function sendDataToArduino(data)
{
	for(var i = 0; i < data.length; i++)
	{
		sp.write(new Buffer(data[i], 'ascii'));
	}

	sp.write(new Buffer('\n', 'ascii'));
}

function createRequest(data)
{
	return JSON.stringify(data);
}