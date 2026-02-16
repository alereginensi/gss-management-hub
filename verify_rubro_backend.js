const db = require('better-sqlite3')('tickets.db');

async function verify() {
    console.log('--- Verifying Job Roles Backend ---');

    // 1. Register a user with Rubro via API
    console.log('1. Testing Registration API...');
    const userData = {
        name: 'Test Funcionario',
        email: 'test_rubro_' + Date.now() + '@gss.com',
        password: 'password123',
        confirmPassword: 'password123',
        role: 'funcionario',
        rubro: 'Limpieza',
        department: 'Mantenimiento'
    };

    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        console.log('API Response Status:', response.status);
        console.log('API Response Body:', JSON.stringify(data, null, 2));

        if (response.ok) {
            // 2. Verify in Database
            console.log('\n2. Verifying in Database...');
            const user = db.prepare('SELECT id, name, email, role, rubro FROM users WHERE email = ?').get(userData.email);

            if (user) {
                console.log('User found in DB:', user);
                if (user.rubro === 'Limpieza') {
                    console.log('SUCCESS: Rubro "Limpieza" was correctly saved.');
                } else {
                    console.error('FAILURE: Rubro mismatch. Expected "Limpieza", got "' + user.rubro + '"');
                }
            } else {
                console.error('FAILURE: User not found in database.');
            }
        } else {
            console.error('FAILURE: API registration failed.');
        }

    } catch (error) {
        console.error('Error during verification:', error);
    }
}

verify();
