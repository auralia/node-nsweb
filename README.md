# nsweb #

[![npm version](https://badge.fury.io/js/nsweb.svg)](https://badge.fury.io/js/nsweb)

nsweb is a free and open source library that allows Node.js applications to 
easily access some parts of NationStates not exposed through the standard API
without worrying about making HTTP requests or rate limiting.

nsweb features the following:

* the ability to programmatically log into or restore nations
* rate-limiting to respect NationStates site rules

## Usage ##

You can install nsweb using npm: `npm install nsweb`.

You can also build nsweb from source using Gulp. There are two main targets: 
`prod` and `dev`. The only difference between them is that `dev` includes
source maps. There is also a `docs` target to generate documentation.

Consult [the documentation](https://auralia.github.io/node-nsweb/) for more 
information on API structure and methods.

nsweb targets ES5 but requires support for ES6 promises, so if you're not 
using a runtime that supports them natively, you'll have to use a polyfill.

## Examples ##

The following is a simple example that logs into a nation:

```js
var nsweb = require("nsweb");

// TODO: Replace the user agent with your own
var web = new nsweb.NsWeb("Your nation's name");
// TODO: Replace nation name and password with your own
web.loginRequest("Your nation's name", "Your nation's password")
   .then(function() {
       console.log("Login succeeded");
   })
   .catch(function(err) {
       console.error("Login failed");
       console.error(err);
   })
   .then(function() {
       web.cleanup();
   });
```

For additional examples, consult the examples/example.js file.

## License ##

nsweb is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
