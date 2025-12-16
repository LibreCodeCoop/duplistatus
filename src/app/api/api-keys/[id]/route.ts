import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/audit-logger';
import { requireAdmin } from '@/lib/auth-middleware';
import { withCSRF } from '@/lib/csrf-middleware';
import { getClientIpAddress } from '@/lib/ip-utils';

// DELETE - Remove API key
export const DELETE = withCSRF(requireAdmin(async (
  request: NextRequest,
  authContext
) => {
  try {
    // Extract ID from URL pathname
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop(); // /api/api-keys/[id]
    
    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }
    
    const key = db.prepare('SELECT name FROM api_keys WHERE id = ?')
      .get(id) as { name: string } | undefined;
      
    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    // Delete the key
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    
    // Log the deletion
    const ipAddress = getClientIpAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await AuditLogger.log({
      userId: authContext.userId,
      username: authContext.username,
      action: 'api_key_deleted',
      category: 'system',
      targetType: 'api_key',
      targetId: id,
      details: { key_name: key.name },
      ipAddress,
      userAgent,
      status: 'success'
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}));

// PATCH - Toggle enabled status
export const PATCH = withCSRF(requireAdmin(async (
  request: NextRequest,
  authContext
) => {
  try {
    // Extract ID from URL pathname
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop(); // /api/api-keys/[id]
    
    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { enabled } = body;
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid enabled value' },
        { status: 400 }
      );
    }
    
    const key = db.prepare('SELECT name FROM api_keys WHERE id = ?')
      .get(id) as { name: string } | undefined;
      
    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    // Update enabled status
    db.prepare('UPDATE api_keys SET enabled = ? WHERE id = ?')
      .run(enabled ? 1 : 0, id);
    
    // Log the status change
    const ipAddress = getClientIpAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await AuditLogger.log({
      userId: authContext.userId,
      username: authContext.username,
      action: enabled ? 'api_key_enabled' : 'api_key_disabled',
      category: 'system',
      targetType: 'api_key',
      targetId: id,
      details: { key_name: key.name },
      ipAddress,
      userAgent,
      status: 'success'
    });
    
    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}));
