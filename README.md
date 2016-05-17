galicia-parser -- A node.js module to download transactions from Galicia Home Banking
=====================================================================================

This node.js module will allow you to login to Galicia Office Banking and download them in CSV format, then post them to an URL of your choice.

## HOW TO USE

```sh
var galiciaParser = require('galicia-parser');

var galiciaParserOptions = {
    getCSVInterval: 10, //get CSV every 10 minutes (more than 20 minutes will need to login for every request)
    username: 'MyGaliciaOfficeUsernameReadOnly', // Office banking username
    password: 'MyGaliciaOfficePassword', // Office banking password
    urlToSend: 'http://myerpserver.com/upload_galicia_csv' // URL to post the CSV as a file
};

galiciaParser.start(galiciaParserOptions);
```

## FEEDBACK

Please send any feedback to filotti@gmail.com