/**
 * Route Groups - จัดกลุ่ม routes ตาม domain
 */

// Chat domain
export { chatGroupRoutes } from './chat';

// Agent domain  
export { agentGroupRoutes } from './agent';

// Knowledge domain
export { knowledgeGroupRoutes } from './knowledge';

// Auth domain
export { authGroupRoutes } from './auth';

// Admin domain
export { adminGroupRoutes } from './admin';

// Route registry for centralized management
export interface RouteGroup {
  name: string;
  prefix: string;
  router: any;
  version: string;
  description: string;
}

export const routeGroups: RouteGroup[] = [
  {
    name: 'Chat',
    prefix: '/chat',
    router: () => import('./chat').then(m => m.chatGroupRoutes),
    version: '1.0',
    description: 'Chat and messaging operations'
  },
  {
    name: 'Agent',
    prefix: '/agent',
    router: () => import('./agent').then(m => m.agentGroupRoutes),
    version: '1.0', 
    description: 'AI agent management and execution'
  },
  {
    name: 'Knowledge',
    prefix: '/knowledge',
    router: () => import('./knowledge').then(m => m.knowledgeGroupRoutes),
    version: '1.0',
    description: 'Knowledge base and document management'
  },
  {
    name: 'Auth',
    prefix: '/auth',
    router: () => import('./auth').then(m => m.authGroupRoutes),
    version: '1.0',
    description: 'Authentication and authorization'
  },
  {
    name: 'Admin',
    prefix: '/admin',
    router: () => import('./admin').then(m => m.adminGroupRoutes),
    version: '1.0',
    description: 'Administrative operations'
  }
];