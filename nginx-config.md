# Nginx Configuration for Cinema.bz

## Full Configuration File

Save this as `/etc/nginx/sites-available/cinema.bz`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name cinema.bz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name cinema.bz;

    root /var/www/cinemabz-frontend/dist;
    index index.html;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/cinema.bz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cinema.bz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API proxy configuration (FIXED - no trailing slashes)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
```

## Installation Steps

1. **Backup current config:**
```bash
sudo cp /etc/nginx/sites-available/cinema.bz /etc/nginx/sites-available/cinema.bz.backup
```

2. **Edit the config file:**
```bash
sudo nano /etc/nginx/sites-available/cinema.bz
```

3. **Copy the entire configuration above and paste it**

4. **Test nginx configuration:**
```bash
sudo nginx -t
```

5. **If test passes, reload nginx:**
```bash
sudo systemctl reload nginx
```

6. **Test the API endpoint:**
```bash
curl https://cinema.bz/api/health
```

## Key Changes Made

- **Fixed redirect loop:** Removed trailing slashes from `location /api/` and `proxy_pass`
- **Added security headers:** X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
- **Added timeouts:** Prevents hanging connections
- **Added gzip compression:** Improves frontend performance

## Troubleshooting

If you still see issues:

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check if backend is running
curl https://cinema.bz/api/health

# Restart nginx completely
sudo systemctl restart nginx
```
