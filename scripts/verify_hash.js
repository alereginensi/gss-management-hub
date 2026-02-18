const bcrypt = require('bcryptjs');

const hash = '$2b$10$ms9LTCqoDe5zRtwxnMZZ1.ZlQKcOdjBeZD.scyLnG0vkOpnt/ouAq';
const password = 'admin123';

bcrypt.compare(password, hash).then(res => {
    console.log(`Password '${password}' matches hash: ${res}`);
});
