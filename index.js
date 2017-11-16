const app = require('express')();
const shortid = require('shortid');
const Database = require('./Database');
const DB = new Database();

app.set('view engine', 'pug');

var SerialPort = require('serialport');

const http = require('http').Server(app);

const USBPort = process.argv[2] || 'COM12';
const port = process.argv[3] || '8000'

const io = require('socket.io')(http);

require('./routes')(app);

const sp = new SerialPort(USBPort, {
	baudRate: 9600
});

const Readline = SerialPort.parsers.Readline;
const parser = sp.pipe(new Readline({ delimiter: '\r\n' }));

global.ACTION = {
	RESET 				: '0',
	RECORD 				: '1',
	STOP_RECORDING 		: '2',
	PLAYBACK 			: '3',
	STOP_PLAYBACK 		: '4',
	SUBMIT 				: '5',
	CALIBRATE 			: '6',
	STOP_CALIBRATION	: '7',
	NEXT_GESTURE 		: '8',
	SET_ORDER 			: '9',
	DONE				: '10',
}

global.GESTURES = [
	'ScMzIvxBSi4',
	'0pXYp72dwl0',
	'l2ANM2vULoQ'
];

const orderDelim = ' - ';

global.ORDERS = [
	[0, 1, 2],
	[0, 2, 1],
	[1, 0, 2],
	[1, 2, 0],
	[2, 0, 1],
	[2, 1, 0],
]

global.selectedOrder = 0;
var orderIndexAdaptor = ORDERS[selectedOrder];

global.currentGestureIndex = 0;

global.dataRecordings = [];
global.calibrationId = null;

var playbackInterval;

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
		let request = createRequest({
				action : ACTION.STOP_RECORDING,
		});

		sendDataToArduino(request);

		trimDataRecording();

		console.log(dataRecordings);
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

		}, 80);

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

		dataRecordings.length = 0; //reset
		calibrationId = shortid.generate();

		sendDataToArduino(request);
	});

	socket.on(ACTION.SUBMIT, (data) =>
	{
		if(dataRecordings.length < 1) return;

		var doc = {
			gesture_id 		: GESTURES[ORDERS[selectedOrder][currentGestureIndex]],
			calibration_id 	: calibrationId,
			amplitude 		: dataRecordings,
		};

		DB.insert(VIBRATION_PATTERN_COLLECTION, [doc], function(err, doc)
		{
			console.log(doc);
			dataRecordings.length = 0; //reset
		});

		currentGestureIndex++;

		if(!GESTURES[ORDERS[selectedOrder][currentGestureIndex]])
		{
			reset();
			io.emit(ACTION.DONE);
			return;
		}

		io.emit(ACTION.NEXT_GESTURE, {
			gesture : GESTURES[ORDERS[selectedOrder][currentGestureIndex]]
		});
	});

	socket.on(ACTION.SET_ORDER, (data) =>
	{
		selectedOrder = data.order;
		orderIndexAdaptor = ORDERS[selectedOrder];
	});

	socket.on(ACTION.RESET, (data) =>
	{
		reset();
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

function reset()
{
	currentGestureIndex = 0;
	dataRecordings.length = 0; //reset
	calibrationId = null;

	let request = createRequest({
			action : ACTION.RESET,
	});

	sendDataToArduino(request);
}

function trimDataRecording()
{
	var spliceCount = 0;

	for (var i = 0; i < dataRecordings.length; i++)
	{
		if(dataRecordings[i] == 0) spliceCount++;
		else break;
	}

	dataRecordings.splice(0, spliceCount);

	for (var i = dataRecordings.length - 1; i >= 0; i--)
	{
		if(dataRecordings[i] == 0) dataRecordings.pop();
		else break;
	}
}