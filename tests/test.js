#!/usr/bin/env node
const { RPC, RemoteCallback } = require('../index.js');


/* -------init RPC test------- */
const rpc1 = new RPC({ debug: true, }),
	rpc2 = new RPC({ debug: true, });
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
			console.log('rpc2 ctrl: abort, test success');
		};
		return new Promise((ok) => { });
	}
	return msg;//send data back
}
async function testRPC(data) {
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

/* -------init RemoteCallback test------- */
const RC1 = new RemoteCallback({ debug: true, });
const RC2 = new RemoteCallback({ debug: true, });
RC1.setSender(buf => {
	console.log('rc1 send', buf)
	setImmediate(() => {
		RC2.handle(buf);
	})
});
RC2.setSender(buf => {
	console.log('rc2 send', buf)
	setImmediate(() => {
		RC1.handle(buf);
	})
});
RC2.register('poi', (arg, req) => {
	if (typeof arg !== 'number') {
		return new Error('arg not a number');
	}
	return 'poi'.repeat(arg);
});



(async function tests() {
	console.log('rpc1 sends data to rpc2 and rpc2 will log it then send back, rpc1 will log data be sent back');
	await testRPC({ poi: 1 });
	await testRPC(true);
	await testRPC(false);
	await testRPC(3e32);
	await testRPC(0);
	await testRPC(Infinity);
	await testRPC('poi');
	await testRPC(undefined);
	await testRPC(null);
	await testRPC(2n ** 160n);
	await testRPC(-(2n ** 16n));
	try {
		await testRPC('give me an error');
	} catch (e) {
		console.log('handle error\n')
		//do sth
	}
	//no response test
	testRPC('no response')
		.then(() => {
			throw (new Error('error: this request should not be responded'));
		});
	//timeout test
	try {
		await testRPC('timeout');
	} catch (e) {
		// console.log(e)
	}

	//simple test of RemoteCallback
	console.log('Start a simple RemoteCallback test');
	let result = await RC1.remoteCall('poi', 4);
	if (result === 'poipoipoipoi') {
		console.log('RemoteCallback test pass');
	} else {
		console.log('RemoteCallback test failed,wrong result:', result);
	}
})();