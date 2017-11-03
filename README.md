#js-rpc

RPC on js (better with)websocket.

## Get it
```
npm i js-rpc
```

## In Node.js
Directly require the pack.
```javascript
var rpc=require('js-rpc');
```

## In browser
```
npm i --dev
gulp build
```
then use the script in the dist directory
```html
<script src="***/dist/rpc.js"></script>

<script>
var rpc=new RPC();
</script>
```