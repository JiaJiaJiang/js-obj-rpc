/*
rpc demo (for node)
*/

//both
const RPC=require('../index.js');

//clent
const clientRpc=new RPC();
clientRpc.on('data',function(data){
	//send to server RPC
	console.log(data)
	serverRpc.handle(data);
});



//server
const serverRpc=new RPC();

serverRpc.on('request',function(res){
	console.log('receive a request',res.pack);

	//setTimeout(()=>{
	if(Math.random()>0.5)
		res.send('poi');
	else
		res.send(Error('A random error'));
	//},6000);
});

serverRpc.on('data',function(data){
	//send to server RPC
	console.log(data)
	clientRpc.handle(data);
});

function send(){
	console.log('client:send req');
	clientRpc.request('sth',function(err,data){
		console.log('response',arguments);
	});
}

setInterval(send,3000);

send();