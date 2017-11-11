/*
Copyright luojia@luojia.me
MIT LICENSE
*/


/*
data pack head structure
	0		pack type(0:request,1:response)
	1		if(bit0==0)response requirement(0:require response,1:or not);
			if(bit0==1)is this pack an error response(0:no,1:yes)
	2-4		data type(0:raw,1:string,2:true,3:false,4:undefined,5:null,6:serialized,7:signed int32 number)
	5-7		id byte length,max is 4
	8-..	id bytes
	...-...	data

if the pack is a request without response requirement,there is no id in the pack head

if the first 2 bits are 11(error response),and the 3rd part(data type) is not 1(data of the error response must be a string which is the message of the Error),
	the 3rd part becomes a control code
	2:cancel the remote callback of the id for which was requested (if possible)

*/

(function(global){
'use strict';
let NODEMODE=global.process&&global.process.release&&global.process.release.name=='node';
if(!NODEMODE){
	var utf8Util=require('utf8util');
}else{
	var Buffer=global.Buffer;
}
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

const defaultRequestOpt={
	requireResponse:true,
};

//the object for packing and unpacking data
class Packer{		//data packer
	static pack(packType,id,data,dataType){
		let idByte=0,
			isError=false,pack;
		if(data instanceof Error){
			isError=true;
			data=data.message;
		}

		//idByte
		if(id>=65536){
			if(id>=16777216)idByte=4;
			else{idByte=3;}
		}else{
			if(id>=256){idByte=2;}
			else if(id>0){idByte=1;}
		}
		//bits
		const 	b0=(packType===0)?0:1,//b0(pack type)
				b1=(b0===0 && id===0) || ((b0===1 && isError)?1:0);//b1
		let 	b2t4=0,b5t7;

		//b2t4(data type)
		if(dataType!==undefined){
			b2t4=dataType;
		}else switch(data){
			case true:b2t4=2;break;
			case false:b2t4=3;break;
			case undefined:b2t4=4;break;
			case null:b2t4=5;break;
			default:{//data that has data body
				let toBuf=false;
				if(data instanceof ArrayBuffer || ArrayBuffer.isView(data)){//buffer
					b2t4=0;
					if(!(data instanceof Uint8Array))
						data=new Uint8Array(data);
					pack=new Uint8Array(idByte+1+data.byteLength);
					pack.set(data,idByte+1);
				}else if(Number.isSafeInteger(data)){//int32
					b2t4=7;
					pack=new Uint8Array(idByte+5);//write to buffer directly
					let dv=new DataView(pack.buffer,idByte+1,4);
					dv.setInt32(data);
				}else if(typeof data === 'string'){
					toBuf=true;
				}else{//serialized
					b2t4=6;
					data=JSON.stringify(data);
					toBuf=true;
				}
				//convert string to buffer
				if(toBuf){//todo
					b2t4||(b2t4=1);
					if(NODEMODE===true){
						pack=Buffer.allocUnsafe(idByte+1+Buffer.byteLength(data));//d.byteLength
						pack.fill(data,idByte+1);
					}else{
						pack=utf8Util.utf8ToBytes(data,idByte+1);
					}
				}
			}
		}
		if(b2t4>7 || b2t4<0)throw(new Error('Wrong data type'));
		//write head
		if(!pack)pack=(NODEMODE===true)?Buffer.alloc(1+idByte):new Uint8Array(1+idByte);
		if(idByte>0){//write id
			for(let byte=idByte;byte;byte--){
				pack[byte]=(id>>((idByte-byte)*8))&0xFF;
			}
		}
		pack[0]=((b0<<7) | (b1<<6) | (b2t4<<3) | idByte);

		return pack;
	}
	static unpack(buffer){
		return new Pack(buffer);
	}
}


class Pack{		//data pack
	constructor(buffer){
		if(!(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer)))
			throw(new TypeError('buffer is not an instance of ArrayBuffer or TypedArray.'))
		if(!(buffer instanceof Uint8Array))buffer=new Uint8Array(buffer);

		this.buffer=new Uint8Array(buffer);
		this.head=buffer.subarray(0,1)[0];
		this.dataType=(this.head>>3&0b111);
		this.isRequest=((this.head&0b10000000)===0);
		if(this.isRequest===true){
			this.requireResponse=((this.head&0b01000000)===0);
		}else{
			this.isError=((this.head&0b01000000)!==0);
			if(this.isError===true && this.dataType!==1){
				this.isError=false;
				this.isCtrl=true;
			}
		}
		this.idByte=this.head&0b111;//idBytes
		if(this.idByte!==0){
			this.id=0;
			for(let i=this.idByte,bytes=this.idByte;i--;bytes--){//get id
				this.id|=(this.buffer[bytes]<<((bytes-1)*8));
			}
		}
	}
	getData(){
		switch(this.dataType){
			case 0:return this._dataBuffer();
			case 1:return this._readString();
			case 2:return true;
			case 3:return false;
			case 4:return undefined;
			case 5:return null;
			case 6:{
				if(NODEMODE===true)return JSON.parse(this._dataBuffer());
				else return JSON.parse(this._readString());
			}
			case 7:{
				let b=this._dataBuffer(),n=((b[0]&127)<<24)|(b[1]<<16)|(b[2]<<8)|b[3];
				if((b[0]>>7)===1)n=-n;
				return n;
			}
		}
	}
	get data(){
		return this.getData();
	}
	_dataBuffer(){
		return this.buffer.subarray(this.idByte+1);
	}
	_readString(){
		if(NODEMODE===true)return Buffer.from(this._dataBuffer()).toString('utf8');//use buffer for node
		else{
			return utf8Util.bytesToUTF8(this._dataBuffer());
		}
	}
}

class Request{
	constructor(rpc,id,callback){
		this._stat=0;//0:inited 1:requested 2:responsed 3:deleted
		this.id=id;
		this.rpc=rpc;
		this.timeout;
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
			this.timeout=null;
		}
	}
	delete(){
		if(this._stat===3)return false;
		if(this.rpc.sendedList.get(this.id) === this)
			this.rpc.sendedList.delete(this.id);
		this._finish();
		this.cb=null;
		this.rpc=null;
		this._stat=3;
		return true;
	}
	_timeout(){
		if(!this.cb)return;
		this.cb(Error('Time out'));
		this.rpc.control(2,this.id);
	}
	setTimeout(time=this.rpc.timeout){
		this.timeout=setTimeout(()=>{
			this._timeout();
			this.delete();
		},time);
	}
}

class Response extends events{
	constructor(rpc,pack){
		super();
		this.rpc=rpc;
		this.pack=pack;
	}
	send(data){
		this.rpc._response(this,data);
	}
	abort(){
		this.emit('abort');
	}
}


class RPC extends events{		//RPC handle
	constructor(){
		super();
		this.sendedList=new Map();
		this.receivedList=new Map();
		this._currentID=1;
		this.timeout=30000;
	}
	get Packer(){return Packer;}
	_getId(){
		if(this.sendedList.size===4294967296)return false;
		while(this.sendedList.has(this._currentID)){
			this._currentID++;
			if(this._currentID===4294967296)this._currentID=1;
		}
		return this._currentID;
	}
	handle(data){//handle received data
		let pack=Packer.unpack(data);
		if(pack.isCtrl===true){//it's a control pack
			this._controlHandle(pack.dataType,pack.id);
		}else if(pack.isRequest===true){//it's a request
			this._requestHandle(pack);
		}else{//it's a response
			this._responseHandle(pack);
		}
	}
	request(data,callback,opt){	//if callback not set,it will be a request without response requirement.
		if(typeof opt!== 'object')opt={};
		opt.__proto__=defaultRequestOpt;
		if(typeof callback !== 'function')opt.requireResponse=false;
		let id;
		if(opt.requireResponse===true){
			if((id=this._getId())===false)throw(new Error('No free id.'));
		}else{
			id=0;
		}
		
		let pack=Packer.pack(0,id,data),request;
		if(id!==0){
			request=new Request(this,id,callback);
			this.sendedList.set(id,request);
			request.setTimeout(opt.timeout||this.timeout);
		}
		this.emit('data',pack);
		return request;
	}
	control(code,id){
		let pack=Packer.pack(0,id,null,code);
		this.emit('data',pack);
	}
	_response(res,data){
		let pack=res.pack;
		if(pack.requireResponse===false)
			throw(new Error('The request dosen\'t need a response'));
		if(this.receivedList.get(pack.id) !== res){
			console.debug('Missing pack');
			//throw(new Error('No id:'+pack.id));	//ignore ids that not exist
			return;
		}
		let rePack=Packer.pack(1,pack.id,data);
		this.receivedList.delete(pack.id);
		this.emit('data',rePack);
	}
	_controlHandle(code,id){//received control pack
		switch(code){
			case 2:{//cancel an operation
				let res=this.receivedList.has(pack.id);
				if(!res)
					throw(new Error('No id:'+pack.id));
				res.abort();
				this.receivedList.delete(id);
				break;
			}
			default:{
				this.emit('error',new Error('Unkonown control code:'+code));
			}
		}
	}
	_requestHandle(pack){
		if(this.receivedList.has(pack.id)){
			this.response(pack,Error('Duplicate id'));
			return;
		}
		let res=new Response(this,pack);
		this.receivedList.set(pack.id,res);
		this.emit('request',res);
	}
	_responseHandle(pack){//handle received response
		let req=this.sendedList.get(pack.id);
		if(!req){
			console.debug('no id:'+pack.id);
			return;
		}
		//console.log('handle pack',pack)
		if(pack.isError){
			req.callback(pack.data);
		}else{
			req.callback(null,pack.data);
		}
		if(pack.id<this._currentID)this._currentID=pack.id;
		req.delete();
	}
}

module.exports = RPC;


})((0,eval)('this'));


