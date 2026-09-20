import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const FILE = path.join(process.cwd(), 'data', 'jobs.json');

function readAll(): any[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(readAll());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { txid, policy, jobId } = body ?? {};
  if (!txid) return NextResponse.json({ error: 'txid required' }, { status: 400 });
  const all = readAll();
  all.push({ txid, policy: policy ?? null, jobId: jobId ?? null, at: Date.now() });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  return NextResponse.json({ ok: true, count: all.length });
}
