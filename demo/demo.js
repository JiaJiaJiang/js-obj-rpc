/*
rpc demo (for node)
*/

//both
const RPC=require('../index.js');

//client
const clientRpc=new RPC();
clientRpc.on('data',function(data){
	//send to server RPC
	serverRpc.handle(data);//handle remote data
});



//server
const serverRpc=new RPC();

serverRpc.on('request',function(res){
	console.log('receive a request',res.pack);
	console.log('data:',res.pack.getData());
	//randomly return an error or 'poi'
	if(Math.random()>0.5)
		res.send('poi');
	else
		res.send(Error('A random error'));
});

serverRpc.on('data',function(data){
	//send to server RPC
	clientRpc.handle(data);
});




//send request
function send(){
	console.log('client:send req');
	clientRpc.request('sth',function(err,data){
		console.log('response',arguments);
	});
}

setInterval(send,3000);

send();