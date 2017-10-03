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
	2:cancel the operation of the id for which was requested (if possible)
*/

(function(global){
'use strict';
let NODEMODE=global.process&&global.process.release&&global.process.release.name=='node';
if(!global.Buffer)var Buffer;//prevent browser from adding Buffer.js
const utf8Util=require('utf8util');


//Polyfill
Number.MAX_SAFE_INTEGER=0x1fffffffffffff;
if(!Number.isSafeInteger)
Number.isSafeInteger=function(a){return Number.isInteger(a)&&Math.abs(a)<=Number.MAX_SAFE_INTEGER};
if(!Number.isInteger)
Number.isInteger=function(b){return"number"==typeof b&&isFinite(b)&&Math.floor(b)===b};


const SUPPORT_ARRAYBUFFER=!!global.ArrayBuffer;
const TypedArray=SUPPORT_ARRAYBUFFER&&global.Float32Array.prototype.constructor.__proto__;
if(SUPPORT_ARRAYBUFFER && !ArrayBuffer.isView){//ArrayBuffer.isView
	ArrayBuffer.isView=a=>!!((TypedArray&&(a instanceof TypedArray))||(global.DataView&&(a instanceof DataView)));
}

//the object for packing and unpacking data
class Packer{		//data packer
	static pack(packType,id,data){
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
		const 	b0=(packType===0)?1:0,//b0(pack type)
				b1=(b0===0 && id===0) || ((b0===1 && isError)?1:0);//b1
		let 	b2t4=0,b5t7;

		//b2t4(data type)
		switch(data){
			case true:b2t4=2;break;
			case false:b2t4=3;break;
			case undefined:b2t4=4;break;
			case null:b2t4=5;break;
			default:{//data that has data body
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
				}else{//serialized
					b2t4=6;
					data=JSON.stringify(data);
				}
				//convert string to buffer
				if(typeof data === 'string'){
					b2t4||(b2t4=1);
					if(NODEMODE){
						pack=Buffer.allocUnsafe(idByte+1+Buffer.byteLength(data,'utf8'));
						pack.write(data,idByte+1);
						pack.fill(0,0,idByte+1);
					}else{
						pack=utf8Util.utf8ToBytes(data,idByte+1);
					}
				}
			}
		}
		//write head
		if(!pack)pack=NODEMODE?Buffer.alloc(1+idByte):new Uint8Array(1+idByte);
		if(idByte){//write id
			for(let byte=idByte;byte;byte--){
				pack[byte]=(id>>((idByte-byte)*8))&0xFF;
			}
		}
		pack[0]=(b0<<7) | (b1<<6) | (b2t4<<3) | idByte;

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

		this.buffer=buffer;
		this.dataType=(this.head>>3&0b111);
		this.head=buffer.subArray(0,1)[0];
		this.isRequest=(this.head&0b10000000)===0;
		if(this.isRequest===true){
			this.requireResponse=(this.head&0b01000000)===0;
		}else{
			this.isError=(this.head&0b01000000)===0;
			if(this.isError===true && this.dataType!==1){
				this.isError=false;
				this.isCtrl=true;
			}
		}
		this.idByte=this.head&0b111;//idBytes
		if(this.requireResponse===true && this.idByte!==0){
			this.id=0;
			for(let i=this.idByte,bytes=this.idByte;i--;bytes--){//get id
				this.id+=(this.head[bytes]<<((this.idByte-bytes)*8));
			}
		}
	}
	getData(){
		switch(this.dataType){
			case 0:return this._dataBuffer();
			case 1:{
				return this._readString();
			}
			case 2:return true;
			case 3:return false;
			case 4:return undefined;
			case 5:return null;
			case 6:{
				if(NODEMODE)return JSON.parse(_dataBuffer());
				else return JSON.parse(this._readString());
			}
			case 7:{
				let b=this._dataBuffer(),n=((b[0]&127)<<24)|(b[1]<<16)|(b[2]<<8)|b[3];
				if((b[0]>>7)===1)n=-n;
				return n;
			}
		}
	}
	_dataBuffer(){
		return this.buffer.subArray(this.idByte+1);
	}
	_readString(){
		if(NODEMODE)return Buffer.from(this.buffer,this.idByte+1).toString('utf8');//use buffer for node
		else{
			return utf8Util.utf8ToBytes(this.buffer.subArray(this.idByte+1));
		}
	}
}

class request{
	constructor(id,callback){
		this._stat=false;
		this.id=id;
	}
	cancel(){
		if(!this._stat)return false;
	}
}

class RPC{		//RPC handle
	constructor(){
		this.funcList=[];
		this._count=0;
		this._packer=new Packer(this);
		this.lastUsedId=0;
		this.timeout=30000;
	}
	getId(){
		if(this._count===4294967296)return false;
		do{
			this.lastUsedId++;
			if(this.lastUsedId===4294967296)this.lastUsedId=1;
		}while(!this.funcList[this.lastUsedId]);
		return this.lastUsedId;
	}
	handle(data){//handle received data
		let pack=Packer.unpack(data);
		if(pack.isCtrl===true){//it's a control pack
			return this._control(pack.dataType,pack.id);
		}else if(pack.isRequest===true){//it's a request

		}else{//it's a response

		}
	}
	request(data,callback,opt){	//if callback not set,it will return a Promise(if supported)
		let pack=this._packer;
		if(!(callback instanceof Function) && global.Promise)
			return new Promise((resolve,reject)=>{

			});
	}
	response(id,data,opt){
//todo
	}
	get(id){
//?
	}
	_control(code,id){
		switch(code){
			case 2:{//cancel an operation
//todo
				break;
			}
		}
	}
	/*------------------------*/
	data(data,callback){}//rewrite this method to resolve data.callback(id,response data)
}


module.exports = RPC;

})((0,eval)('this'));
