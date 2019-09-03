# js-rpc

RPC for javascript (better with) websocket.

## Get it
```
npm i js-obj-rpc
```

## In Node.js
Directly require the pack.
```javascript
var rpc=require('js-obj-rpc');
```

## In browser
```
npm i --dev
npm run build
```
then use the script in the dist directory
```html
<script src="***/dist/rpc.js"></script>

<script>
var rpc=new RPC();
</script>
```

## Usage

see `demo/`

## Classes

------

# Class : RPC

## events
* 'request' : emits when receive a request,the first argument is the `Request` instance
* 'error' : emits when error occurs

## methods

### handle(data)

handle binary data made by `Pakcer` sent by remote

* data : Buffer or Arraybuffer

### request(data,callback,opt)

send a request

* data : one of the following data.
    * true
    * false
    * undefined
    * null
    * ArrayBuffer
    * any view of ArrayBuffer
    * anything that can be serialized to json
* callback : the function for receiving result returned from remote 
        *Note: All binary data sent to remote will be received as an `Uint8Array`*
* opt : an object contains following value
    * requireResponse : boolean. Set if the request require a response from server. Defaults to true.
    * timeout : set the timeout for the request,defaults to 30000 ms

returns `Response` instance

------

# Class : Request

## methods

### delete()

If the request haven't been responded,this method can cancel the operation.
It will automatically be invoked when the response arrives

### setTimeout(ms)

set the timeout of the request,will be automatically invoked when sending a request

------

# Class : Response

## events
* 'abort' : emits when method `abort` being invoked

## methods
### abort()

emit an 'abort' event on this object,whether it causes any operation or not depends on you.

### send(data)
* data : same as `RPC:request`'s data

send the response

## properties
* rpc : the RPC `instance`
* pack : the `Pack` instance

------

# Class : Pack

## methods

### getData()

Get data from the pack.

## properties

* buffer : original buffer
* head : pack head data
* dataType : see index.js
* data : a getter invokes `getData()`
