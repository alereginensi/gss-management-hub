const bcrypt = require('bcryptjs');

async function testHash() {
    const hash = '$2b$10$ms9LTCqoDe5zRtwxnMZZ1.ZlQKcOdjBeZD.scyLnG0vkOpnt/ouAq';
    const password = 'admin123';
    const isValid = await bcrypt.compare(password, hash);
    console.log("Hash compatibility test result:", isValid);
}

testHash();
