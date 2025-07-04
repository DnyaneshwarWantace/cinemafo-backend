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
BACKEND_URL=http://localhost:5000/api
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
- `GET /api/movies/top-rated` - Get top rated movies
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






















ps aux | grep node
Unit your-backend-service.service could not be found.
root       12184  0.2  1.7 11538344 70888 ?      Ssl  11:18   0:03 node /var/www/moviebackend/server.js
root       12429  0.0  0.0   7076  2048 pts/0    S+   11:45   0:00 grep --color=auto node
root@cinemafo-s-2vcpu-4gb-sfo3-01:/var/www/cinema-nexus-stream# sudo tail -f /var/log/nginx/error.log
2025/07/03 15:12:43 [error] 1654#1654: *118 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /.DS_Store HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:44 [error] 1654#1654: *119 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /.env HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:44 [error] 1654#1654: *120 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /.git/config HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:44 [error] 1654#1654: *121 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /s/032313e24383e2434313e24323/_/;/META-INF/maven/com.atlassian.jira/jira-webapp-dist/pom.properties HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:45 [error] 1654#1654: *122 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /config.json HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:45 [error] 1654#1654: *123 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /telescope/requests HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:46 [error] 1654#1654: *124 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /info.php HTTP/1.1", host: "24.144.84.120"
2025/07/03 15:12:46 [error] 1654#1654: *125 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 206.81.24.74, server: ecomtrage.com, request: "GET /?rest_route=/wp/v2/users/ HTTP/1.1", host: "24.144.84.120"
2025/07/04 10:02:31 [error] 11415#11415: *185 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 24.144.84.120, server: ecomtrage.com, request: "GET /api/movies/trending HTTP/1.1", host: "24.144.84.120"
2025/07/04 10:06:40 [error] 11461#11461: *186 rewrite or internal redirection cycle while internally redirecting to "/index.html", client: 24.144.84.120, server: ecomtrage.com, request: "GET /api/movies/trending HTTP/1.1", host: "24.144.84.120"


like the backend is running on th @https://api.cinemafo.lol  and frontned https://cinemafo.lol 