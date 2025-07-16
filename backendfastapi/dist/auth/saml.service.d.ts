import { ConfigService } from '../config/config.service';
export interface SAMLUser {
    nameID: string;
    sessionIndex: string;
    attributes: Record<string, string[]>;
}
export declare class SAMLService {
    private configService;
    private readonly logger;
    private sp;
    private idp;
    constructor(configService: ConfigService);
    private initializeSAML;
    generateLoginRequest(): Promise<{
        redirectUrl: string;
        requestId: string;
    }>;
    processResponse(samlResponse: string): Promise<SAMLUser>;
    generateLogoutRequest(nameID: string, sessionIndex: string): Promise<{
        redirectUrl: string;
        requestId: string;
    }>;
    processLogoutResponse(samlResponse: string): Promise<boolean>;
    validateConfiguration(): {
        isValid: boolean;
        errors: string[];
    };
    getMetadata(): Promise<string>;
    extractUserAttributes(samlUser: SAMLUser): {
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        displayName: string;
    };
    private getAttributeValue;
    getLoginUrl(relayState?: string): Promise<string>;
    processCallback(req: any): Promise<{
        success: boolean;
        user?: any;
        error?: string;
    }>;
}
