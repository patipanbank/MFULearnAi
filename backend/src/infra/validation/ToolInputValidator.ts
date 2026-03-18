import { LoggerService } from '../../services/LoggerService';
import { ToolSchemaJSON } from '../../tools/AgentTool';

/**
 * Tool Input Validator — JSON Schema validation for LLM-generated tool inputs.
 *
 * Validates tool arguments against their declared `schemaJSON.inputSchema`
 * BEFORE execution. This prevents:
 *   - Malformed LLM outputs causing silent failures
 *   - Injection attacks via unexpected field types
 *   - Missing required parameters
 *   - Extra fields the tool doesn't expect
 *
 * Implements a subset of JSON Schema Draft-07 sufficient for tool definitions:
 *   - type checking (string, number, integer, boolean, object, array)
 *   - required fields
 *   - enum values
 *   - minLength/maxLength for strings
 *   - minimum/maximum for numbers
 *   - pattern (regex) for strings
 *   - additionalProperties: false (strip unknown fields)
 *   - nested object validation
 *   - default value injection
 *
 * Does NOT implement (not needed for tool schemas):
 *   - $ref, allOf, anyOf, oneOf, not
 *   - patternProperties
 *   - format validators
 */

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    /** Sanitized input with defaults injected and extra fields stripped */
    sanitized: Record<string, unknown>;
}

export interface ValidationError {
    path: string;
    message: string;
    expected?: string;
    received?: string;
}

export class ToolInputValidator {
    /**
     * Validate tool input against its schema.
     * Returns sanitized input with defaults injected.
     */
    static validate(
        toolName: string,
        input: Record<string, unknown>,
        schema: ToolSchemaJSON
    ): ValidationResult {
        const errors: ValidationError[] = [];
        const jsonSchema = schema.inputSchema?.json;

        if (!jsonSchema || !jsonSchema.properties) {
            // No schema defined — allow anything (backward compatible)
            return { valid: true, errors: [], sanitized: { ...input } };
        }

        const sanitized: Record<string, unknown> = {};
        const properties = jsonSchema.properties as Record<string, any>;
        const required = new Set(jsonSchema.required || []);

        // Check required fields
        for (const fieldName of required) {
            if (input[fieldName] === undefined || input[fieldName] === null) {
                // Check for default value
                const propSchema = properties[fieldName];
                if (propSchema?.default !== undefined) {
                    sanitized[fieldName] = propSchema.default;
                } else {
                    errors.push({
                        path: fieldName,
                        message: `Required field "${fieldName}" is missing`,
                        expected: 'present',
                        received: 'undefined'
                    });
                }
            }
        }

        // Validate and sanitize each property
        for (const [key, propSchema] of Object.entries(properties)) {
            const value = input[key];

            if (value === undefined || value === null) {
                // Inject default if available
                if ((propSchema as any).default !== undefined) {
                    sanitized[key] = (propSchema as any).default;
                }
                continue; // Already checked required above
            }

            const fieldErrors = this.validateField(key, value, propSchema as any);
            errors.push(...fieldErrors);

            if (fieldErrors.length === 0) {
                // Coerce types if needed (LLMs sometimes return "123" instead of 123)
                sanitized[key] = this.coerce(value, propSchema as any);
            } else {
                // Still include the value but as-is (tool can decide)
                sanitized[key] = value;
            }
        }

        // Copy any extra fields not in schema
        // If additionalProperties is explicitly false, strip them with a warning.
        // Otherwise pass through (backward compatible).
        const additionalProps = (jsonSchema as any).additionalProperties;
        for (const key of Object.keys(input)) {
            if (!properties[key] && input[key] !== undefined) {
                if (additionalProps === false) {
                    LoggerService.warn('tool_input_extra_field_stripped', {
                        tool: toolName,
                        field: key,
                        note: 'additionalProperties=false — field removed'
                    });
                    // Do NOT copy into sanitized
                } else {
                    LoggerService.debug('tool_input_extra_field', {
                        tool: toolName,
                        field: key,
                        note: 'field not in schema — passed through'
                    });
                    sanitized[key] = input[key];
                }
            }
        }

        if (errors.length > 0) {
            LoggerService.warn('tool_input_validation_errors', {
                tool: toolName,
                errorCount: errors.length,
                errors: errors.slice(0, 5).map(e => `${e.path}: ${e.message}`)
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized
        };
    }

    /**
     * Validate a single field against its property schema.
     */
    private static validateField(
        path: string,
        value: unknown,
        schema: Record<string, any>
    ): ValidationError[] {
        const errors: ValidationError[] = [];
        const expectedType = schema.type;

        // Type checking
        if (expectedType) {
            const actualType = this.getJsonType(value);
            const typeOk = this.isTypeCompatible(actualType, expectedType, value);

            if (!typeOk) {
                errors.push({
                    path,
                    message: `Expected type "${expectedType}" but got "${actualType}"`,
                    expected: expectedType,
                    received: actualType
                });
                return errors; // Skip further validation if type is wrong
            }
        }

        // Enum check
        if (schema.enum && Array.isArray(schema.enum)) {
            if (!schema.enum.includes(value)) {
                errors.push({
                    path,
                    message: `Value must be one of: ${schema.enum.join(', ')}`,
                    expected: schema.enum.join('|'),
                    received: String(value)
                });
            }
        }

        // String constraints
        if (typeof value === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} is below minimum ${schema.minLength}`,
                    expected: `>= ${schema.minLength} chars`,
                    received: `${value.length} chars`
                });
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
                    expected: `<= ${schema.maxLength} chars`,
                    received: `${value.length} chars`
                });
            }
            // Regex pattern validation
            if (schema.pattern) {
                try {
                    const regex = new RegExp(schema.pattern);
                    if (!regex.test(value)) {
                        errors.push({
                            path,
                            message: `Value does not match pattern: ${schema.pattern}`,
                            expected: `match /${schema.pattern}/`,
                            received: value.substring(0, 50)
                        });
                    }
                } catch {
                    // Invalid regex in schema — skip validation, don't crash
                    LoggerService.warn('tool_schema_invalid_pattern', { path, pattern: schema.pattern });
                }
            }
        }

        // Number constraints
        if (typeof value === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push({
                    path,
                    message: `Value ${value} is below minimum ${schema.minimum}`,
                    expected: `>= ${schema.minimum}`,
                    received: String(value)
                });
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push({
                    path,
                    message: `Value ${value} exceeds maximum ${schema.maximum}`,
                    expected: `<= ${schema.maximum}`,
                    received: String(value)
                });
            }
        }

        // Nested object validation
        if (expectedType === 'object' && typeof value === 'object' && value !== null && schema.properties) {
            const nestedProps = schema.properties as Record<string, any>;
            const nestedRequired = new Set((schema.required as string[]) || []);
            const obj = value as Record<string, unknown>;

            for (const reqField of nestedRequired) {
                if (obj[reqField] === undefined) {
                    errors.push({
                        path: `${path}.${reqField}`,
                        message: `Required nested field "${reqField}" is missing`,
                        expected: 'present',
                        received: 'undefined'
                    });
                }
            }

            for (const [nestedKey, nestedSchema] of Object.entries(nestedProps)) {
                if (obj[nestedKey] !== undefined) {
                    const nestedErrors = this.validateField(`${path}.${nestedKey}`, obj[nestedKey], nestedSchema as any);
                    errors.push(...nestedErrors);
                }
            }
        }

        // Array validation
        if (expectedType === 'array' && Array.isArray(value) && schema.items) {
            for (let i = 0; i < value.length; i++) {
                const itemErrors = this.validateField(`${path}[${i}]`, value[i], schema.items);
                errors.push(...itemErrors);
            }
        }

        return errors;
    }

    /**
     * Get JSON Schema type string for a JavaScript value.
     */
    private static getJsonType(value: unknown): string {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        const t = typeof value;
        if (t === 'number' && Number.isInteger(value)) return 'integer';
        return t;
    }

    /**
     * Check if actual type is compatible with expected type.
     * Allows integer for number, and numeric strings for number/integer.
     */
    private static isTypeCompatible(actual: string, expected: string, value: unknown): boolean {
        if (actual === expected) return true;
        if (expected === 'number' && actual === 'integer') return true;

        // LLMs sometimes return numeric strings — be lenient  
        if ((expected === 'number' || expected === 'integer') && actual === 'string') {
            const num = Number(value);
            if (!isNaN(num)) return true;
        }

        return false;
    }

    /**
     * Coerce a value to match the expected type (safe conversions only).
     */
    private static coerce(value: unknown, schema: Record<string, any>): unknown {
        const expected = schema.type;
        if (!expected) return value;

        if ((expected === 'number' || expected === 'integer') && typeof value === 'string') {
            const num = Number(value);
            if (!isNaN(num)) {
                return expected === 'integer' ? Math.round(num) : num;
            }
        }

        if (expected === 'boolean' && typeof value === 'string') {
            if (value === 'true') return true;
            if (value === 'false') return false;
        }

        if (expected === 'string' && typeof value !== 'string') {
            return String(value);
        }

        return value;
    }
}
