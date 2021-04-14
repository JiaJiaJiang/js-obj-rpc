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
	[2] reserved
	[3-7] message type
		0-7: 	see: ControlMsg
		8:		data true
		9:		data false
		10:		data binary
		11:		data string
		12:		data json string
		13:		data double js number
		14:		data undefined
		15-31:	reserved
[
	Byte 1-4
		message id (if has id or is a response)
	Byte 5-8
		random number
]
Byte -
	data
*/

'use strict';
// if((typeof Buffer) !== 'function')var Buffer=require('Buffer').Buffer;
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


/**
 * @description	Message object
 * @class Message
 */
class Message{
	id;
	random;
	head;
	type;
	_data;
	hasID;
	payload;
	isRequest;
	/**
	 * Creates an instance of Message.
	 * @param {Buffer} data
	 */
	constructor(data){
		if(!Buffer.isBuffer(data)){
			throw(new TypeError('Wrong data'));
		}
		if(data.byteLength===0){
			throw(new Error('Bad message'));
		}
		this.head=data[0];
		this.isRequest=(this.head&0b10000000)===0;
		this.hasID=this.isRequest?(this.head&0b01000000)===0b01000000:true;
		// this.finished=(head&0b00100000)===0b00100000;//finished flag
		if(this.hasID){//calc id
			if(data.byteLength<5){
				throw(new Error('Bad message'));
			}
			this.id=data.readUInt32BE(1);
			this.random=data.readUInt32BE(5);
		}
		this.type=this.head&0b00011111;//type of the message
		this.payload=data.slice(this.hasID?9:1);
		this._data;//data cache
	}
	/**
	 * @description	is control message
	 * @readonly
	 */
	get isCtrl(){
		return this.type<8;
	}
	/**
	 * @description	is error message
	 * @readonly
	 */
	get isError(){
		if((this.head&0x40)===0x40){
			return true;
		}
		return false;
	}
	/**
	 * @description parse data
	 * @returns {any}	carried data
	 */
	data(){
		if(this._data!==undefined)return this._data;
		this._data=(()=>{
			if(this.type<8)return ControlMsg.parseData(this.type,this.payload);
			switch(this.type){
				case 8:return true;
				case 9:return false;
				case 10:return this.payload;//binary
				case 11:return this.payload.toString('utf8');//string
				case 12:return JSON.parse(this.payload);//json
				case 13://js number
					if(this.payload.byteLength!==8)
						throw('Wrong data length for number');
					return this.payload.readDoubleBE(0);
				case 14:return undefined;
				default:
					throw('Unknown data type');
			}
		})();
		return this._data;
	}
	/**
	 * @description	convert different data to message format buffer
	 * @static
	 * @param {any} data	data that defined at top of this file
	 * @returns {[number,Buffer]}	[type code, data buffer]
	 */
	static toFrameData(data){
		if(data instanceof ErrorMsg)
			return [12,Buffer.from(JSON.stringify({code:data.code||4100,msg:data.msg}))];
		if(data instanceof ControlMsg){
			return [data.code,data.buf];
		}
		if(data instanceof Error){
			throw('Dont use Error, use RPC.Error instead');
		}
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
		if(typeof data==='object'){
			return [12,Buffer.from(JSON.stringify(data))];
		}
		if(typeof data==='number'){
			let buf=Buffer.alloc(8);
			buf.writeDoubleBE(data);
			return [13,buf];
		}
		if(data===undefined){
			return [14];
		}
		
		console.error('data: ',data);//debug
		throw(new TypeError('Unsupported data type: '+typeof data));
	}
	/**
	 * @description	pack data into message buffer
	 * @static
	 * @param {boolean} req	is request
	 * @param {boolean} err	is error
	 * @param {number} type	type code
	 * @param {Buffer} buf	data buffer
	 * @param {number} id	message id
	 * @param {number} randomNum	a random number for preventing id confict
	 * @returns {Buffer}  
	 */
	static _pack(req,err,type,buf,id,randomNum){
		let hasID=typeof id==='number' && id>0;
		let head=Buffer.alloc(hasID?9:1);//alloc the head buffer
		if(req===true){//request
			if(hasID)head[0]|=0b01000000;//set id flag
		}else{//response
			head[0]=0b10000000;//set as response
			if(err){head[0]|=0b01000000;}//set err msg flag
		}
		head[0]|=type;
		let arr=[head];
		if(hasID){
			if(id>=0xFFFFFFFF)
				throw(new Error('id out of range'));
			head.writeUInt32BE(id,1);//write id
			head.writeUInt32BE(randomNum,5);//write randomNum
		}
		if(buf&&buf.byteLength)arr.push(buf);
		return Buffer.concat(arr);
	}
	/**
	 * @description	pack data into message buffer
	 * @static
	 * @param {boolean} req	is request
	 * @param {any} data	data to send
	 * @param {number} id	message id
	 * @param {number} randomNum	a random number for preventing id confict
	 * @returns {Buffer}	packed message
	 */
	static pack(req,data,id,randomNum){//data:buffer, sig:sign the data, finished:the response has finished
		let [type,buf]=Message.toFrameData(data);//get data type and meg buffer
		let err=data instanceof ErrorMsg;
		return Message._pack(req,err,type,buf,id,randomNum);
	}
	static  msgErrorCodes={
		4100:'',//free message
		4101:'Forbidden',
		4102:'Cannot parse the data',
		4103:'Not supported operation',
		4104:'Duplicate id',
		4104:'Time out',
	}
	/**
	 * @description	is valid id
	 * @static
	 * @param {number} id
	 * @returns {boolean}
	 */
	static isValidId(id){
		return typeof id==='number'&&id>0&&id<=0xFFFFFFFF;
	}
}

/**
 * @description error message
 * @class ErrorMsg
 */
class ErrorMsg{
	/**
	 * Creates an instance of ErrorMsg.
	 * @param {any} code	error code to return
	 * @param {string} [msg='']	error message to return
	 */
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

/**
 * @description control message
 * @class ControlMsg
 */
class ControlMsg{
	static cache={};
	static codes={
		abort:1,//abort an operation
	}
	code;
	buf;
	/**
	 * Creates an instance of ControlMsg.
	 * @param {string} name name of the control operation
	 * @param {*} data	data of the control message
	 */
	constructor(name,data){
		if(name in ControlMsg.codes === false){
			throw(new Error('Unknown operation name'));
		}
		this.code=ControlMsg.codes[name];
		switch(this.code){
			case ControlMsg.codes.abort:
				if(!Message.isValidId(data))
					throw('Invalid id: '+data);
				this.buf=Buffer.allocUnsafe(4);
				this.buf.writeUInt32BE(data);
				break;
		}
	}
	/**
	 * @description	convert control message payload to number
	 * @static
	 * @param {number} code	control code
	 * @param {Buffer} buf	control message payload
	 * @returns {number}  
	 */
	static parseData(code,buf){
		switch(code){
			case ControlMsg.codes.abort:
				return buf.readUInt32BE(0);
		}
	}
}

/**
 * @description request from remote
 * @class Request
 */
class Request{
	responded=false;
	timeout;
	/**
	 * Creates an instance of Request.
	 * @param {RPC} rpc
	 * @param {number} id	message id
	 * @param {function(...any)} callback	receive response data
	 * @param {number} random	a random number for preventing id confict
	 */
	constructor(rpc,id,callback,random){
		this.id=id;
		this.rpc=rpc;
		this.cb=callback;
		this.random=random;
	}
	/**
	 * @description	abort the request, depends on remote data handle
	 */
	abort(){
		this.rpc.control('abort',this.id);
		this.rpc.delete(this);
	}
	/**
	 * @description	fill response data when the remote rpc respond
	 * @param {*} args
	 */
	callback(...args){
		if(this.responded)
			throw(new Error('Responded'));
		this.responded=true;
		if(this.cb)
			this.cb(...args);
	}
	/**
	 * @description set time out of the request
	 * @param {*} time
	 */
	setTimeout(time){//
		if(typeof time!=='number'||!(time>=0))
			throw(new Error('Wrong timeout'));
		if(this.timeout)
			clearTimeout(this.timeout);
		this.timeout=setTimeout(()=>this._timeout(),time);
	}
	/**
	 * @description when timeout reaches, an abort control will be sent
	 */
	_timeout(){
		this.timeout=0;
		if(this.cb){
			this.cb(new Error('Time out'));
		}
		this.abort();
	}
	_destructor(){
		this.cb=null;
		this.rpc=null;
		if(this.timeout){
			clearTimeout(this.timeout);
			this.timeout=0;
		}
	}
	/**
	 * @description	generate a random number
	 * @static
	 * @returns {number}  
	 */
	static generateRandom(){
		return Math.round(4294967295*Math.random());
	}
}

/* 
events
	abort
*/
/**
 * @description incoming request
 * @class InRequest
 * @extends {events}
 */
class InRequest extends events{
	_timeout;
	aborted=false;
	responded=false;
	/**
	 * Creates an instance of InRequest.
	 * @param {Message} Message_msg
	 * @param {RPC} rpc
	 */
	constructor(Message_msg,rpc){
		super();
		this.rpc=rpc;
		this.msg=Message_msg;
	}
	/**
	 * @description	get message id
	 * @readonly
	 */
	get id(){return this.msg.id;}
	/**
	 * @description	get data of the message, wil be recovered to thier origin type
	 * @returns {any}  
	 */
	data(){
		return this.msg.data();
	}
	/**
	 * @description	set timeout of the incoming request
	 * @param {*} time
	 */
	setTimeout(time){
		if(typeof time!=='number'||!(time>=0))
			throw(new Error('Wrong timeout'));
		if(this._timeout)
			clearTimeout(this._timeout);
		this._timeout=setTimeout(()=>this._reachTimeout(),time);
	}
	_abort(str_msg){
		this.aborted=true;
		this.emit('abort',str_msg);
	}
	/**
	 * @description when timeout reaches, rpc will send an error back to remote
	 */
	_reachTimeout(){
		this._timeout=0;
		this._abort('time out');
		this.rpc._respond(this,RPC.Error(4104));
	}
	_destructor(){
		this.rpc=null;
		this.msg=null;
		if(this._timeout){
			clearTimeout(this._timeout);
			this._timeout=0;
		}
	}
}


/* 
Always call the callback of the 'request' event, otherwise the requests will reach timeout
*/
/**
 * @description RPC handle
 * @class RPC
 * @extends {events}
 */
class RPC extends events{
	static Error(code,msg){
		return new ErrorMsg(code,msg||Message.msgErrorCodes[code]||'Unexpected error');
	}
	_currentID=1;
	defaultRequestTimeout=15000;
	responseTimeout=15000;
	reqList=new Map();//id => Request
	inReqList=new Map();//id => InRequest
	_checkerTimer;
	_sender;
	constructor(){
		super();
	}
	//sender side
	/**
	 * @description generate id (exclude 0)
	 * @returns {number}  
	 */
	_generateId(){
		if(this.reqList.size===0xFFFFFFFF)return false;//no id can be used
		while(this.reqList.has(this._currentID)){//find available id
			this._currentID++;
			if(this._currentID===0xFFFFFFFF)this._currentID=0;
		}
		return this._currentID;
	}
	
	/**
	 * @description buffer handle
	 * @param {Buffer} data	data from remote rpc sender
	 */
	handle(data){
		let Message_msg=new Message(data);
		if(Message_msg.isCtrl===true){//it's a control pack
			this._controlHandle(Message_msg.type,Message_msg.data());
		}else if(Message_msg.isRequest===true){//it's a request
			this._requestHandle(Message_msg);
		}else{//it's a response
			this._responseHandle(Message_msg);
		}
	}
	/**
	 * @description send request
	 * @param {*} data
	 * @param {function(Error,any)} callback
	 * @param {object} opt
	 * @returns {Request}  
	 */
	request(data,callback,opt){	
		if(typeof opt!== 'object')opt={};
		let id=0,request,rand;
		if(typeof callback === 'function'){
			if((id=this._generateId())===false)throw(new Error('No free id'));
		}
		if(id!==0){
			rand=Request.generateRandom();
		}
		let buffer=Message.pack(true,data,id,rand);
		if(id!==0){
			request=new Request(this,id,callback,rand);
			this.reqList.set(id,request);
			request.setTimeout(opt.timeout||this.defaultRequestTimeout);
		}
		this._send(buffer).then(err=>{
			err&&request.callback(err);
		});
		return request;
	}
	/**
	 * @description	send control message
	 * @param {number} name
	 * @param {*} data
	 * @returns {Promise<Error>}	error of send
	 */
	control(name,data){
		let msg=new ControlMsg(name,data);
		let buffer=Message._pack(true,false,msg.code,msg.buf,0);
		return this._send(buffer);
	}
	/**
	 * @description delete the req instance from map
	 * @param {Request|InRequest} req
	 */
	delete(req){
		let id=req.id;
		if(req instanceof Request){
			if(this.reqList.get(id) === req)
				this.reqList.delete(id);
			else{throw(new Error('Deleting unknown req'))}
			req._destructor();
		}else if(req instanceof InRequest){
			if(this.inReqList.get(id) === req)
				this.inReqList.delete(id);
			else{throw(new Error('Deleting unknown inReq'))}
			req._destructor();
		}else{
			console.error('arg: ',req);
			throw(new Error('Wrong type'));
		}
	}
	/**
	 * @description	set sender of data.
	 * @description	sync sender : return send Error;
	 * @description	async sender : resolve to send Error;
	 * @param {function} func
	 */
	setSender(func){
		if(typeof func!=='function')
			throw(new TypeError('not a function'));
		/* 
			sync sender:return send Error
			
		*/
		this._sender=func;
	}
	/**
	 * @description	send buffer by sender function
	 * @param {Buffer} buf
	 * @returns {Promise<Error>}  
	 */
	async _send(buf){
		if(this._sender){
			let r;
			if((await this._sender(buf)) instanceof Error === false)return;
			return await this._sender(buf);//retry
		}
		throw(new Error('sender not defined'));
	}
	//receviver side
	/**
	 * @description	make a message to respond the request
	 * @param {InRequest} InRequest_req
	 * @param {*} data
	 */
	_respond(InRequest_req,data){
		let msg=InRequest_req.msg;
		if(!msg.hasID)
			throw(new Error('The request dosen\'t need a response'));
		if(this.inReqList.get(msg.id) !== InRequest_req){
			console.debug('Missing id');
			//ignore ids that not exist
			return;
		}
		let Buffer_buf=Message.pack(false,data,msg.id,msg.random);
		this._send(Buffer_buf);
		this.delete(InRequest_req);
	}
	/**
	 * @description	handle control operation
	 * @param {*} code received control code
	 * @param {*} data received control data
	 */
	_controlHandle(code,data){
		switch(code){
			case ControlMsg.codes.abort:{//cancel an operation
				let InRequest_req=this.inReqList.get(data);//data: id
				if(!InRequest_req)
					return;//ignore
				InRequest_req._abort('remote abort');
				this.delete(InRequest_req);
				break;
			}
			default:{
				console.debug('Unknown control code:'+code);
			}
		}
	}
	/**
	 * @description	handle received request
	 * @param {Message} Message_msg
	 */
	_requestHandle(Message_msg){
		if(this.inReqList.has(Message_msg.id)){
			this._respond(Message_msg,RPC.Error(4104));//Duplicate id
			return;
		}
		let InRequest_req=new InRequest(Message_msg,this);//create a response for the request
		if(Message_msg.id){
			InRequest_req.setTimeout(this.responseTimeout);
			this.inReqList.set(Message_msg.id,InRequest_req);
		}
		this.emit('request',InRequest_req,(r)=>{//emit a request event for the request handle created by you
			//remove saved inReq
			if(InRequest_req.msg.id&&(this.inReqList.get(Message_msg.id)===InRequest_req))
				this._respond(InRequest_req,r);
		});
	}
	/**
	 * @description	handle received response
	 * @param {Message} Message_msg
	 */
	_responseHandle(Message_msg){
		let Request_req=this.reqList.get(Message_msg.id);
		if(!Request_req){
			console.debug('no req for id:'+Message_msg.id);
			return;
		}
		if(Request_req.random!==Message_msg.random)
			return;//ignore wrong response
		if(Message_msg.isError){
			Request_req.callback(Message_msg.data());
		}else{
			Request_req.callback(null,Message_msg.data());
		}
		this.delete(Request_req);
	}
}

module.exports = {
	Buffer,
	RPC,
};
