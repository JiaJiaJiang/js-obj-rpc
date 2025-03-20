/*
Copyright luojia@luojia.me
MIT LICENSE
*/

/* 
message structure
Byte 0-3		a fixed 4 bytes random id for check if this message is valid for this session, default is filled by 0
Byte 4
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
		15:		data null
		16:		data bigint
		16-31:	reserved
[
	Byte 5-8
		message id (if has id or is a response)
	Byte 9-12
		random number
]
Byte -
	data
*/


const SUPPORT_ARRAYBUFFER = !!global.ArrayBuffer;
const TypedArray = SUPPORT_ARRAYBUFFER && global.Float32Array.prototype.constructor.__proto__;
if (SUPPORT_ARRAYBUFFER && !ArrayBuffer.isView) {//ArrayBuffer.isView
	ArrayBuffer.isView = a => !!((TypedArray && (a instanceof TypedArray)) || (global.DataView && (a instanceof DataView)));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder()
const tmpFloat64Array1 = new Float64Array(1),
	tmpUint8Array5 = new Uint8Array(5),
	tmpUint8Array13 = new Uint8Array(13);
function strToUint8(str) {
	return encoder.encode(str);
}
function uint8ToStr(uint8) {
	return decoder.decode(uint8);
}
function getSliceInArrayBuffer(typedArray) {
	return typedArray.buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
}
function concatArrayBuffers(buffers) {
	let offsets = new Array(buffers.length), totalLength = 0;
	for (let ai = 0; ai < buffers.length; ai++) {
		offsets[ai] = totalLength;
		totalLength += buffers[ai].byteLength;
		if (buffers[ai] instanceof ArrayBuffer) {
			buffers[ai] = new Uint8Array(buffers[ai]);
		}
	}
	const result = new Uint8Array(totalLength);
	for (let i = 0; i < buffers.length; i++) {
		result.set(buffers[i], offsets[i]);
	}
	return result;
}
/**
 * @description	Message object
 * @class Message
 */
class Message {
	id;
	random;
	head;
	type;
	_data;
	hasID;
	payload;
	sessionId;
	isRequest;
	/**
	 * Creates an instance of Message.
	 * @param {ArrayBuffer} data
	 */
	constructor(data) {
		this.sessionId = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
		data = data.subarray(4);
		if (ArrayBuffer.isView(data) || (data instanceof ArrayBuffer) === true) data = new Uint8Array(data);
		else {
			throw (new TypeError('Wrong data'));
		}
		if (data.byteLength === 0) {
			throw (new Error('Bad message'));
		}
		data = new Uint8Array(data);
		this.head = data[0];
		this.isRequest = (this.head & 0b10000000) === 0;
		this.hasID = this.isRequest ? (this.head & 0b01000000) === 0b01000000 : true;
		// this.finished=(head&0b00100000)===0b00100000;//finished flag
		if (this.hasID) {//calc id
			if (data.byteLength < 5) {
				throw (new Error('Bad message'));
			}
			const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
			this.id = view.getUint32(1);
			this.random = view.getUint32(5);
		}
		this.type = this.head & 0b00011111;//type of the message
		this.payload = data.buffer.slice(data.byteOffset + this.hasID ? 9 : 1, data.byteLength);
		this._data;//data cache
	}
	/**
	 * @description	is control message
	 * @readonly
	 */
	get isCtrl() {
		return this.type < 8;
	}
	/**
	 * @description	is error message
	 * @readonly
	 */
	get isError() {
		if ((this.head & 0x40) === 0x40) {
			return true;
		}
		return false;
	}
	/**
	 * @description parse data
	 * @returns {any}	carried data
	 */
	data() {
		if (this._data !== undefined) return this._data;
		this._data = (() => {
			if (this.type < 8) return ControlMsg.parseData(this.type, this.payload);
			switch (this.type) {
				case 8: return true;
				case 9: return false;
				case 10: return this.payload;//binary
				case 11: return uint8ToStr(this.payload);//string
				case 12: return JSON.parse(uint8ToStr(this.payload));//json
				case 13://js number
					if (this.payload.byteLength !== 8)
						throw ('Wrong data length for number');
					const view = new DataView(this.payload);
					return view.getFloat64(0);
				case 14: return undefined;
				case 15: return null;
				case 16: {
					const bStr = uint8ToStr(this.payload);
					if (bStr[0] === '-') return -BigInt('0x' + bStr.slice(1));
					return BigInt('0x' + bStr);
				}
				default:
					throw ('Unknown data type');
			}
		})();
		return this._data;
	}
	/**
	 * @description	convert different data to message format buffer
	 * @static
	 * @param {any} data	data that defined at top of this file
	 * @returns {[number,ArrayBuffer]}	[type code, data buffer]
	 */
	static toFrameData(data) {
		if (data === undefined) return [14];
		if (data === null) return [15];
		if (data === true) return [8];
		if (data === false) return [9];
		if (data instanceof ControlMsg) {
			return [data.code, data.buf];
		}
		if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
			return [10, data.buffer ? getSliceInArrayBuffer(data) : data];
		}
		if (data instanceof Error) {
			if (this.debug) console.error(data);
			throw (new TypeError('Dont use Error, use RPC.Error instead'));
		}
		if (data instanceof ErrorMsg) {
			return [12, strToUint8(JSON.stringify({ code: data.code || 4100, msg: data.msg }))];
		}
		switch (typeof data) {
			case 'string': return [11, strToUint8(data)];
			case 'object': return [12, strToUint8(JSON.stringify(data))];
			case 'number':
				const view = new DataView(tmpFloat64Array1.buffer, tmpFloat64Array1.byteOffset, tmpFloat64Array1.byteLength);
				view.setFloat64(0, data);
				return [13, getSliceInArrayBuffer(view)];
			case 'bigint':
				return [16, strToUint8(data.toString(16))];
		}
		// console.error('data: ',data);//debug
		throw (new TypeError('Unsupported data type: ' + typeof data));
	}
	/**
	 * @description	pack data into message buffer
	 * @static
	 * @param {boolean} req	is request
	 * @param {boolean} err	is error
	 * @param {number} type	type code
	 * @param {ArrayBuffer} buf	data buffer
	 * @param {number} id	message id
	 * @param {number} randomNum	a random number for preventing id confict
	 * @returns {ArrayBuffer}  
	 */
	static _pack(sessionId, req, err, type, buf, id, randomNum) {
		let hasID = typeof id === 'number' && id > 0;
		let array = (hasID ? tmpUint8Array13 : tmpUint8Array5);//alloc the head buffer
		array.fill(0);
		const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
		view.setUint32(0, sessionId);
		const head = array.subarray(4, hasID ? 13 : 5);
		if (req === true) {//request
			if (hasID) head[0] |= 0b01000000;//set id flag
		} else {//response
			head[0] = 0b10000000;//set as response
			if (err) { head[0] |= 0b01000000; }//set err msg flag
		}
		head[0] |= type;
		let bufs = [array];
		if (hasID) {
			if (id >= 0xFFFFFFFF)
				throw (new Error('id out of range'));
			view.setUint32(5, id);//write id
			view.setUint32(9, randomNum);//write randomNum
		}
		if (buf && buf.byteLength) bufs.push(buf);
		return concatArrayBuffers(bufs);
	}
	/**
	 * @description	pack data into message buffer
	 * @static
	 * @param {boolean} req	is request
	 * @param {any} data	data to send
	 * @param {number} id	message id
	 * @param {number} randomNum	a random number for preventing id confict
	 * @returns {ArrayBuffer}	packed message
	 */
	static pack(sessionId, req, data, id, randomNum) {
		let [type, buf] = Message.toFrameData(data);//get data type and meg buffer
		let err = data instanceof ErrorMsg;
		return Message._pack(sessionId, req, err, type, buf, id, randomNum);
	}
	static msgErrorCodes = {
		4100: '',//free message
		4101: 'Forbidden',
		4102: 'Cannot parse the data',
		4103: 'Not supported operation',
		4104: 'Duplicate id',
		4105: 'Time out',
	}
	/**
	 * @description	is valid id
	 * @static
	 * @param {number} id
	 * @returns {boolean}
	 */
	static isValidId(id) {
		return typeof id === 'number' && id > 0 && id <= 0xFFFFFFFF;
	}
}

/**
 * @description error message
 * @class ErrorMsg
 */
class ErrorMsg {
	/**
	 * Creates an instance of ErrorMsg.
	 * @param {any} code	error code to return
	 * @param {string} [msg='']	error message to return
	 */
	constructor(code, msg = '') {
		this.code = code;
		if (typeof msg === 'string') {
			this.msg = msg;
		} else if (msg instanceof Error) {
			this.msg = msg.message;
		} else {
			throw (new Error('Not supported message type'));
		}
	}
}

/**
 * @description control message
 * @class ControlMsg
 */
class ControlMsg {
	static cache = {};
	static codes = {
		abort: 1,//abort an operation
	}
	code;
	buf;
	/**
	 * Creates an instance of ControlMsg.
	 * @param {string} name name of the control operation
	 * @param {*} data	data of the control message
	 */
	constructor(name, data) {
		if (name in ControlMsg.codes === false) {
			throw (new Error('Unknown operation name'));
		}
		this.code = ControlMsg.codes[name];
		switch (this.code) {
			case ControlMsg.codes.abort://abort message
				if (!Message.isValidId(data))
					throw ('Invalid id: ' + data);
				this.buf = new ArrayBuffer(4);
				(new DataView(this.buf)).setUint32(0, data);
				break;
		}
	}
	/**
	 * @description	convert control message payload to number
	 * @static
	 * @param {number} code	control code
	 * @param {ArrayBuffer} buf	control message payload
	 * @returns {number}  
	 */
	static parseData(code, buf) {
		switch (code) {
			case ControlMsg.codes.abort:
				return (new DataView(buf)).getUint32(0);
		}
	}
}

/**
 * @description request from remote
 * @class Request
 */
class Request {
	responded = false;
	timeout;
	/**
	 * Creates an instance of Request.
	 * @param {RPC} rpc
	 * @param {number} id	message id
	 * @param {function(...any)} callback	receive response data
	 * @param {number} random	a random number for preventing id confict
	 */
	constructor(rpc, id, callback, random) {
		this.id = id;
		this.rpc = rpc;
		this.cb = callback;
		this.random = random;
	}
	/**
	 * @description	abort the request, depends on remote data handle
	 * @returns {Request} the abort request
	 */
	abort() {
		try {
			return this.rpc.control('abort', this.id);
		} catch (err) {
			//nothing
		} finally {
			this.rpc.delete(this);
		}
	}
	/**
	 * @description	fill response data when the remote rpc respond
	 * @param {*} args
	 */
	callback(...args) {
		if (this.responded)
			throw (new Error('RPC responded'));
		this.responded = true;
		if (this.cb)
			this.cb(...args);
	}
	/**
	 * @description set timeout of the request
	 * @param {*} time
	 */
	setTimeout(time) {
		if (typeof time !== 'number' || !(time >= 0))
			throw (new Error('Wrong timeout'));
		if (this.timeout)
			clearTimeout(this.timeout);
		this.timeout = setTimeout(() => this._timeout(), time);
	}
	/**
	 * @description when timeout reaches, an abort control will be sent
	 */
	_timeout() {
		this.callback(new Error('Time out'));
		this.rpc.delete(this);
		this.timeout = 0;
	}
	_destructor() {
		this.cb = null;
		this.rpc = null;
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = 0;
		}
	}
}


/**
 * @description incoming request
 * @class InRequest
 */
class InRequest {
	_timeout;
	aborted = false;
	responded = false;
	source;
	rpc;
	msg;
	onAbort(data) { }//overwrite this
	/**
	 * Creates an instance of InRequest.
	 * @param {Message} Message_msg
	 * @param {RPC} rpc
	 * @param {*} source define a source, which will be attached to request object
	 */
	constructor(Message_msg, rpc, source) {
		this.rpc = rpc;
		this.msg = Message_msg;
		this.source = source;
	}
	/**
	 * @description	get message id
	 * @readonly
	 */
	get id() { return this.msg.id; }
	/**
	 * @description	get data of the message, wil be recovered to thier origin type
	 * @returns {any}  
	 */
	data() {
		return this.msg.data();
	}
	/**
	 * @description	set timeout of the incoming request
	 * @param {*} time
	 */
	setTimeout(time) {
		if (typeof time !== 'number' || !(time >= 0))
			throw (new Error('Wrong timeout'));
		if (this._timeout)
			clearTimeout(this._timeout);
		this._timeout = setTimeout(() => this._reachTimeout(), time);
	}
	_abortMsg(str_msg) {
		if (this.aborted)
			throw (new Error('request already aborted'));
		this.aborted = true;
		return this.onAbort(str_msg);
	}
	/**
	 * @description when timeout reaches, rpc will send an error back to remote
	 */
	async _reachTimeout() {
		this._timeout = 0;
		try {
			await this._abortMsg('time out');
			this.rpc._respond(this, RPC.Error(4105));
		} catch (err) {
		}
	}
	_destructor() {
		this.rpc = null;
		this.msg = null;
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = 0;
		}
	}
}
/**
 * @description RPC handle
 * @class RPC
 */
class RPC {
	static Error(code, msg) {
		return new ErrorMsg(code, msg || Message.msgErrorCodes[code] || 'Unexpected error');
	}
	debug = false;
	_currentID = 1;
	_sessionId = 0;//for verify if the response belongs to the same session,dont change it after inited
	_checkerTimer;
	_sender;
	defaultRequestTimeout;
	defaultResponseTimeout;
	outReqList = new Map();//sessionId_id => out Request
	inReqList = new Map();//sessionId_id => in Request
	_checkerTimer;
	onRequest(inReq) { throw new Error('This method must be overwritten'); }//overwrite this
	constructor(opt = {}) {
		this.defaultRequestTimeout = opt.defaultRequestTimeout || 15000;
		this.defaultResponseTimeout = opt.defaultResponseTimeout || 15000;
		this._sessionId = opt.sessionId || RPC.generateRandom();
		this.debug = opt.debug ?? false;
	}
	//sender side
	/**
	 * @description generate id (exclude 0)
	 * @returns {number}  
	 */
	_generateId() {
		if (this.outReqList.size === 0xFFFFFFFF) return false;//no id can be used
		while (this.outReqList.has(`${this._sessionId}_${this._currentID}`)) {//find available id
			this._currentID++;
			if (this._currentID === 0xFFFFFFFF) this._currentID = 1;
		}
		return this._currentID;
	}

	/**
	 * @description buffer handle
	 * @param {ArrayBuffer} data	data from remote rpc sender
	 * @param {*} source define a source, which will be attached to request object
	 */
	handle(data, source) {
		let Message_msg = new Message(data);
		if (Message_msg.isRequest === true) {//it's a request
			this._requestHandle(Message_msg, source);
		} else {//it's a response
			this._responseHandle(Message_msg, source);
		}
	}
	/**
	 * @description send request
	 * @async
	 * @param {*} data
	 * @param {object} [opt]
	 * @param {number} [opt.timeout] timeout for this request
	 * @param {boolean} [opt.noResponse] let remote know dont respond this request
	 * @param {function(Request)} [getRequest] a function for getting the request instance
	 * @returns {*}  request result
	 */
	async request(data, opt, getRequest) {
		if (typeof opt !== 'object') opt = {};
		let id = 0, request, rand;
		if (opt.noResponse !== true) {
			if ((id = this._generateId()) === false) throw (new Error('No free id'));
		}
		if (id !== 0) {
			rand = RPC.generateRandom();
		}
		let buffer = Message.pack(this._sessionId, true, data, id, rand);

		return new Promise((ok, fail) => {
			if (id !== 0) {
				request = new Request(this, id, (err, res) => {
					if (err) {
						if (this.debug) {
							console.debug('RPC receive error:', 'req:', data, 'res:', err);
						}
						fail(err);
						return;
					}
					ok(res);
				}, rand);
				this.outReqList.set(`${this._sessionId}_${id}`, request);
				request.setTimeout(opt.timeout || this.defaultRequestTimeout);
				if (getRequest) getRequest(request);
			}
			this._send(buffer).then(err => {
				if (err) {
					if (this.debug) {
						console.debug('RPC send error', 'req:', data, 'err:', err);
					}
					fail(err);
				}
			});
		});
	}
	/**
	 * @description	send control message
	 * @async
	 * @param {number} name
	 * @param {*} data
	 * @returns {*} control response
	 */
	control(name, data) {
		let msg = new ControlMsg(name, data);
		return this.request(msg);
	}
	/**
	 * @description delete the req instance from map
	 * @param {Request|InRequest} req
	 */
	delete(req) {
		if (req instanceof Request) {
			const id = `${this._sessionId}_${req.id}`;
			if (this.outReqList.get(id) === req)
				this.outReqList.delete(id);
			else { throw (new Error('Deleting unknown req')) }
			req._destructor();
		} else if (req instanceof InRequest) {
			const id = `${req.msg.sessionId}_${req.msg.id}`;
			if (this.inReqList.get(id) === req)
				this.inReqList.delete(id);
			else { throw (new Error('Deleting unknown inReq')) }
			req._destructor();
		} else {
			if (this.debug) console.error('arg: ', req);
			throw (new Error('Wrong type'));
		}
	}
	/**
	 * @description	set sender of data.
	 * @description	sync sender : return send Error;
	 * @description	async sender : resolve to send Error;
	 * @param {function} func
	 */
	setSender(func) {
		if (typeof func !== 'function')
			throw (new TypeError('not a function'));
		/* 
			sync sender:return send Error
		*/
		this._sender = func;
	}
	/**
	 * @description	send buffer by sender function
	 * @param {ArrayBuffer} buf
	 * @returns {Promise<Error>}  
	 */
	async _send(buf) {
		if (this._sender) {
			// if ((await this._sender(buf)) instanceof Error === false) return;
			return await this._sender(buf);//retry
		}
		throw (new Error('sender not defined'));
	}
	//receviver side
	/**
	 * @description	make a message to respond the request
	 * @param {InRequest} InRequest_req
	 * @param {*} data
	 */
	_respond(InRequest_req, data) {
		let msg = InRequest_req.msg;
		if (this.inReqList.get(`${msg.sessionId}_${msg.id}`) !== InRequest_req) {
			if (this.debug) console.debug('Missing id');
			//ignore ids that not exist
			return;
		}
		if (msg.hasID) {//only messages have id should be responded
			let Buffer_buf = Message.pack(InRequest_req.msg.sessionId, false, data, msg.id, msg.random);
			this._send(Buffer_buf);
		}
		//remove saved inReq
		this.delete(InRequest_req);
	}
	/**
	 * @description	handle control operation
	 * @param {*} code received control code
	 * @param {*} data received control data
	 * @param {*} source define a source, which will be attached to request object
	 */
	async _controlHandle(Message_msg, source) {
		const ctrlCode = Message_msg.type;
		const data = Message_msg.data();
		switch (ctrlCode) {
			case ControlMsg.codes.abort: {//cancel an operation
				let InRequest_req = this.inReqList.get(`${Message_msg.sessionId}_${data}`);//data: id
				if (!InRequest_req)
					return;//ignore
				InRequest_req._abortMsg('remote abort');
				this.delete(InRequest_req);
				break;
			}
			default: {
				if (this.debug) console.debug('Unknown control code:' + ctrlCode);
			}
		}
	}
	/**
	 * @description	handle received request
	 * @param {Message} Message_msg
	 * @param {*} source define a source, which will be attached to request object
	 */
	async _requestHandle(Message_msg, source) {
		const sid_id = `${Message_msg.sessionId}_${Message_msg.id}`;
		if (this.inReqList.has(sid_id)) {
			this._respond(Message_msg, RPC.Error(4104));//Duplicate id
			return;
		}
		let InRequest_req = new InRequest(Message_msg, this, source);//create a response for the request
		if (Message_msg.id) {
			InRequest_req.setTimeout(this.defaultResponseTimeout);
			this.inReqList.set(sid_id, InRequest_req);
		}
		try {
			let result;
			if (Message_msg.isCtrl === true) {//it's a control pack
				result = await this._controlHandle(Message_msg, source);
			} else {
				result = await this.onRequest(InRequest_req);
			}
			if (InRequest_req.msg && InRequest_req.msg.id && (this.inReqList.get(sid_id) === InRequest_req)) {
				this._respond(InRequest_req, result);
			}
		} catch (err) {
			this._respond(InRequest_req, err);
		}
	}
	/**
	 * @description	handle received response
	 * @param {Message} Message_msg
	 * @param {*} source define a source, which will be attached to request object
	 */
	_responseHandle(Message_msg, source) {
		let Request_req = this.outReqList.get(`${Message_msg.sessionId}_${Message_msg.id}`);
		if (!Request_req) {
			if (this.debug) console.debug('no req for id:' + Message_msg.id);
			return;
		}
		if (Request_req.random !== Message_msg.random)
			return;//ignore wrong response
		if (Message_msg.isError) {
			Request_req.callback(Message_msg.data());
		} else {
			Request_req.callback(null, Message_msg.data());
		}
		this.delete(Request_req);
	}
	/**
	 * @description	generate a random number
	 * @static
	 * @returns {number}  
	 */
	static generateRandom() {
		return Math.round(0xffffffff * Math.random());
	}
	/**
	 *destroy this instance and directly return error for all requests
	 */
	destroy() {
		for (let [sid_id, request] of this.outReqList) {
			request.callback(new Error('connection destroyed'));
		}
		for (let [sid_id, InRequest_req] of this.inReqList) {
			InRequest_req._abortMsg('connection destroyed');
		}
		this.outReqList.clear();
		this.inReqList.clear();
	}
}

/* 
The following classes have been merged from another separate package and introduce some breaking changes. Here's a list:
*   RemoteCallback's `send` is removed, its functionality now resides in `RPC.request`.
*   RemoteCallback's `handleRPC` is removed, its functionality now resides in `RPC.handle`.
*   RemoteCallback's `setRPCSender` is removed, its functionality now resides in `RPC.setSender`.
*   RemoteCallback's `request` has been renamed to `remoteCall`.
*/
/**
 * RemoteCallback is used to call remote methods and obtain results in a fixed data format.
 * @class RemoteCallback
 * @extends {RPC}
 */
class RemoteCallback extends RPC {
	opts = {};
	handleArguments = (msg, inReq) => [msg.arg, inReq]; // Defines the arguments passed to handle; defaults to the message argument and request object.
	get rpcSender() { return this._sender; };
	constructor(opt) {
		super(opt);
	}
	async onRequest(inReq) {
		try {
			return await this._handleRequest(inReq);//pass an InRequest object for abort checking 
		} catch (err) {
			if (typeof err == 'string') {
				throw (RPC.Error(4100, err));
			} else if (err instanceof Error) {
				if (this.debug) console.error(err);
				throw (RPC.Error(4100, 'handle error'));
			} else {
				throw (new TypeError('invalid error type:' + typeof err));
			}
		}
	}
	/**
	 * @description	处理请求
	 * @param {InRequest} inReq
	 */
	async _handleRequest(inReq) {
		let msg = inReq.data();
		if (typeof msg !== 'object' || msg === null) {
			if (this.debug) console.error('invalid request', inReq);
			throw ('invalid message type');
		}
		if ('_' in msg === false) {
			throw ('No opt found');
		}
		let handle = this.opts[msg._];
		if (handle) {
			let result = await handle(...this.handleArguments(msg, inReq));
			inReq.responded = true;//mark as responded
			return result;
		} else {
			throw (`unknown handle type '${msg._}'`);
		}
	}
	/**
	 * @description Sends an RPC request to the remote end.
	 * @param {string} opt Operation name.
	 * @param {*} arg Arguments to send with the request.
	 * @param {function(Error,any)} callback The remote response will be passed directly to this function. If not defined, the function returns a Promise providing the result.
	 * @param {object} [rpcOpt] Option for `this.rpc.request`.
	 * @returns {undefined|Promise<*>} This Promise returns the request result data.
	 */
	remoteCall(opt, arg, rpcOpt) {
		return super.request({ _: opt, arg }, rpcOpt);
	}
	/**
	 * @description Registers the operation handling function for this side.
	 * @param {string} opt
	 * @param {function(arg,InRequest)} func  (request parameter, InRequest object)
	 */
	register(opt, func) {
		if (typeof opt !== 'string') {
			throw (new TypeError('name should be a string'));
		}
		if (typeof func !== 'function') {
			throw (new TypeError('fun should be a function'));
		}
		if (opt in this.opts) {
			throw (new Error(`operation ${opt} already been registered`));
		}
		this.opts[opt] = func;
	}
	/**
	 * @description	Remove the specified operation handler
	 * @param {string} opt
	 */
	deregister(opt) {
		delete this.opts[opt];
	}
	destroy() {
		super.destroy();
		this.opts = null;
	}
	request() {
		throw (new Error('This method is disabled on sub class, use "remoteCall" instead.'));
	}
	handleRPC() {
		throw (new Error('This method is removed, use "remoteCall" handle.'));
	}
	setRPCSender() {
		throw (new Error('This method is removed, use "setSender" handle.'));
	}
}

module.exports = {
	RPC,
	RemoteCallback,
};
