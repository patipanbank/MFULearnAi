import { Strategy, SamlConfig } from 'passport-saml';
declare const SamlStrategy_base: new (...args: [options: SamlConfig] | [options: SamlConfig]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class SamlStrategy extends SamlStrategy_base {
    constructor();
    validate(profile: any, done: Function): void;
}
export {};
