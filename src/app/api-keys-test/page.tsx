import { requireServerAuth } from '@/lib/auth-server';
import { ApiKeysTestClient } from './client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Copy, Check } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

interface NewApiKeyResponse {
  id: string;
  name: string;
  apiKey: string;
  message: string;
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ApiKeysTestPage() {
  // Require authentication - redirects to login if not authenticated
  await requireServerAuth();
  
  return <ApiKeysTestClient />;
}
