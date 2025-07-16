# Cinema Nexus Frontend

Modern streaming platform frontend built with React, TypeScript, and Tailwind CSS.

## Features

- 🎬 Movie and TV show streaming with HLS support
- 🎥 Trailer playback with quality options
- 🎨 Netflix-inspired UI with gradient blues theme
- 🔍 Advanced search functionality
- 📱 Fully responsive design
- 🚀 Fast loading with top bar progress
- 🎭 Genre filtering and sorting
- 💫 Smooth animations and transitions

## Tech Stack

- React + TypeScript
- Tailwind CSS for styling
- Shadcn/ui components
- HLS.js for video playback
- React Router for navigation
- Lucide icons

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── components/      # UI components
│   ├── ui/         # Shadcn components
│   └── ...         # Custom components
├── hooks/          # Custom React hooks
├── lib/           # Utility functions
├── pages/         # Page components
└── styles/        # Global styles
```

## Environment Variables

Create `.env` file:
```
VITE_BACKEND_URL=https://cinemafo.lol/api
VITE_DISCORD_URL=your_discord_invite_url
```

## Features

### Pages
- Home: Trending and top-rated content
- Movies: Browse and filter movies
- Shows: TV show browsing
- Search: Advanced search functionality

### Components
- HeroSlider: Featured content showcase
- MovieModal: Movie details and playback
- VideoPlayer: HLS streaming with fallback
- Navigation: Responsive header with active states
- LoadingBar: Progress indicator for navigation

### Streaming
- HLS playback for high-quality streaming
- Automatic fallback to alternative sources
- Quality selection when available
- Trailer support with multiple qualities

Note: Streaming functionality requires domain whitelisting by the provider.













































