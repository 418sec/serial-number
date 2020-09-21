'use strict';

var fs		= require('fs');
var http	= require('http');
var spawn	= require('child_process').spawn;

var serialNumber = function (cb, cmdPrefix) {
	var delimiter = ': ';
	var uselessSerials = [
		'To be filled by O.E.M.',
	]

	var fromCache = function (error, stdout) {
		fs.readFile(__dirname + '/cache', function (fsErr, data) {
			if (data) {data = data.toString().trim();}
			if (fsErr || !data || data.length < 2) {
				attemptEC2(function() {
					stdoutHandler(error, stdout, true);
				});
			} else {
				cb(null, data);
			}
		});
	};

	var stdoutHandler = function (error, stdout, bypassCache) {
		if (error && !bypassCache) {
			fromCache(error, stdout);
		} else {
			cb(error, parseResult(stdout));
		}
	};

	var parseResult = function (input) {
		var result = input.slice(input.indexOf(delimiter) + 2).trim();

		var isResultUseless = uselessSerials.some(function(val) {
			return val === result;
		});

		if (isResultUseless) {
			return '';
		}

		return result;
	};

	var attemptEC2 = function (failCb) {
		var data = '';
		var failHandler = function () {
			failCb();
			failCb = function () {};
		};
		var request = http.get(
			'http://169.254.169.254/latest/meta-data/instance-id',
			function (res) {
				res.on('data', function (chunk) {
					data += chunk;
				}).on('end', function () {
					if (data.length > 2) {
						cb(null, data.trim());
					} else {
						failHandler();
					}
				});
			}
		);
		request.on('error', failHandler).setTimeout(1000, failHandler);
	};

	cmdPrefix = cmdPrefix || '';
	var vals = ['Serial', 'UUID'];
	var cmd;

	switch (process.platform) {

	case 'win32':
		delimiter = '\r\n';
		vals[0] = 'IdentifyingNumber';
		cmd = 'wmic csproduct get ';
		break;

	case 'darwin':
		cmd = 'system_profiler SPHardwareDataType | grep ';
		break;

	case 'linux':
		if (process.arch === 'arm') {
			vals[1] = 'Serial';
			cmd = 'cat /proc/cpuinfo | grep ';

		} else {
			cmd = 'dmidecode -t system | grep ';
		}
		break;

	case 'freebsd':
		cmd = 'dmidecode -t system | grep ';
		break;
	}

	if (!cmd) return cb(new Error('Cannot provide serial number for ' + process.platform));

	if (serialNumber.preferUUID) vals.reverse();

	var cmd1 = cmdPrefix + cmd + vals[0];
	var cmd2 = cmdPrefix + cmd + vals[1];
	cmd1 = cmd1.split('|');
	cmd2 = cmd2.split('|');
	const echo = spawn(cmd1[0].split(' ')[0], cmd1[0].split(' ').slice(1));
	const grep = spawn(cmd1[1].split(' ')[1], cmd1[1].split(' ').slice(2));
	echo.stdout.on('data', (data) =>{
		grep.stdin.write(data);
	  });
	grep.stdout.on('data', (error, data)=> {
		if (error || parseResult(data.toString()).length > 1) {
			stdoutHandler(error, data.toString());
		} else {
			const echo2 = spawn(cmd2[0].split(' ')[0], cmd2[0].split(' ').slice(1));
			const grep2 = spawn(cmd2[1].split(' ')[0], cmd2[1].split(' ').slice(1));
			echo2.stdout.on('data', (data) => {
				grep2.stdin.write(data);
			  });
			grep2.stdout.on('data', (error, data) => {
				stdoutHandler(error, data.toString());
			});
		}
	});
};

serialNumber.preferUUID = false;

module.exports = exports = serialNumber;

exports.useSudo = function (cb) {
	serialNumber(cb, 'sudo ');
};
