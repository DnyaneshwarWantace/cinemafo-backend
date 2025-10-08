# Cinema Nexus Backend

Backend server for the Cinema Nexus streaming platform. This server provides:
- TMDB API proxy middleware
- Movie and TV show streaming endpoints
- Caching layer for better performance

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
BACKEND_URL=https://cinema.fo/api
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_BASE_URL=https://api.themoviedb.org/3
PORT=5000
DISCORD_INVITE=your_discord_invite_link_here
STREAM_BASE_URL=https://mia.vidjoy.wtf
VIDSRC_BASE_URL=https://vidsrc.xyz/embed
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Movies
- `GET /api/movies/trending` - Get trending movies
- `GET /api/movies/top_rated` - Get top rated movies
- `GET /api/movies/:id` - Get movie details with videos, credits, etc.
- `GET /api/search/movies?query=search_term` - Search movies
- `GET /api/genres/movies` - Get movie genres list

### Streaming
- `GET /api/stream/movie/:id` - Get movie stream URLs (HLS + fallback)
- `GET /api/stream/tv/:id/:season/:episode` - Get TV show stream URLs

Note: Streaming will only work once the domain is whitelisted by the streaming provider.

## Features

- TMDB API proxy to avoid CORS and ISP blocking issues
- Response caching for better performance
- Error handling with retry logic
- Streaming endpoints with fallback options
- CORS enabled for frontend access 






















i backend is also pointing to the frontend  and frontned giving the cros error 
@https://api.cinemafo.lol/api/tv/popular backend https://cinema.fo/ frontend domain
hook.js:608 404 Error: User attempted to access non-existent route: /api/tv/popular
# HTTP Redirect to HTTPS
server {
  listen 80;
  server_name www.cinemafo.lol www.api.cinemafo.lol;

  return 301 https://$host$request_uri;
}

# FRONTEND: https://www.cinemafo.lol
server {
  listen 443 ssl;
  server_name www.cinemafo.lol;

  root /var/www/cinema-nexus-stream/dist;
  index index.html;

  ssl_certificate /etc/letsencrypt/live/www.cinemafo.lol/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.cinemafo.lol/privkey.pem;

  location / {
    try_files $uri /index.html;
  }
}

# BACKEND: https://www.api.cinemafo.lol
server {
  listen 443 ssl;
  server_name www.api.cinemafo.lol;

  ssl_certificate /etc/letsencrypt/live/www.cinemafo.lol/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.cinemafo.lol/privkey.pem;

  location / {
    proxy_pass https://cinema.fo;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}