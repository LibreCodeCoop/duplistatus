# IP Whitelist Security

This document explains how to restrict access to the admin interface using IP whitelisting, while keeping `/api/upload` publicly accessible for Duplicati servers.

## Overview

By default, the entire duplistatus application is accessible to anyone who can reach the server. The IP whitelist feature allows you to:

- **Expose only `/api/upload`** publicly (for Duplicati backup servers)
- **Restrict admin interface** (`/`, `/login`, `/settings`, all other `/api/*` endpoints) to specific IP addresses or networks

## How It Works

When IP whitelisting is enabled:

1. **Public endpoints** (no IP check required):
   - `/api/upload` - Backup upload endpoint
   - `/api/health` - Health check endpoint
   - Static assets (`/_next/*`, favicon, etc.)

2. **Protected endpoints** (IP whitelist required):
   - `/` - Dashboard
   - `/login` - Login page
   - `/settings` - Settings page
   - `/api-keys-test` - API key management
   - All other API endpoints

3. **Localhost is always allowed** - `127.0.0.1`, `::1`, and `localhost` are automatically whitelisted

## Configuration

### 1. Create `.env` file

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 2. Enable IP Whitelist

Edit `.env`:

```env
ENABLE_ADMIN_IP_WHITELIST=true
```

### 3. Configure Allowed IPs

Add your IPs to the whitelist (comma-separated):

#### Single IP
```env
ADMIN_IP_WHITELIST=192.168.1.100
```

#### Multiple IPs
```env
ADMIN_IP_WHITELIST=192.168.1.100,192.168.1.101,192.168.1.102
```

#### CIDR Notation (Network Range)

**Class C (/24)** - 256 addresses (e.g., 192.168.1.0 to 192.168.1.255):
```env
ADMIN_IP_WHITELIST=192.168.1.0/24
```

**Class B (/16)** - 65,536 addresses (e.g., 10.0.0.0 to 10.0.255.255):
```env
ADMIN_IP_WHITELIST=10.0.0.0/16
```

**Class A (/8)** - 16,777,216 addresses (e.g., 172.0.0.0 to 172.255.255.255):
```env
ADMIN_IP_WHITELIST=172.0.0.0/8
```

#### Mixed Configuration
```env
ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.0/24,172.16.0.0/16
```

### 4. Restart Container

```bash
docker compose down
docker compose up -d
```

## Testing

### 1. Test Public Endpoint (should work from anywhere)

```bash
curl http://your-server:9666/api/health
```

### 2. Test Admin Access

From a **whitelisted IP**:
```bash
curl http://your-server:9666/
# Should return HTML (dashboard)
```

From a **non-whitelisted IP**:
```bash
curl http://your-server:9666/
# Should return: {"error":"Access Denied","message":"Your IP address is not authorized..."}
```

## Security Considerations

### ✅ Best Practices

1. **Use VPN or SSH tunnel** for remote admin access instead of exposing to internet
2. **Use CIDR notation** for internal networks (e.g., `192.168.0.0/16`)
3. **Keep whitelist minimal** - only add IPs that need admin access
4. **Enable API Key Authentication** for `/api/upload` as additional security layer
5. **Monitor logs** for blocked access attempts

### ⚠️ Important Notes

1. **IP spoofing**: If not behind a reverse proxy, direct access could bypass IP checks
2. **Dynamic IPs**: Home/mobile IPs change frequently - consider VPN instead
3. **Reverse proxy**: When using nginx/Caddy, ensure `X-Forwarded-For` header is set correctly
4. **Docker networks**: Internal Docker network requests always appear as localhost

## Behind Reverse Proxy (nginx/Caddy)

If duplistatus is behind a reverse proxy, ensure the real client IP is forwarded:

### nginx

```nginx
location / {
    proxy_pass http://duplistatus:9666;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Caddy

```
reverse_proxy duplistatus:9666 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
}
```

## Alternative: Reverse Proxy IP Restrictions

Instead of using duplistatus middleware, you can restrict access at the reverse proxy level:

### nginx Example

```nginx
# Allow /api/upload from anywhere
location /api/upload {
    proxy_pass http://duplistatus:9666;
}

# Restrict everything else
location / {
    allow 192.168.1.0/24;
    allow 10.0.0.100;
    deny all;
    
    proxy_pass http://duplistatus:9666;
}
```

### Caddy Example

```
# Public endpoint
@upload path /api/upload*
handle @upload {
    reverse_proxy duplistatus:9666
}

# Protected admin interface
handle {
    @allowed {
        remote_ip 192.168.1.0/24 10.0.0.100
    }
    handle @allowed {
        reverse_proxy duplistatus:9666
    }
    handle {
        respond "Access Denied" 403
    }
}
```

## Disabling IP Whitelist

To disable and make everything publicly accessible again:

```env
ENABLE_ADMIN_IP_WHITELIST=false
```

Or remove the environment variable entirely.

## Troubleshooting

### Problem: Locked out of admin interface

**Solution**: Access via localhost/SSH:

```bash
# Connect via SSH tunnel
ssh -L 9666:localhost:9666 user@your-server

# Then access via http://localhost:9666 (localhost is always allowed)
```

### Problem: "Access Denied" but IP should be whitelisted

**Check logs**:
```bash
docker logs duplistatus | grep Security
# Look for: [Security] Blocked access from X.X.X.X to /path
```

The logged IP might be different from your actual IP if behind NAT/proxy.

**Verify IP forwarding** (if behind reverse proxy):
```bash
curl -H "X-Forwarded-For: YOUR_IP" http://localhost:9666/
```

### Problem: Docker internal requests blocked

**Solution**: Docker bridge network always uses localhost (127.0.0.1), which is automatically whitelisted. This should not be an issue.

## Migration from Existing Setup

If you're adding IP whitelist to an existing installation:

1. Create `.env` file
2. Set `ENABLE_ADMIN_IP_WHITELIST=true`
3. Add your admin IPs to `ADMIN_IP_WHITELIST`
4. Run `docker compose up -d`
5. Test access from whitelisted IP
6. Test `/api/upload` still works from Duplicati servers

## See Also

- [API Key Authentication](./API_KEY_AUTHENTICATION.md) - Additional security for `/api/upload`
- [Docker Deployment](./INSTALL.md) - Docker installation guide
