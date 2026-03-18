/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/*.spec.ts'
    ],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/**/__tests__/**'
    ],
    coverageDirectory: 'coverage',
    coverageThresholds: {
        global: {
            branches: 50,
            functions: 50,
            lines: 60,
            statements: 60
        }
    },
    setupFilesAfterSetup: [],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
            diagnostics: false
        }]
    },
    // Timeout for slow integration tests
    testTimeout: 30_000,
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
};
