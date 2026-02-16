const apiBase = 'http://localhost:3000/api/admin/attendance';
const params = new URLSearchParams({
    requesterId: '4',
    requesterRole: 'admin',
    startDate: '2026-02-16',
    endDate: '2026-02-16',
    location: '',
    rubro: ''
});

async function testApi() {
    try {
        console.log(`Fetching: ${apiBase}?${params.toString()}`);
        const res = await fetch(`${apiBase}?${params.toString()}`);
        if (!res.ok) {
            console.log('Error:', res.status, res.statusText);
            const text = await res.text();
            console.log(text);
        } else {
            const data = await res.json();
            console.log('Data length:', data.length);
            if (data.length > 0) {
                console.log('First Item:', JSON.stringify(data[0], null, 2));
            } else {
                console.log('Empty generated array.');
            }
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testApi();
