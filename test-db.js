try {
    const db = require('./lib/db').default;
    console.log("DB Module loaded successfully");
    const users = db.prepare('SELECT email, role, approved FROM users').all();
    console.log("Current users:", JSON.stringify(users, null, 2));
} catch (e) {
    console.error("CRITICAL ERROR LOADING DB MODULE:", e);
}
