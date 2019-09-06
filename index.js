/*
Copyright luojia@luojia.me
MIT LICENSE
*/

/* 
message structure
Byte 0
	[0] 		0:request
				1:response
	[1] request:	0: no id
					1:has id
		response:	0:normal response
					1:error message
	[2] if the message has finished
		0: 		not finished
		1: 		finished
	[3-7] message type
		0-7: 	see: ControlMsg
		8:		data true
		9:		data false
		10:		data binary
		11:		data string
		12:		data json string
		13:		data int32
		14:		data float32
		15-63:	reserved
[
	Byte 1-4
	message id (if has id or is a response)
]
Byte -
	data
*/

'use strict';
var Buffer=require('Buffer');
var events=require('events');

//Polyfill
Number.MAX_SAFE_INTEGER||(Number.MAX_SAFE_INTEGER=0x1fffffffffffff);
if(!Number.isSafeInteger)
Number.isSafeInteger=function(a){return Number.isInteger(a)&&Math.abs(a)<=Number.MAX_SAFE_INTEGER};
if(!Number.isInteger)
Number.isInteger=function(b){return"number"==typeof b&&isFinite(b)&&Math.floor(b)===b};


const SUPPORT_ARRAYBUFFER=!!global.ArrayBuffer;
const TypedArray=SUPPORT_ARRAYBUFFER&&global.Float32Array.prototype.constructor.__proto__;
if(SUPPORT_ARRAYBUFFER && !ArrayBuffer.isView){//ArrayBuffer.isView
	ArrayBuffer.isView=a=>!!((TypedArray&&(a instanceof TypedArray))||(global.DataView&&(a instanceof DataView)));
}


//Message object
class Message{
	responded=false;
	id;
	head;
	type;
	_data;
	hasID;
	payload;
	finished;
	isRequest;
	constructor(data){//data:Buffer
		if(Buffer.isBuffer(data)){
			throw(new TypeError('Wrong data'));
		}
		if(data.byteLength===0){
			throw(new Error('Bad message'));
		}
		this.head=data[0];
		this.isRequest=(head&0b10000000)===0;
		this.hasID=this.isRequest?(head&0b01000000)===0b01000000:true;
		this.finished=(head&0b00100000)===0b00100000;//finished flag
		if(this.hasID){//calc id
			if(data.byteLength<5){
				throw(new Error('Bad message'));
			}
			this.id=data.readInt32BE(1);
		}
		this.type=head&0x1f;//0b00011111
		this.payload=data.slice(this.hasID?5:1);
		this._data;//data cache
	}
	get isCtrl(){
		return this.type<8;
	}
	get isError(){
		if(!this.isRequest && (this.head&0x80)===0x80){
			return true;
		}
		return false;
	}
	data(){
		if(this._data!==undefined)return this._data;
		let payload=this.payload;
		this._data=(()=>{
			switch(this.type){
				case 8:return true;
				case 9:return false;
				case 10:return payload;//binary
				case 11:return payload.toString('utf8');//string
				case 12:return JSON.parse(payload);//json
				case 13://int32
					if(payload.byteLength!==4)
						throw('Wrong data length for int32');
					return payload.readInt32BE(0);
				case 14://float32
					if(payload.byteLength!==4)
						throw('Wrong data length for float32');
					return payload.readFloatBE(0);
				default:
					throw('Unknown data type');
			}
		})();
		return this._data;
	}
	static toFrameData(data){//return [code,buffer]
		if(data===true){
			return [8];
		}
		if(data===false){
			return [9];
		}
		if(data instanceof ArrayBuffer||ArrayBuffer.isView(data)){
			return [10,data];
		}
		if(typeof data==='string'){
			return [11,Buffer.from(data)];
		}
		if(typeof data==='object'&&data!==null){
			return [12,Buffer.from(JSON.stringify(data))];
		}
		if(typeof data==='number'){
			let buf=Buffer.alloc(4);
			if(Number.isInteger(data)){
				buf.writeInt32BE(data,0);
				return [13,buf];
			}
			if(Number.isFinite(data)){
				buf.writeFloatBE(data,0);
				return [14,buf];
			}
		}
		if(data instanceof MessageErr)
			return [12,Buffer.from(JSON.stringify({code:data.code||4100,msg:data.msg}))];
		if(data instanceof ControlMsg){
			return [data.code];
		}
		console.error(data);//debug
		throw(new TypeError('Unsupported data type'));
	}
	static Error(code,msg){
		return new MessageErr(code,msg||Message.msgErrorCodes[code]||'Unexpected error');
	}
	/*
		finished:为false时对方接收到响应不会立刻删除相关回调函数，而是持续响应
	*/
	static packer(req,id,data,finished=true){//data:buffer, sig:sign the data, finished:if the response has finished
		let [type,msg]=Message.toFrameData(data);//get data type and meg buffer
		let hasID=Number.isNumber(id);
		let head=Buffer.alloc(hasID?5:1);//alloc the head buffer
		if(req===true){//request
			if(hasID)head[0]|=0b01000000;//0b01000000
		}else{//response
			head[0]=0x80;//0b10000000
			if(data instanceof MessageErr)head[0]|=0b01000000;//0b01000000
		}
		if(finished)//mark the msg as finished
			head[0]|=0b00100000;//0b00100000
		head[0]|=type;
		let arr=[head];
		if(hasID){
			head.writeUInt32BE(id,1);
		}
		if(msg&&msg.byteLength)arr.push(msg);
		return Buffer.concat(arr);
	}
	static  msgErrorCodes={
		4100:'',//free message
		4101:'Forbidden',
		4102:'Cannot parse the data',
		4103:'Not supported operation',
		4104:'Duplicate id',
	}
}

//error message
class MessageErr{
	constructor(code,msg=''){
		this.code=code;
		if(typeof msg==='string'){
			this.msg=msg;
		}else if(msg instanceof Error){
			this.msg=msg.message;
		}else{
			throw(new Error('Not supported message type'));
		}
	}
}

//request from remote
class Request{
	_stat=0;//0:inited 1:requested 2:responded 3:deleted
	timeout;
	constructor(rpc,id,callback){
		this.id=id;
		this.rpc=rpc;
		this.cb=callback;
	}
	callback(...args){
		if(this._stat<2 && this.cb)
			this.cb(...args);
	}
	_finish(){
		if(this._stat>1)return;
		this._stat=2;
		if(this.timeout){
			clearTimeout(this.timeout);
			this.timeout=0;
		}
	}
	delete(){
		if(this._stat===3)return false;
		if(this.rpc.sentList.get(this.id) === this)
			this.rpc.sentList.delete(this.id);
		this._finish();
		this.cb=null;
		this.rpc=null;
		this._stat=3;
		return true;
	}
	_timeout(){//when timeout reaches
		if(!this.cb)return;
		this.cb(new Error('Time out'));
		this.rpc.control("abort",this.id);
	}
	setTimeout(time=this.rpc.timeout){
		this.timeout=setTimeout(()=>{
			this._timeout();
			this.delete();
		},time);
	}
}

//response to remote
class Response extends events{
	constructor(rpc,Message_msg){
		super();
		this.rpc=rpc;
		this.msg=Message_msg;
	}
	send(data){
		this.rpc._response(this,data);
	}
	abort(){
		this.emit('abort');
	}
}

class ControlMsg{
	static cache={};
	static codes={
		ping:0,//ping message
		abort:1,//abort an operation
	}
	code;
	constructor(name){
		if(name in ControlMsg.codes === false){
			throw(new Error('Unknown operation name'));
		}
		this.code=ControlMsg.codes[name];
	}
}

function controlMsg(name){
	if(name in ControlMsg.cache)
		return ControlMsg.cache[name];
	return ControlMsg.cache[name]=new ControlMsg(name);
}

const defaultRequestOpt={
	requireResponse:true,
};

//RPC handle
class RPC extends events{
	_currentID=1;
	timeout=30000;
	sentList=new Map();//id => Request
	receivedList=new Map();//id => Response
	constructor(){
		super();
	}
	// get Packer(){return Packer;}
	generateId(){//generate id (exclude 0)
		if(this.sentList.size===4294967295)return false;//no id can be used
		while(this.sentList.has(this._currentID)){//find available id
			this._currentID++;
			if(this._currentID===4294967295)this._currentID=1;
		}
		return this._currentID;
	}
	handle(data){//handle received data
		let Message_msg=new Message(data);
		if(Message_msg.isCtrl===true){//it's a control pack
			this._controlHandle(Message_msg.type,Message_msg.id);
		}else if(Message_msg.isRequest===true){//it's a request
			this._requestHandle(Message_msg);
		}else{//it's a response
			this._responseHandle(Message_msg);
		}
	}
	request(data,callback,opt){	
		if(typeof opt!== 'object')opt={};
		opt.__proto__=defaultRequestOpt;
		let id=0;
		if(typeof callback === 'function'){
			if((id=this.generateId())===false)throw(new Error('No free id.'));
		}
		let buffer=Message.pack(true,id,data);
		if(id!==0){
			let request=new Request(this,id,callback);
			this.sentList.set(id,request);
			request.setTimeout(opt.timeout||this.timeout);
			return request;
		}
		this.emit('data',buffer);
	}
	control(name,id){
		let buffer=Message.pack(true,id,controlMsg(name));
		this.emit('data',buffer);
	}
	_response(Response_res,data){
		let msg=Response_res.msg;
		if(!msg.hasID)
			throw(new Error('The request dosen\'t need a response'));
		if(this.receivedList.get(msg.id) !== Response_res){
			console.debug('Missing pack');
			//throw(new Error('No id:'+msg.id));	//ignore ids that not exist
			return;
		}
		let rePack=Message.pack(false,msg.id,data);
		this.receivedList.delete(msg.id);
		this.emit('data',rePack);
	}
	_controlHandle(code,id){//received control pack
		switch(code){
			case ControlMsg.codes.abort:{//cancel an operation
				let res=this.receivedList.has(pack.id);
				if(!res)
					return;//ignore
					//throw(new Error('No id:'+pack.id));
				res.abort();
				this.receivedList.delete(id);
				break;
			}
			default:{
				this.emit('error',new Error('Unknown control code:'+code));
			}
		}
	}
	_requestHandle(Message_msg){
		if(this.receivedList.has(Message_msg.id)){
			this.response(Message_msg,new Error('Duplicate id'));
			return;
		}
		let res=new Response(this,Message_msg);
		this.receivedList.set(Message_msg.id,res);
		this.emit('request',res);
	}
	_responseHandle(Message_msg){//handle received response
		let Request_req=this.sentList.get(Message_msg.id);
		if(!Request_req){
			console.debug('no id:'+Message_msg.id);
			return;
		}
		if(Message_msg.isError){
			Request_req.callback(Message_msg.data());
		}else{
			Request_req.callback(null,Message_msg.data());
		}
		if(Message_msg.finished)
			Request_req.delete();
	}
}

module.exports = RPC;
