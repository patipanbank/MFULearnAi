const { generateKeyPairSync } = require('crypto');
const fs = require('fs');


const path = require('path');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
    },
    privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
    },
});

fs.writeFileSync(path.join(__dirname, 'jwt-private.pem'), privateKey);
fs.writeFileSync(path.join(__dirname, 'jwt-public.pem'), publicKey);

console.log(`✅ JWT RSA key pair generated in ${__dirname}`);
