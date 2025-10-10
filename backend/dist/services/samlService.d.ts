import { SamlConfig } from 'passport-saml';
export interface SamlUserProfile {
    nameID: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    groups: string[];
}
export declare function getSamlConfig(): SamlConfig;
declare class SamlService {
    mapSamlProfile(profile: any): SamlUserProfile;
}
export declare const samlService: SamlService;
export {};
//# sourceMappingURL=samlService.d.ts.map