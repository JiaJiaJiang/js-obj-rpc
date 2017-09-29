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

if the pack says that it's a request without response requirement,there is no id in the pack head
*/
'use strict';


(function(global){
let NODEMODE=global.process&&global.process.release&&global.process.release.name=='node',
	Buffer;
if(NODEMODE){
	Buffer=require('buffer');
}


//Polyfill
Number.MAX_SAFE_INTEGER||(Number.MAX_SAFE_INTEGER=9007199254740991);
if(!Number.isSafeInteger)
Number.isSafeInteger=function(a){return Number.isInteger(a)&&Math.abs(a)<=Number.MAX_SAFE_INTEGER};
if(!Number.isInteger)
Number.isInteger=function(b){return"number"==typeof b&&isFinite(b)&&Math.floor(b)===b};

/*! http://mths.be/codepointat v0.1.0 by @mathias */
String.prototype.codePointAt||function(){'use strict';var a=function(b){if(null==this)throw TypeError();var c=this+'',d=c.length,e=b?+b:0;if(e!=e&&(e=0),!(0>e||e>=d)){var g,f=c.charCodeAt(e);return 55296<=f&&56319>=f&&d>e+1&&(g=c.charCodeAt(e+1),56320<=g&&57343>=g)?1024*(f-55296)+g-56320+65536:f}};Object.defineProperty?Object.defineProperty(String.prototype,'codePointAt',{value:a,configurable:!0,writable:!0}):String.prototype.codePointAt=a}();
String.fromCodePoint||function(){var a=function(){try{var e={},f=Object.defineProperty,g=f(e,e,e)&&f}catch(h){}return g}(),b=String.fromCharCode,c=Math.floor,d=function(){var f=[],g,h,i=-1,j=arguments.length;if(!j)return'';for(var l,k='';++i<j;){if(l=+arguments[i],!isFinite(l)||0>l||1114111<l||c(l)!=l)throw RangeError('Invalid code point: '+l);65535>=l?f.push(l):(l-=65536,g=(l>>10)+55296,h=l%1024+56320,f.push(g,h)),(i+1==j||f.length>16384)&&(k+=b.apply(null,f),f.length=0)}return k};a?a(String,'fromCodePoint',{value:d,configurable:!0,writable:!0}):String.fromCodePoint=d}();


const SUPPORT_ARRAYBUFFER=!!global.ArrayBuffer;
const TypedArray=SUPPORT_ARRAYBUFFER&&global.Float32Array.prototype.constructor.__proto__;
if(SUPPORT_ARRAYBUFFER && !ArrayBuffer.isView){//ArrayBuffer.isView
	ArrayBuffer.isView=a=>!!((TypedArray&&(a instanceof TypedArray))
							||(global.DataView&&(a instanceof DataView)));
}

//default option
var defailtRPCOpt={
	timeout:3000,
}


class Packer{		//data packer
	static pack(packType,id,data){
		let idByte=0,//idOffset=1,idByteLength=4,
			isError=false,pack;
		if(data instanceof Error){
			isError=true;
			data=data.message;
		}

		//idByte
		if(id>=65536){
			if(id>=16777216)idByte=4;
			else{idByte=3;/*idOffset=0;*/}
		}else{
			if(id>=256){idByte=2;/*idByteLength=2;*/}
			else if(id>0){idByte=1;/*idByteLength=1;*/}
			//else{idByteLength=0;}
		}
		
		//bits
		const 	b0=(packType===0)?1:0,//b0(pack type)
				b1=(b0===0 && id===0) || (b0===1 && isError)?1:0,//b1
				b2t4=0,b5t7;

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
			let byte=idByte;
			for(;byte;byte--){
				pack[byte]=(id>>((idByte-byte)*8))&0xFF;
			}
		}
		/*if(idByteLength){
			let idView=new DataView(pack,idOffset,idByteLength);
			switch(idByte){//write id to head
				case 1:{idView.setUint8(id);break;}
				case 2:{idView.setUint16(id);break;}
				case 3:case 4:{idView.setUint32(id);break;}
			}
		}*/
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
			throw(new TypeError('buffer is not an instance of ArrayBuffer or a TypedArray.'))
		if(!(buffer instanceof Uint8Array))buffer=new Uint8Array(buffer);

		this.buffer=buffer;
		this.head=buffer.subArray(0,1)[0];
		this.isRequest=(this.head&0b10000000)===0;
		if(this.isRequest){
			this.requireResponse=(this.head&0b01000000)===0;
		}else{
			this.isError=(this.head&0b01000000)===0;
		}
		this.dataType=(this.head>>3&0b111);
		this.idByte=this.head&0b111;idBytes
		if(this.requireResponse&&this.idByte){
			let idView=new DataView(buffer,this.idByte===3?0:1,this.idByte===3?4:this.idByte);
			switch(this.idByte){
				case 1:{this.id=idView.getUint8();break;}
				case 2:{this.id=idView.getUint16();break;}
				case 3:{this.id=(idView.getUint32()&0x00FFFFFF;);break;}
				case 4:{this.id=idView.getUint32();break;}
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


class RPC{		//RPC handle
	constructor(){
		this.funcList=[];
		this._count=0;
		this._packer=new Packer(this);
		this.lastUsedId=0;

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
		if(pack.isRequest){//it's a request

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

	}
	get(id){

	}
	/*------------------------*/
	data(data,callback){}//rewrite this method to resolve data.callback(response data)
}


//string to utf8
const utf8Util={
	countByte:str=>{
		if((typeof str!=='string') || (str.length===0))return 0;
		let byteLength=0,code;
		for(let i=0;i<str.length;i++){
			code=str.codePointAt(i);
			if (code>0xD7FF&&code<0xE000)continue;
			if(code<128)byteLength++;
			else if(code<2048)byteLength+=2;
			else if(code<65536)byteLength+=3;
			else if(code<1114112)byteLength+=4;
			else throw(new Error('Invalid char code'));
		}
		return byteLength;	
	},
	utf8ToBytes:(str,offsetInBuffer=0)=>{
		let bytes=countByte(str),
			arr=new Uint8Array(offsetInBuffer+bytes),
			code,
			i=0,
			t=offsetInBuffer;
		if(bytes===0)return arr;
		for(;i<str.length;i++){
			code=str.codePointAt(i);
			if (code>0xD7FF&&code<0xE000)continue;
			if(code<128){arr[t++]=code;}
			else if(code<2048){
				arr[t++]=code>>6|0xC0;
				arr[t++]=code&0x3F|0x80;
			}
			else if(code<65536){
				arr[t++]=code>>12|0xE0;
				arr[t++]=code>>6&0x3F|0x80;
				arr[t++]=code&0x3F|0x80;
			}
			else if(code<1114112){
				arr[t++]=code>>18|0xF0;
				arr[t++]=code>>12&0x3F|0x80;
				arr[t++]=code>>6&0x3F|0x80;
				arr[t++]=code&0x3F|0x80;
			}
			else throw(new Error('Invalid char code'));
		}
		return arr;	
	},
	bytesToUTF8:arr=>{
		var chars=[],u=0,tCode=0;
		for(let i=0;i<arr.length;i++){
			if(u){
				tCode|=(((arr[i]&0x3F)<<(6*--u)));
				if(u===0){
					chars.push(String.fromCodePoint(tCode));
				}
				continue;
			}
			if((arr[i]&0xF0) === 0xF0){u=3;}//4bytes
			else if((arr[i]&0xE0) === 0xE0)u=2;//3bytes
			else if((arr[i]&0xC0) === 0xC0)u=1;//2bytes
			else if((arr[i]&0x80) === 0){//1byte
				chars.push(String.fromCharCode(arr[i]));
				continue;
			}
			tCode=((arr[i]&(255>>(u+2)))<<(u*6));
		}
		return chars.join('');	
	}
}


if (typeof define === "function" && define.amd) {
	define(factory);
}else if (typeof exports === "object") {
	module.exports = factory();
}else {
	root.CanvasObjLibrary = factory();
}


})(eval('this'));
