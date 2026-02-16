const apiBase = 'http://localhost:3000/api/config';

async function testConfigApis() {
    try {
        console.log('Testing Locations API...');
        const locRes = await fetch(`${apiBase}/locations`);
        const locations = await locRes.json();
        console.log(`Locations count: ${locations.length}`);
        if (locations.length > 0) console.log('First location:', locations[0]);

        console.log('\nTesting Roles API...');
        const roleRes = await fetch(`${apiBase}/roles`);
        const roles = await roleRes.json();
        console.log(`Roles count: ${roles.length}`);
        if (roles.length > 0) console.log('First role:', roles[0]);

    } catch (e) {
        console.error('Test Error:', e);
    }
}

testConfigApis();
