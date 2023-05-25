#!/usr/bin/env node
const { RPC } = require('../index.js');
console.log('rpc1 sends data to rpc2 and rpc2 will log it then send back, rpc1 will log data be sent back');

const rpc1 = new RPC(),
	rpc2 = new RPC();

//rpc1 data to rpc2
rpc1.setSender(buf => {//emulate sending
	setImmediate(() => rpc2.handle(buf));
});

//rpc2 data to rpc1
rpc2.setSender(buf => {//emulate sending
	setImmediate(() => rpc1.handle(buf));
});

rpc2.onRequest = async (req) => {//rpc2 handle request from rpc1
	let msg = req.data();
	console.log('rpc2 req received:\n', msg);
	if (msg === 'give me an error') {//for error response test
		throw (RPC.Error('ERRYOURERR', 'omg, error occurred!'));
	}
	if (msg === 'timeout') {//abort test
		console.log('start timeout test');
		req.onAbort = e => {
			console.log('rpc2 ctrl: abort')
		};
		return new Promise((ok) => { });
	}
	return msg;//send data back
}


async function test(data) {
	try {
		console.log('rpc1 send:\n', data);
		//send request
		const result = await rpc1.request(data, { timeout: 5000, noResponse: data === 'no response' });
		console.log('rpc1 response:\n', result, '\n');
	} catch (err) {
		console.log('rpc1 response error:\n', err);
		throw err;
	}
}

(async function tests() {
	await test({ poi: 1 });
	await test(true);
	await test(false);
	await test(3e32);
	await test(0);
	await test(Infinity);
	await test('poi');
	await test(undefined);
	await test(null);
	await test(2n ** 160n);
	await test(-(2n ** 16n));
	try {
		await test('give me an error');
	} catch (e) {
		console.log('handle error\n')
		//do sth
	}
	//no response test
	test('no response')
		.then(() => {
			throw(new Error('error: this request should not be responded'));
		});
	//timeout test
	try {
		await test('timeout');
	} catch (e) {
		// console.log(e)
	}
})();