import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/audit-logger';
import { requireAdmin } from '@/lib/auth-middleware';
import { withCSRF } from '@/lib/csrf-middleware';
import { getClientIpAddress } from '@/lib/ip-utils';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

// Helper function to generate secure API key
function generateApiKey(): string {
  // Generate 32 bytes (256 bits) of random data
  // Convert to base64url (URL-safe, no padding)
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// GET - List all API keys (without showing actual keys)
export const GET = requireAdmin(async (
  request: NextRequest,
  authContext
) => {
  try {
    const keys = db.prepare(`
      SELECT 
        id, 
        name, 
        description, 
        enabled, 
        created_at, 
        last_used_at, 
        usage_count,
        created_by
      FROM api_keys
      ORDER BY created_at DESC
    `).all();
    
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
});

// POST - Create new API key
export const POST = withCSRF(requireAdmin(async (
  request: NextRequest,
  authContext
) => {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Generate random API key (base64url, 256 bits)
    const apiKey = generateApiKey();
    
    // Hash the key
    const keyHash = await bcrypt.hash(apiKey, 12);
    
    const id = 'key_' + randomBytes(16).toString('hex');
    
    // Insert into database
    db.prepare(`
      INSERT INTO api_keys (
        id, 
        name, 
        key_hash, 
        description, 
        created_by
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      keyHash,
      description?.trim() || '',
      authContext.userId
    );
    
    // Log the creation
    const ipAddress = getClientIpAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await AuditLogger.log({
      userId: authContext.userId,
      username: authContext.username,
      action: 'api_key_created',
      category: 'system',
      targetType: 'api_key',
      targetId: id,
      details: { 
        key_name: name,
        description: description || ''
      },
      ipAddress,
      userAgent,
      status: 'success'
    });
    
    // Return the plain key ONLY ONCE (cannot be retrieved later)
    return NextResponse.json({ 
      id,
      name,
      apiKey, // ⚠️ This is the only time the key is shown
      message: 'Save this API key securely. It cannot be retrieved again.'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}));
