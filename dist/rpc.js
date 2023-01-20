(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.RPC = factory());
})(this, (function () { 'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var eventemitter3Exports = {};
	var eventemitter3 = {
	  get exports(){ return eventemitter3Exports; },
	  set exports(v){ eventemitter3Exports = v; },
	};

	(function(a){function b(){}function c(a,b,c){this.fn=a,this.context=b,this.once=c||!1;}function d(a,b,d,e,f){if("function"!=typeof d)throw new TypeError("The listener must be a function");var g=new c(d,e||a,f),i=h?h+b:b;return a._events[i]?a._events[i].fn?a._events[i]=[a._events[i],g]:a._events[i].push(g):(a._events[i]=g,a._eventsCount++),a}function e(a,c){0==--a._eventsCount?a._events=new b:delete a._events[c];}function f(){this._events=new b,this._eventsCount=0;}var g=Object.prototype.hasOwnProperty,h="~";Object.create&&(b.prototype=Object.create(null),!new b().__proto__&&(h=!1)),f.prototype.eventNames=function(){var a,b,c=[];if(0===this._eventsCount)return c;for(b in a=this._events)g.call(a,b)&&c.push(h?b.slice(1):b);return Object.getOwnPropertySymbols?c.concat(Object.getOwnPropertySymbols(a)):c},f.prototype.listeners=function(a){var b=h?h+a:a,c=this._events[b];if(!c)return [];if(c.fn)return [c.fn];for(var d=0,e=c.length,f=Array(e);d<e;d++)f[d]=c[d].fn;return f},f.prototype.listenerCount=function(a){var b=h?h+a:a,c=this._events[b];return c?c.fn?1:c.length:0},f.prototype.emit=function(a,b,c,d,e,f){var g=h?h+a:a;if(!this._events[g])return !1;var k,l,m=this._events[g],n=arguments.length;if(m.fn){switch(m.once&&this.removeListener(a,m.fn,void 0,!0),n){case 1:return m.fn.call(m.context),!0;case 2:return m.fn.call(m.context,b),!0;case 3:return m.fn.call(m.context,b,c),!0;case 4:return m.fn.call(m.context,b,c,d),!0;case 5:return m.fn.call(m.context,b,c,d,e),!0;case 6:return m.fn.call(m.context,b,c,d,e,f),!0;}for(l=1,k=Array(n-1);l<n;l++)k[l-1]=arguments[l];m.fn.apply(m.context,k);}else {var o,p=m.length;for(l=0;l<p;l++)switch(m[l].once&&this.removeListener(a,m[l].fn,void 0,!0),n){case 1:m[l].fn.call(m[l].context);break;case 2:m[l].fn.call(m[l].context,b);break;case 3:m[l].fn.call(m[l].context,b,c);break;case 4:m[l].fn.call(m[l].context,b,c,d);break;default:if(!k)for(o=1,k=Array(n-1);o<n;o++)k[o-1]=arguments[o];m[l].fn.apply(m[l].context,k);}}return !0},f.prototype.on=function(a,b,c){return d(this,a,b,c,!1)},f.prototype.once=function(a,b,c){return d(this,a,b,c,!0)},f.prototype.removeListener=function(a,b,c,d){var f=h?h+a:a;if(!this._events[f])return this;if(!b)return e(this,f),this;var g=this._events[f];if(g.fn)g.fn!==b||d&&!g.once||c&&g.context!==c||e(this,f);else {for(var j=0,k=[],l=g.length;j<l;j++)(g[j].fn!==b||d&&!g[j].once||c&&g[j].context!==c)&&k.push(g[j]);k.length?this._events[f]=1===k.length?k[0]:k:e(this,f);}return this},f.prototype.removeAllListeners=function(a){var c;return a?(c=h?h+a:a,this._events[c]&&e(this,c)):(this._events=new b,this._eventsCount=0),this},f.prototype.off=f.prototype.removeListener,f.prototype.addListener=f.prototype.on,f.prefixed=h,f.EventEmitter=f,a.exports=f;})(eventemitter3);

	var events=eventemitter3Exports;Number.MAX_SAFE_INTEGER||(Number.MAX_SAFE_INTEGER=9007199254740991),Number.isSafeInteger||(Number.isSafeInteger=function(b){return Number.isInteger(b)&&Math.abs(b)<=Number.MAX_SAFE_INTEGER}),Number.isInteger||(Number.isInteger=function(a){return "number"==typeof a&&isFinite(a)&&Math.floor(a)===a});const SUPPORT_ARRAYBUFFER=!!commonjsGlobal.ArrayBuffer,TypedArray=SUPPORT_ARRAYBUFFER&&commonjsGlobal.Float32Array.prototype.constructor.__proto__;SUPPORT_ARRAYBUFFER&&!ArrayBuffer.isView&&(ArrayBuffer.isView=b=>!!(TypedArray&&b instanceof TypedArray||commonjsGlobal.DataView&&b instanceof DataView));const encoder=new TextEncoder,decoder=new TextDecoder,tmpFloat64Array1=new Float64Array(1),tmpUint8Array1=new Uint8Array(1),tmpUint8Array9=new Uint8Array(9);function strToUint8(a){return encoder.encode(a)}function uint8ToStr(a){return decoder.decode(a)}function getSliceInArrayBuffer(a){return a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength)}function concatArrayBuffers(a){let b=Array(a.length),c=0;for(let d=0;d<a.length;d++)b[d]=c,c+=a[d].byteLength,a[d]instanceof ArrayBuffer&&(a[d]=new Uint8Array(a[d]));const d=new Uint8Array(c);for(let c=0;c<a.length;c++)d.set(a[c],b[c]);return d}class Message{id;random;head;type;_data;hasID;payload;isRequest;constructor(a){if(ArrayBuffer.isView(a)||!0==a instanceof ArrayBuffer)a=new Uint8Array(a);else throw new TypeError("Wrong data");if(0===a.byteLength)throw new Error("Bad message");if(a=new Uint8Array(a),this.head=a[0],this.isRequest=0==(128&this.head),this.hasID=!this.isRequest||64==(64&this.head),this.hasID){if(5>a.byteLength)throw new Error("Bad message");const b=new DataView(a.buffer,a.byteOffset,a.byteLength);this.id=b.getUint32(1),this.random=b.getUint32(5);}this.type=31&this.head,this.payload=a.buffer.slice(a.byteOffset+this.hasID?9:1,a.byteLength),this._data;}get isCtrl(){return 8>this.type}get isError(){return !(64!=(64&this.head))}data(){return void 0===this._data?(this._data=(()=>{if(8>this.type)return ControlMsg.parseData(this.type,this.payload);switch(this.type){case 8:return !0;case 9:return !1;case 10:return this.payload;case 11:return uint8ToStr(this.payload);case 12:return JSON.parse(uint8ToStr(this.payload));case 13:if(8!==this.payload.byteLength)throw "Wrong data length for number";const a=new DataView(this.payload);return a.getFloat64(0);case 14:return;case 15:return null;case 16:{const a=uint8ToStr(this.payload);return "-"===a[0]?-BigInt("0x"+a.slice(1)):BigInt("0x"+a)}default:throw "Unknown data type";}})(),this._data):this._data}static toFrameData(a){if(a===void 0)return [14];if(null===a)return [15];if(!0===a)return [8];if(!1===a)return [9];if(a instanceof ErrorMsg)return [12,strToUint8(JSON.stringify({code:a.code||4100,msg:a.msg}))];if(a instanceof ControlMsg)return [a.code,a.buf];if(a instanceof ArrayBuffer||ArrayBuffer.isView(a))return [10,a.buffer?getSliceInArrayBuffer(a):a];if(a instanceof Error)throw "Dont use Error, use RPC.Error instead";switch(typeof a){case"string":return [11,strToUint8(a)];case"object":return [12,strToUint8(JSON.stringify(a))];case"number":const b=new DataView(tmpFloat64Array1.buffer,tmpFloat64Array1.byteOffset,tmpFloat64Array1.byteLength);return b.setFloat64(0,a),[13,getSliceInArrayBuffer(b)];case"bigint":return [16,strToUint8(a.toString(16))];}throw new TypeError("Unsupported data type: "+typeof a)}static _pack(a,b,c,d,e,f){let g="number"==typeof e&&0<e,h=g?tmpUint8Array9:tmpUint8Array1;h.fill(0),!0===a?g&&(h[0]|=64):(h[0]=128,b&&(h[0]|=64)),h[0]|=c;let i=[h];if(g){if(4294967295<=e)throw new Error("id out of range");const a=new DataView(h.buffer,h.byteOffset,h.byteLength);a.setUint32(1,e),a.setUint32(5,f);}return d&&d.byteLength&&i.push(d),concatArrayBuffers(i)}static pack(a,b,c,d){let[e,f]=Message.toFrameData(b);return Message._pack(a,b instanceof ErrorMsg,e,f,c,d)}static msgErrorCodes={4100:"",4101:"Forbidden",4102:"Cannot parse the data",4103:"Not supported operation",4104:"Duplicate id",4105:"Time out"};static isValidId(a){return "number"==typeof a&&0<a&&4294967295>=a}}class ErrorMsg{constructor(a,b=""){if(this.code=a,"string"==typeof b)this.msg=b;else if(b instanceof Error)this.msg=b.message;else throw new Error("Not supported message type")}}class ControlMsg{static cache={};static codes={abort:1};code;buf;constructor(a,b){if(!1==a in ControlMsg.codes)throw new Error("Unknown operation name");switch(this.code=ControlMsg.codes[a],this.code){case ControlMsg.codes.abort:if(!Message.isValidId(b))throw "Invalid id: "+b;this.buf=new ArrayBuffer(4),new DataView(this.buf).setUint32(0,b);}}static parseData(a,b){return a===ControlMsg.codes.abort?new DataView(b).getUint32(0):void 0}}class Request{responded=!1;timeout;constructor(a,b,c,d){this.id=b,this.rpc=a,this.cb=c,this.random=d;}abort(){this.rpc.control("abort",this.id),this.rpc.delete(this);}callback(...a){if(this.responded)throw new Error("RPC responded");this.responded=!0,this.cb&&this.cb(...a);}setTimeout(a){if("number"!=typeof a||!(0<=a))throw new Error("Wrong timeout");this.timeout&&clearTimeout(this.timeout),this.timeout=setTimeout(()=>this._timeout(),a);}_timeout(){this.timeout=0,this.callback(new Error("Time out")),this.abort();}_destructor(){this.cb=null,this.rpc=null,this.timeout&&(clearTimeout(this.timeout),this.timeout=0);}static generateRandom(){return Math.round(4294967295*Math.random())}}class InRequest extends events{_timeout;aborted=!1;responded=!1;source;constructor(a,b,c){super(),this.rpc=b,this.msg=a,this.source=c;}get id(){return this.msg.id}data(){return this.msg.data()}setTimeout(a){if("number"!=typeof a||!(0<=a))throw new Error("Wrong timeout");this._timeout&&clearTimeout(this._timeout),this._timeout=setTimeout(()=>this._reachTimeout(),a);}_abort(a){this.aborted=!0,this.emit("abort",a);}_reachTimeout(){this._timeout=0,this._abort("time out"),this.rpc._respond(this,RPC.Error(4105));}_destructor(){this.rpc=null,this.msg=null,this._timeout&&(clearTimeout(this._timeout),this._timeout=0);}}class RPC extends events{static Error(a,b){return new ErrorMsg(a,b||Message.msgErrorCodes[a]||"Unexpected error")}debug=!1;_currentID=1;defaultRequestTimeout;defaultResponseTimeout;reqList=new Map;inReqList=new Map;_checkerTimer;_sender;constructor(a={}){super(),this.defaultRequestTimeout=a.defaultRequestTimeout||15e3,this.defaultResponseTimeout=a.defaultResponseTimeout||15e3;}_generateId(){if(4294967295===this.reqList.size)return !1;for(;this.reqList.has(this._currentID);)this._currentID++,4294967295===this._currentID&&(this._currentID=1);return this._currentID}handle(a,b){let c=new Message(a);!0===c.isCtrl?this._controlHandle(c.type,c.data(),b):!0===c.isRequest?this._requestHandle(c,b):this._responseHandle(c,b);}request(a,b,c){"object"!=typeof c&&(c={});let d,e,f=0;if("function"==typeof b&&!1===(f=this._generateId()))throw new Error("No free id");0!==f&&(e=Request.generateRandom());let g=Message.pack(!0,a,f,e);return 0!==f&&(d=new Request(this,f,(c,d)=>{c&&this.debug&&console.debug("RPC receive error","req:",a,"err:",c),b&&b(c,d);},e),this.reqList.set(f,d),d.setTimeout(c.timeout||this.defaultRequestTimeout)),this._send(g).then(b=>{b&&this.debug&&console.debug("RPC send error","req:",a,"err:",b),b&&d.callback(b);}),d}control(a,b){let c=new ControlMsg(a,b),d=Message._pack(!0,!1,c.code,c.buf,0);return this._send(d)}delete(a){let b=a.id;if(a instanceof Request){if(this.reqList.get(b)===a)this.reqList.delete(b);else throw new Error("Deleting unknown req");a._destructor();}else if(a instanceof InRequest){if(this.inReqList.get(b)===a)this.inReqList.delete(b);else throw new Error("Deleting unknown inReq");a._destructor();}else throw console.error("arg: ",a),new Error("Wrong type")}setSender(a){if("function"!=typeof a)throw new TypeError("not a function");this._sender=a;}async _send(a){if(this._sender)return !1==(await this._sender(a))instanceof Error?void 0:await this._sender(a);throw new Error("sender not defined")}_respond(a,b){let c=a.msg;if(!c.hasID)throw new Error("The request dosen't need a response");if(this.inReqList.get(c.id)!==a)return void(this.debug&&console.debug("Missing id"));let d=Message.pack(!1,b,c.id,c.random);this._send(d),this.delete(a);}_controlHandle(a,b){switch(a){case ControlMsg.codes.abort:{let a=this.inReqList.get(b);if(!a)return;a._abort("remote abort"),this.delete(a);break}default:this.debug&&console.debug("Unknown control code:"+a);}}_requestHandle(a,b){if(this.inReqList.has(a.id))return void this._respond(a,RPC.Error(4104));let c=new InRequest(a,this,b);a.id&&(c.setTimeout(this.defaultResponseTimeout),this.inReqList.set(a.id,c)),this.emit("request",c,b=>{c.msg.id&&this.inReqList.get(a.id)===c&&this._respond(c,b);});}_responseHandle(a){let b=this.reqList.get(a.id);return b?void(b.random!==a.random||(a.isError?b.callback(a.data()):b.callback(null,a.data()),this.delete(b))):void(this.debug&&console.debug("no req for id:"+a.id))}destroy(){for(let[a,b]of this.reqList)b.callback(new Error("connection destroyed"));for(let[a,b]of this.inReqList)b._abort("connection destroyed");this.reqList.clear(),this.inReqList.clear();}}var jsObjRpc={RPC};

	return jsObjRpc;

}));
//# sourceMappingURL=rpc.js.map
