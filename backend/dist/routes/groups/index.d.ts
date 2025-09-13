export { chatGroupRoutes } from './chat';
export { agentGroupRoutes } from './agent';
export { knowledgeGroupRoutes } from './knowledge';
export { authGroupRoutes } from './auth';
export { adminGroupRoutes } from './admin';
export interface RouteGroup {
    name: string;
    prefix: string;
    router: any;
    version: string;
    description: string;
}
export declare const routeGroups: RouteGroup[];
//# sourceMappingURL=index.d.ts.map