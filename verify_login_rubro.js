const db = require('better-sqlite3')('tickets.db');

async function verifyLogin() {
    console.log('--- Verifying Login API with NEW USER & APPROVAL ---');

    const userData = {
        name: 'Test Funcionario Login 2',
        email: 'test_invlogin_' + Date.now() + '@gss.com',
        password: 'password123',
        confirmPassword: 'password123',
        role: 'funcionario',
        rubro: 'Limpieza',
        department: 'Mantenimiento'
    };

    try {
        // 1. Register
        console.log('1. Registering new user:', userData.email);
        const regRes = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!regRes.ok) {
            console.error('Registration failed');
            return;
        }

        // 2. Approve User Manually
        console.log('2. Approving user in DB...');
        db.prepare('UPDATE users SET approved = 1 WHERE email = ?').run(userData.email);

        // 3. Login
        console.log('3. Testing login for:', userData.email);
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userData.email,
                password: 'password123',
                isAdminLogin: true
            })
        });

        const data = await response.json();
        console.log('Login Status:', response.status);

        if (response.ok) {
            console.log('User Data in Response to Client:', JSON.stringify(data.user, null, 2));
            if (data.user.rubro === 'Limpieza') {
                console.log('SUCCESS: Rubro "Limpieza" is present in login response.');
            } else {
                console.error('FAILURE: Rubro is MISSING or WRONG in login response.');
            }
        } else {
            console.error('Login failed:', data.error);
        }

    } catch (error) {
        console.error('Error during login verification:', error);
    }
}

verifyLogin();
