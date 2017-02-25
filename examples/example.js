/**
 * Copyright (C) 2017 Auralia
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var nsweb = require("../lib/web.js");
var util = require("util");

// TODO: Replace the user agent with your own
var web = new nsweb.NsWeb("Your nation's name");

function restoreExample() {
    // TODO: Replace nation name and password with your own
    var nation = "";
    var password = "";

    return web.restoreRequest(nation, password)
              .then(function() {
                  console.log("Restore succeeded");
              })
              .catch(function(err) {
                  console.error("Restore failed");
                  console.error(util.inspect(err));
              });
}

// The following code executes each example.
Promise.resolve()
       .then(function() {
           console.log("\nRestore example:\n");
           return restoreExample();
       })
       .catch(function(err) {
           console.log(err);
       })
       .then(function() {
           web.cleanup();
       });
