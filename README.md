galicia-parser -- A node.js module to download a CSV file of your transactions from Galicia Office Banking and post them to an URL of your choice
=================================================================================================================================================

This node.js module will allow you to login to Galicia Office Banking and download them in CSV format, then post them to an URL of your choice.

## HOW TO USE

```sh
var galiciaParser = require('galicia-parser');

var galiciaParserOptions = {
    getCSVInterval: 10, //get CSV every 10 minutes
    username: 'MyGaliciaOfficeUsernameReadOnly', // Office banking username
    password: 'MyGaliciaOfficePassword' // Office banking password
};

var callback = function(err, result) {
    if (err) {
        console.error(err);
    } else {
        // Process the CSV output however you want
    }
};

galiciaParser.start(galiciaParserOptions, callback);
```

## FEEDBACK

Please send any feedback to filotti@gmail.com