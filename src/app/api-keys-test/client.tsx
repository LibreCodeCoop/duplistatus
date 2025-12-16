'use client';

import { useState } from 'react';
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

export function ApiKeysTestClient() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState<NewApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch all API keys
  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/api-keys');
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Create new API key
  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyName.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf');
      const csrfData = await csrfResponse.json();
      
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.token,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDescription.trim(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create API key');
      }
      
      const data: NewApiKeyResponse = await response.json();
      setGeneratedKey(data);
      setNewKeyName('');
      setNewKeyDescription('');
      
      // Refresh the list
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Delete API key
  const deleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const csrfResponse = await fetch('/api/csrf');
      const csrfData = await csrfResponse.json();
      
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfData.token,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }
      
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle enabled status
  const toggleKey = async (id: string, currentEnabled: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      const csrfResponse = await fetch('/api/csrf');
      const csrfData = await csrfResponse.json();
      
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.token,
        },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update API key');
      }
      
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">API Keys Management (Test)</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generated Key Display (shown once) */}
      {generatedKey && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold text-green-800">✓ API Key Created Successfully!</p>
              <p className="text-sm text-green-700">{generatedKey.message}</p>
              <div className="mt-2 p-3 bg-white border border-green-300 rounded font-mono text-sm break-all flex items-center justify-between">
                <code className="flex-1">{generatedKey.apiKey}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(generatedKey.apiKey)}
                  className="ml-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-green-600">
                Use this in Duplicati: <code className="bg-white px-1 py-0.5 rounded">
                  --send-http-url=http://HOST:9666/api/upload?api_key={generatedKey.apiKey}
                </code>
              </p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setGeneratedKey(null)}
              >
                Close
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Create New Key Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>
            Generate a new API key for authenticating backup uploads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createKey} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="e.g., Server-Backup-01"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="e.g., Main server daily backups"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Generate API Key'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing API Keys</CardTitle>
          <CardDescription>Manage your API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchKeys} disabled={loading} className="mb-4">
            {loading ? 'Loading...' : 'Refresh List'}
          </Button>

          {keys.length === 0 ? (
            <p className="text-sm text-gray-500">No API keys found</p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{key.name}</h3>
                    {key.description && (
                      <p className="text-sm text-gray-600">{key.description}</p>
                    )}
                    <div className="text-xs text-gray-500 mt-1 space-x-4">
                      <span>Created: {new Date(key.created_at).toLocaleString()}</span>
                      <span>Used: {key.usage_count} times</span>
                      {key.last_used_at && (
                        <span>Last: {new Date(key.last_used_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={key.enabled ? 'default' : 'outline'}
                      onClick={() => toggleKey(key.id, key.enabled)}
                      disabled={loading}
                    >
                      {key.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteKey(key.id)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
