import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const ticket = await request.json();
        const { id, subject, description, department, priority, status, requester, requesterEmail, date } = ticket;

        const stmt = db.prepare(`
            INSERT INTO tickets (id, subject, description, department, priority, status, requester, requesterEmail, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(id, subject, description, department, priority, status, requester, requesterEmail, date);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving ticket:', error);
        return NextResponse.json({ error: 'Failed to save ticket' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const tickets = db.prepare('SELECT * FROM tickets ORDER BY date DESC').all();
        return NextResponse.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }
}
