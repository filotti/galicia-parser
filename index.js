var fs = require('fs');
var path = require('path');
var querystring = require('querystring');
var request = require('request');
require('datejs');

var getCSVIntervalRef;
var baseUrl = 'https://wsec06.bancogalicia.com.ar';
var devicePrintAdaptive = 'version%3D3%2E4%2E0%2E0%5F1%26pm%5Ffpua%3Dmozilla%2F5%2E0%20%28windows%20nt%2010%2E0%3B%20wow64%29%20app' +
    'lewebkit%2F537%2E36%20%28khtml%2C%20like%20gecko%29%20chrome%2F50%2E0%2E2661%2E94%20safari%2F537%2E36%' +
    '7C5%2E0%20%28Windows%20NT%2010%2E0%3B%20WOW64%29%20AppleWebKit%2F537%2E36%20%28KHTML%2C%20like%20Gecko' +
    '%29%20Chrome%2F50%2E0%2E2661%2E94%20Safari%2F537%2E36%7CWin32%26pm%5Ffpsc%3D24%7C1920%7C1080%7C1040%26' +
    'pm%5Ffpsw%3D%26pm%5Ffptz%3D%2D3%26pm%5Ffpln%3Dlang%3Den%2DUS%7Csyslang%3D%7Cuserlang%3D%26pm%5Ffpjv%3D' +
    '0%26pm%5Ffpco%3D1%26pm%5Ffpasw%3Dwidevinecdmadapter%7Cmhjfbmdgcfjbbpaeojofohoefgiehjai%7Cpepflashplaye' +
    'r%7Cinternal%2Dnacl%2Dplugin%7Cinternal%2Dpdf%2Dviewer%26pm%5Ffpan%3DNetscape%26pm%5Ffpacn%3DMozilla%2' +
    '6pm%5Ffpol%3Dtrue%26pm%5Ffposp%3D%26pm%5Ffpup%3D%26pm%5Ffpsaw%3D1920%26pm%5Ffpspd%3D24%26pm%5Ffpsbd%3D' +
    '%26pm%5Ffpsdx%3D%26pm%5Ffpsdy%3D%26pm%5Ffpslx%3D%26pm%5Ffpsly%3D%26pm%5Ffpsfse%3D%26pm%5Ffpsui%3D%26pm' +
    '%5Fos%3DWindows%26pm%5Fbrmjv%3D50%26pm%5Fbr%3DChrome%26pm%5Finpt%3D%26pm%5Fexpt%3D';
var biRadixBase = 2;
var biRadixBits = 16;
var bitsPerDigit = biRadixBits;
var biRadix = 1 << 16; // = 2^16 = 65536
var biHalfRadix = biRadix >>> 1;
var biRadixSquared = biRadix * biRadix;
var maxDigitVal = biRadix - 1;
var maxInteger = 9999999999999998;
var maxDigits;
var ZERO_ARRAY;
var bigZero, bigOne;
var highBitMasks = new Array(0x0000, 0x8000, 0xC000, 0xE000, 0xF000, 0xF800,
    0xFC00, 0xFE00, 0xFF00, 0xFF80, 0xFFC0, 0xFFE0,
    0xFFF0, 0xFFF8, 0xFFFC, 0xFFFE, 0xFFFF);
var lowBitMasks = new Array(0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F,
    0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF,
    0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF);
var hexToChar = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'a', 'b', 'c', 'd', 'e', 'f');
var retries = 0;
var maxRetries = 5;

request = request.defaults({
    jar: true,
    followAllRedirects: true,
    ca: fs.readFileSync(path.resolve(__dirname, 'cacert.crt')),
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
});

module.exports = {
    start: function (options, callback) {
        module.options = options;
        module.callback = callback;
        getCSVIntervalRef = setInterval(loginOfficeBanking, module.options.getCSVIntervalMinutes * 60 * 1000);
        loginOfficeBanking();
    }
}

var loginOfficeBanking = function () {
    lg("Logging in to Galicia Office Banking");
    request(baseUrl, function (error, response, body) {
        var formData = {
            __RequestVerificationToken: getRequestVerificationToken(body),
            EncriptedPassword: getEncriptedPassword(body, module.options.password),
            UserID: module.options.username,
            Password: '',
            DevicePrintAdaptive: devicePrintAdaptive,
            isDebugEnabled: 'false'
        };
        var loginRequestOptions = {
            url: baseUrl + '/Users/LogIn',
            body: querystring.stringify(formData)
        };
        request.post(loginRequestOptions, function callBack(err, response, body) {
            lg("Login step 1");
            request.post(baseUrl + '/Balance/ConsultaDeSaldos', function callBack(err, response, body) {
                lg("Login step 2");
                request(baseUrl + '/Balance/Concentradora2/0', function callBack(err, response, body) {
                    lg("Login step 3");
                    getCSV();
                });
            });
        });
    });
}

var getCSV = function () {
    var ExportarExtractoCSVViejoOptions = {
        url: baseUrl + '/Balance/ExportarExtractoCSVViejo',
        body: "fechaDesde=&fechaHasta=&indiceCuenta=0&fechaDesde=&fechaHasta=&bifurcacionCA=False"
    };
    request.post(ExportarExtractoCSVViejoOptions, function callBack(err, response, body) {
        var error = null;
	    lg(body);
        if (body.indexOf("SALDO AL INICIO") === -1) {
            if (retries < maxRetries) {
                retries++;
                lg("Error getting CSV, retrying login");
                loginOfficeBanking();
            } else {
                error = "Couldn't get CSV after " + maxRetries + " retries";
                module.callback(error, body);
            }
        } else {
            lg("Got CSV");
            retries = 0;
            module.callback(error,body);
        }
    });
}

var getRequestVerificationToken = function (body) {
    var indexOfVerificationToken = body.lastIndexOf('<input name="__RequestVerificationToken" type="hidden" value="') + 62;
    var body1 = body.substring(indexOfVerificationToken);
    return body1.substring(0, body1.indexOf('"'));
}

var getEncriptedPassword = function (body, password) {
    setMaxDigits(131);
    var base64password = new Buffer(password).toString('base64');
    var indexOfSalt = body.lastIndexOf("var enc = encryptedString(key, '") + 32;
    var body1 = body.substring(indexOfSalt);
    var salt = body1.substring(0, body1.indexOf("'"));
    var indexOfModulus = body.lastIndexOf('key = new RSAKeyPair') + 36;
    var body2 = body.substring(indexOfModulus);
    var modulus = body2.substring(0, body2.indexOf('"'));
    var key = new RSAKeyPair("010001", "", modulus);
    return encryptedString(key, salt + '\\' + base64password);
}

var lg = function (message) {
    var timestamp = new Date().toString('yyyy-MM-dd HH:mm:ss');
    console.log(timestamp + " - " + message);
}

var hexToDigit = function (s) {
    var result = 0;
    var sl = Math.min(s.length, 4);
    for (var i = 0; i < sl; ++i) {
        result <<= 4;
        result |= charToHex(s.charCodeAt(i))
    }
    return result;
}

var charToHex = function (c) {
    var ZERO = 48;
    var NINE = ZERO + 9;
    var littleA = 97;
    var littleZ = littleA + 25;
    var bigA = 65;
    var bigZ = 65 + 25;
    var result;

    if (c >= ZERO && c <= NINE) {
        result = c - ZERO;
    } else if (c >= bigA && c <= bigZ) {
        result = 10 + c - bigA;
    } else if (c >= littleA && c <= littleZ) {
        result = 10 + c - littleA;
    } else {
        result = 0;
    }
    return result;
}

var biFromHex = function (s) {
    var result = new BigInt();
    var sl = s.length;
    for (var i = sl, j = 0; i > 0; i -= 4, ++j) {
        result.digits[j] = hexToDigit(s.substr(Math.max(i - 4, 0), Math.min(i, 4)));
    }
    return result;
}

var RSAKeyPair = function (encryptionExponent, decryptionExponent, modulus) {
    this.e = biFromHex(encryptionExponent);
    this.d = biFromHex(decryptionExponent);
    this.m = biFromHex(modulus);
    this.digitSize = 2 * biHighIndex(this.m) + 2;
    this.chunkSize = this.digitSize - 11;
    this.radix = 16;
    this.barrett = new BarrettMu(this.m);
}

var BarrettMu = function (m) {
    this.modulus = biCopy(m);
    this.k = biHighIndex(this.modulus) + 1;
    var b2k = new BigInt();
    b2k.digits[2 * this.k] = 1; // b2k = b^(2k)
    this.mu = biDivide(b2k, this.modulus);
    this.bkplus1 = new BigInt();
    this.bkplus1.digits[this.k + 1] = 1; // bkplus1 = b^(k+1)
    this.modulo = BarrettMu_modulo;
    this.multiplyMod = BarrettMu_multiplyMod;
    this.powMod = BarrettMu_powMod;
}

var BarrettMu_modulo = function (x) {
    var q1 = biDivideByRadixPower(x, this.k - 1);
    var q2 = biMultiply(q1, this.mu);
    var q3 = biDivideByRadixPower(q2, this.k + 1);
    var r1 = biModuloByRadixPower(x, this.k + 1);
    var r2term = biMultiply(q3, this.modulus);
    var r2 = biModuloByRadixPower(r2term, this.k + 1);
    var r = biSubtract(r1, r2);
    if (r.isNeg) {
        r = biAdd(r, this.bkplus1);
    }
    var rgtem = biCompare(r, this.modulus) >= 0;
    while (rgtem) {
        r = biSubtract(r, this.modulus);
        rgtem = biCompare(r, this.modulus) >= 0;
    }
    return r;
}

var BarrettMu_multiplyMod = function (x, y) {
    var xy = biMultiply(x, y);
    return this.modulo(xy);
}

var BarrettMu_powMod = function (x, y) {
    var result = new BigInt();
    result.digits[0] = 1;
    var a = x;
    var k = y;
    while (true) {
        if ((k.digits[0] & 1) != 0) result = this.multiplyMod(result, a);
        k = biShiftRight(k, 1);
        if (k.digits[0] == 0 && biHighIndex(k) == 0) break;
        a = this.multiplyMod(a, a);
    }
    return result;
}

var setMaxDigits = function (value) {
    maxDigits = value;
    ZERO_ARRAY = new Array(maxDigits);
    for (var iza = 0; iza < ZERO_ARRAY.length; iza++) ZERO_ARRAY[iza] = 0;
    bigZero = new BigInt();
    bigOne = new BigInt();
    bigOne.digits[0] = 1;
}

var BigInt = function (flag) {
    if (typeof flag == "boolean" && flag == true) {
        this.digits = null;
    }
    else {
        this.digits = ZERO_ARRAY.slice(0);
    }
    this.isNeg = false;
}

var biHighIndex = function (x) {
    var result = x.digits.length - 1;
    while (result > 0 && x.digits[result] == 0) --result;
    return result;
}

var biCopy = function (bi) {
    var result = new BigInt(true);
    result.digits = bi.digits.slice(0);
    result.isNeg = bi.isNeg;
    return result;
}

var biDivide = function (x, y) {
    return biDivideModulo(x, y)[0];
}

var biDivideModulo = function (x, y) {
    var nb = biNumBits(x);
    var tb = biNumBits(y);
    var origYIsNeg = y.isNeg;
    var q, r;
    if (nb < tb) {
        if (x.isNeg) {
            q = biCopy(bigOne);
            q.isNeg = !y.isNeg;
            x.isNeg = false;
            y.isNeg = false;
            r = biSubtract(y, x);
            x.isNeg = true;
            y.isNeg = origYIsNeg;
        } else {
            q = new BigInt();
            r = biCopy(x);
        }
        return new Array(q, r);
    }

    q = new BigInt();
    r = x;

    var t = Math.ceil(tb / bitsPerDigit) - 1;
    var lambda = 0;
    while (y.digits[t] < biHalfRadix) {
        y = biShiftLeft(y, 1);
        ++lambda;
        ++tb;
        t = Math.ceil(tb / bitsPerDigit) - 1;
    }
    r = biShiftLeft(r, lambda);
    nb += lambda; // Update the bit count for x.
    var n = Math.ceil(nb / bitsPerDigit) - 1;

    var b = biMultiplyByRadixPower(y, n - t);
    while (biCompare(r, b) != -1) {
        ++q.digits[n - t];
        r = biSubtract(r, b);
    }
    for (var i = n; i > t; --i) {
        var ri = (i >= r.digits.length) ? 0 : r.digits[i];
        var ri1 = (i - 1 >= r.digits.length) ? 0 : r.digits[i - 1];
        var ri2 = (i - 2 >= r.digits.length) ? 0 : r.digits[i - 2];
        var yt = (t >= y.digits.length) ? 0 : y.digits[t];
        var yt1 = (t - 1 >= y.digits.length) ? 0 : y.digits[t - 1];
        if (ri == yt) {
            q.digits[i - t - 1] = maxDigitVal;
        } else {
            q.digits[i - t - 1] = Math.floor((ri * biRadix + ri1) / yt);
        }

        var c1 = q.digits[i - t - 1] * ((yt * biRadix) + yt1);
        var c2 = (ri * biRadixSquared) + ((ri1 * biRadix) + ri2);
        while (c1 > c2) {
            --q.digits[i - t - 1];
            c1 = q.digits[i - t - 1] * ((yt * biRadix) | yt1);
            c2 = (ri * biRadix * biRadix) + ((ri1 * biRadix) + ri2);
        }

        b = biMultiplyByRadixPower(y, i - t - 1);
        r = biSubtract(r, biMultiplyDigit(b, q.digits[i - t - 1]));
        if (r.isNeg) {
            r = biAdd(r, b);
            --q.digits[i - t - 1];
        }
    }
    r = biShiftRight(r, lambda);
    q.isNeg = x.isNeg != origYIsNeg;
    if (x.isNeg) {
        if (origYIsNeg) {
            q = biAdd(q, bigOne);
        } else {
            q = biSubtract(q, bigOne);
        }
        y = biShiftRight(y, lambda);
        r = biSubtract(y, r);
    }
    if (r.digits[0] == 0 && biHighIndex(r) == 0) r.isNeg = false;

    return new Array(q, r);
}

var biNumBits = function (x) {
    var n = biHighIndex(x);
    var d = x.digits[n];
    var m = (n + 1) * bitsPerDigit;
    var result;
    for (result = m; result > m - bitsPerDigit; --result) {
        if ((d & 0x8000) != 0) break;
        d <<= 1;
    }
    return result;
}

var biMultiplyByRadixPower = function (x, n) {
    var result = new BigInt();
    arrayCopy(x.digits, 0, result.digits, n, result.digits.length - n);
    return result;
}

var biShiftLeft = function (x, n) {
    var digitCount = Math.floor(n / bitsPerDigit);
    var result = new BigInt();
    arrayCopy(x.digits, 0, result.digits, digitCount,
        result.digits.length - digitCount);
    var bits = n % bitsPerDigit;
    var rightBits = bitsPerDigit - bits;
    for (var i = result.digits.length - 1, i1 = i - 1; i > 0; --i, --i1) {
        result.digits[i] = ((result.digits[i] << bits) & maxDigitVal) |
            ((result.digits[i1] & highBitMasks[bits]) >>>
            (rightBits));
    }
    result.digits[0] = ((result.digits[i] << bits) & maxDigitVal);
    result.isNeg = x.isNeg;
    return result;
}

var arrayCopy = function (src, srcStart, dest, destStart, n) {
    var m = Math.min(srcStart + n, src.length);
    for (var i = srcStart, j = destStart; i < m; ++i, ++j) {
        dest[j] = src[i];
    }
}

var biCompare = function (x, y) {
    if (x.isNeg != y.isNeg) {
        return 1 - 2 * Number(x.isNeg);
    }
    for (var i = x.digits.length - 1; i >= 0; --i) {
        if (x.digits[i] != y.digits[i]) {
            if (x.isNeg) {
                return 1 - 2 * Number(x.digits[i] > y.digits[i]);
            } else {
                return 1 - 2 * Number(x.digits[i] < y.digits[i]);
            }
        }
    }
    return 0;
}

var biMultiplyDigit = function (x, y) {
    var n, c, uv;

    result = new BigInt();
    n = biHighIndex(x);
    c = 0;
    for (var j = 0; j <= n; ++j) {
        uv = result.digits[j] + x.digits[j] * y + c;
        result.digits[j] = uv & maxDigitVal;
        c = uv >>> biRadixBits;
        //c = Math.floor(uv / biRadix);
    }
    result.digits[1 + n] = c;
    return result;
}

var biSubtract = function (x, y) {
    var result;
    if (x.isNeg != y.isNeg) {
        y.isNeg = !y.isNeg;
        result = biAdd(x, y);
        y.isNeg = !y.isNeg;
    } else {
        result = new BigInt();
        var n, c;
        c = 0;
        for (var i = 0; i < x.digits.length; ++i) {
            n = x.digits[i] - y.digits[i] + c;
            result.digits[i] = n % biRadix;
            if (result.digits[i] < 0) result.digits[i] += biRadix;
            c = 0 - Number(n < 0);
        }
        // Fix up the negative sign, if any.
        if (c == -1) {
            c = 0;
            for (i = 0; i < x.digits.length; ++i) {
                n = 0 - result.digits[i] + c;
                result.digits[i] = n % biRadix;
                // Stupid non-conforming modulus operation.
                if (result.digits[i] < 0) result.digits[i] += biRadix;
                c = 0 - Number(n < 0);
            }
            result.isNeg = !x.isNeg;
        } else {
            result.isNeg = x.isNeg;
        }
    }
    return result;
}

var biAdd = function (x, y) {
    var result;

    if (x.isNeg != y.isNeg) {
        y.isNeg = !y.isNeg;
        result = biSubtract(x, y);
        y.isNeg = !y.isNeg;
    }
    else {
        result = new BigInt();
        var c = 0;
        var n;
        for (var i = 0; i < x.digits.length; ++i) {
            n = x.digits[i] + y.digits[i] + c;
            result.digits[i] = n % biRadix;
            c = Number(n >= biRadix);
        }
        result.isNeg = x.isNeg;
    }
    return result;
}

var biShiftRight = function (x, n) {
    var digitCount = Math.floor(n / bitsPerDigit);
    var result = new BigInt();
    arrayCopy(x.digits, digitCount, result.digits, 0,
        x.digits.length - digitCount);
    var bits = n % bitsPerDigit;
    var leftBits = bitsPerDigit - bits;
    for (var i = 0, i1 = i + 1; i < result.digits.length - 1; ++i, ++i1) {
        result.digits[i] = (result.digits[i] >>> bits) |
            ((result.digits[i1] & lowBitMasks[bits]) << leftBits);
    }
    result.digits[result.digits.length - 1] >>>= bits;
    result.isNeg = x.isNeg;
    return result;
}

var biMultiply = function (x, y) {
    var result = new BigInt();
    var c;
    var n = biHighIndex(x);
    var t = biHighIndex(y);
    var u, uv, k;

    for (var i = 0; i <= t; ++i) {
        c = 0;
        k = i;
        for (j = 0; j <= n; ++j, ++k) {
            uv = result.digits[k] + x.digits[j] * y.digits[i] + c;
            result.digits[k] = uv & maxDigitVal;
            c = uv >>> biRadixBits;
        }
        result.digits[i + n + 1] = c;
    }
    result.isNeg = x.isNeg != y.isNeg;
    return result;
}

var biDivideByRadixPower = function (x, n) {
    var result = new BigInt();
    arrayCopy(x.digits, n, result.digits, 0, result.digits.length - n);
    return result;
}

var biModuloByRadixPower = function (x, n) {
    var result = new BigInt();
    arrayCopy(x.digits, 0, result.digits, 0, n);
    return result;
}

var biToHex = function (x) {
    var result = "";
    var n = biHighIndex(x);
    for (var i = biHighIndex(x); i > -1; --i) {
        result += digitToHex(x.digits[i]);
    }
    return result;
}

var digitToHex = function (n) {
    var mask = 0xf;
    var result = "";
    for (i = 0; i < 4; ++i) {
        result += hexToChar[n & mask];
        n >>>= 4;
    }
    return reverseStr(result);
}

var reverseStr = function (s) {
    var result = "";
    for (var i = s.length - 1; i > -1; --i) {
        result += s.charAt(i);
    }
    return result;
}

var encryptedString = function (key, s)
{
    if (key.chunkSize > key.digitSize - 11) {
        return "Error";
    }

    var a = new Array();
    var sl = s.length;

    var i = 0;
    while (i < sl) {
        a[i] = s.charCodeAt(i);
        i++;
    }

    var al = a.length;
    var result = "";
    var j, k, block;
    for (i = 0; i < al; i += key.chunkSize) {
        block = new BigInt();
        j = 0;

        var x;
        var msgLength = (i + key.chunkSize) > al ? al % key.chunkSize : key.chunkSize;

        var b = new Array();
        for (x = 0; x < msgLength; x++) {
            b[x] = a[i + msgLength - 1 - x];
        }
        b[msgLength] = 0; // marker
        var paddedSize = Math.max(8, key.digitSize - 3 - msgLength);

        for (x = 0; x < paddedSize; x++) {
            b[msgLength + 1 + x] = Math.floor(Math.random() * 254) + 1; // [1,255]
        }
        b[key.digitSize - 2] = 2; // marker
        b[key.digitSize - 1] = 0; // marker

        for (k = 0; k < key.digitSize; ++j) {
            block.digits[j] = b[k++];
            block.digits[j] += b[k++] << 8;
        }

        var crypt = key.barrett.powMod(block, key.e);
        var text = key.radix == 16 ? biToHex(crypt) : biToString(crypt, key.radix);
        result += text + " ";
    }
    return result.substring(0, result.length - 1); // Remove last space.
}
