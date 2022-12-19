#!/usr/bin/env node
const {RPC}=require('../index.js');
console.log('rpc1 sends data to rpc2 and rpc2 will log it then send back, rpc1 will log data be sent back');

const rpc1=new RPC(),
	rpc2=new RPC();

//rpc1 data to rpc2
rpc1.setSender(buf=>{//emulate sending
	setImmediate(()=>rpc2.handle(buf));
})

//rpc2 data to rpc1
rpc2.setSender(buf=>{//emulate sending
	setImmediate(()=>rpc1.handle(buf));
})

rpc2.on('request',(req,cb)=>{//rpc2 handle request from rpc1
	let msg=req.data();
	console.log('rpc2 req received:\n',msg);
	if(msg==='give me an error'){//for error response test
		cb(RPC.Error('ERRYOURERR','omg, error occurred!'));
		return;
	}
	if(msg==='timeout'){//abort test
		console.log('start timeout test');
		req.once('abort',e=>{
			console.log('rpc2 ctrl: abort')
		})
		return;
	}
	cb(msg);//send data back
})


function test(data){
	return new Promise((ok,rej)=>{
		//send request
		console.log('rpc1 send:\n',data);
		rpc1.request(data,(err,r)=>{
			if(err){
				console.log('rpc1 response error:\n',err);
				rej(err);
				return;
			}
			console.log('rpc1 response:\n',r,'\n');
			ok();
		},{timeout:5000});
		
	});
}

(async function tests(){
	await test({poi:1});
	await test(true);
	await test(false);
	await test(3e32);
	await test(0);
	await test(Infinity);
	await test('poi');
	await test(undefined);
	await test(null);
	await test(2n**160n);
	await test(-(2n**16n));
	try{
		await test('give me an error');
	}catch(e){
		console.log('handle error\n')
		//do sth
	}
	//timeout test
	try{
		await test('timeout');
	}catch(e){
		// console.log(e)
	}
})();