# js-obj-rpc

RPC for javascript .

## Get it
```
npm i js-obj-rpc
```

## In Node.js
Directly require the pack. 
```javascript
var RPC=require('js-obj-rpc');
```

## In browser
```
npm i --dev
npm run build
```
then use the script in the `dist` directory
```html
<script src="***/dist/rpc.js"></script>

<script>
var rpc=new RPC();
</script>
```

## Usage

see `test/`

## Classes

------

# Class : RPC

## events
* 'request'  (message,callback): emits when receive a request,the first argument is the `Request` instance.
* 'dataToSend' (buffer): emits buffer data for sending to the other rpc side.

## methods

### handle(data)

handle binary data sent by remote

* data : Buffer

### request(data,callback,opt)

send a request

* data : one of the following data.
    * ArrayBuffer or any view of ArrayBuffer
    * anything that can be serialized to JSON
* callback(err,data) : the function for receiving result returned from remote 
        *Note: All binary data sent to remote will be received as an `Buffer`*
* opt : an object contains following value
    * timeout : set the timeout for the request,defaults to 15000ms.

returns `Response` instance

### control(name,data)

send a control message

* name : see `ControlMsg.codes`

### delete(req)

delete a `Request` or an `inRequest` in the RPC's map

* req : `Request` or `inRequest` instance.

------

# Class : Request

## methods

### abort()

If the request haven't been responded,this method can cancel the operation.
An control message will be sent to remote and the `inRequest` instance will emit an `abort` event.

### setTimeout(ms)

Set the timeout of the request, will be automatically invoked when sending a request.

When timeout reaches, the request will be aborted.

------

# Class : InRequest extends events

## events
* 'abort' : emits when method `abort` being invoked

## methods
### data()

Get data sent by remote.

### setTimeout(ms)
* ms : time. Defaults to `15000`.

Set timeout for the inRequest. When timeout reaches, an Error message will text `time out`.

## properties
* msg : a instance of `Message`
* `getter` id : id of the message

------

# Class : Message

## methods

### data()

Get data from the message.

## properties

* id : id of the message
* payload : raw buffer of data
