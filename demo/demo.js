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

serverRpc.on('request',function(pack){
	console.log('receive a request',pack);

	serverRpc.response(pack,'poi');
});

serverRpc.on('data',function(data){
	//send to server RPC
	console.log(data)
	clientRpc.handle(data);
});

function send(){
	console.log('client:send req');
	clientRpc.request('sth',function(err,data){
		console.log('response',data);
	});
}

setInterval(send,5000);

send();