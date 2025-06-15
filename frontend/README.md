# MFU Learn AI - Frontend

A modern React-based web application for AI-powered learning and document management system.

## Features

- **Authentication**: SAML-based authentication with guest login support
- **Real-time Chat**: WebSocket-powered chat interface with AI models
- **Document Management**: Upload and manage training documents
- **Model Training**: Train personal and department AI models
- **Role-based Access**: Multi-level user permissions (Students, Staffs, Admin, SuperAdmin)
- **Admin Panel**: User and system management
- **Statistics Dashboard**: Usage analytics and insights

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Ant Design** for UI components
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **WebSocket** for real-time communication
- **React Hot Toast** for notifications

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5001
NODE_ENV=development
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── layout/         # Layout components (Header, Sidebar, etc.)
├── contexts/           # React contexts (Auth, etc.)
├── pages/              # Page components
├── utils/              # Utility functions and API clients
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Key Pages

- **Login** (`/login`) - Authentication page
- **Chat** (`/chat`) - Real-time AI chat interface
- **Models** (`/models`) - AI model management
- **Training** (`/training`) - Document upload and training
- **Admin** (`/admin`) - Admin panel (SuperAdmin only)
- **Statistics** (`/statistics`) - Usage analytics
- **Departments** (`/departments`) - Department management
- **Help** (`/help`) - Help and documentation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket server URL | `ws://localhost:5001` |
| `NODE_ENV` | Environment mode | `development` |

## Authentication Flow

1. Users can login via SAML or as guests
2. JWT tokens are stored in localStorage
3. Protected routes require authentication
4. Role-based access control for different features

## API Integration

The frontend communicates with the backend through:
- RESTful APIs for CRUD operations
- WebSocket connections for real-time chat
- File upload for document management

## Dependencies

### Core Dependencies
- `react` - UI library
- `react-dom` - React DOM rendering
- `react-router-dom` - Client-side routing
- `antd` - UI component library
- `axios` - HTTP client
- `react-hot-toast` - Toast notifications

### Development Dependencies
- `@vitejs/plugin-react` - Vite React plugin
- `typescript` - Type checking
- `tailwindcss` - Utility-first CSS framework
- `eslint` - Code linting
- `@types/*` - TypeScript type definitions

## Contributing

1. Follow the existing code style
2. Use TypeScript for type safety
3. Write meaningful commit messages
4. Test your changes thoroughly

## License

This project is licensed under the MIT License.
