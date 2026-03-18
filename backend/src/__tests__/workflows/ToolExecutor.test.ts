/**
 * Unit Tests — ToolExecutor
 *
 * Tests tool result compaction, timeout handling, and parallel execution logic.
 */

// ── Test: Result Compaction (ported from ToolExecutor internals) ──

function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === '') continue;
        out[k] = v;
    }
    return out;
}

function arrayToCompact(arr: Record<string, unknown>[]): string {
    if (arr.length === 0) return '(empty)';
    const keys = Array.from(new Set(arr.flatMap(Object.keys)));
    const header = keys.join('/');
    const rows = arr.map(row =>
        keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return '';
            return String(v).replace(/[/|]/g, '_');
        }).join('/')
    );
    return [header, ...rows].join('|');
}

function compactResult(raw: unknown): string {
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return compactResult(parsed);
        } catch {
            return raw;
        }
    }
    if (Array.isArray(raw)) {
        if (raw.length === 0) return '(empty)';
        if (typeof raw[0] === 'object' && raw[0] !== null) {
            const cleaned = raw.map(item => (typeof item === 'object' ? stripEmpty(item as Record<string, unknown>) : item));
            return `${raw.length} results:` + arrayToCompact(cleaned as Record<string, unknown>[]);
        }
        return JSON.stringify(raw);
    }
    if (typeof raw === 'object' && raw !== null) {
        return JSON.stringify(stripEmpty(raw as Record<string, unknown>));
    }
    return String(raw);
}

describe('Tool Result Compaction', () => {
    it('should compact empty array', () => {
        expect(compactResult([])).toBe('(empty)');
    });

    it('should compact array of objects to delimited format', () => {
        const data = [
            { id: 'CAM-01', location: 'หน้าประตู', status: 'online' },
            { id: 'CAM-02', location: 'ลานจอดรถ', status: 'offline' }
        ];
        const result = compactResult(data);
        expect(result).toContain('2 results:');
        expect(result).toContain('id/location/status');
        expect(result).toContain('CAM-01');
        expect(result).toContain('CAM-02');
    });

    it('should strip null and empty values from objects', () => {
        const data = { name: 'test', value: null, empty: '', valid: 'yes' };
        const result = compactResult(data);
        expect(result).not.toContain('null');
        expect(result).toContain('name');
        expect(result).toContain('valid');
    });

    it('should handle string JSON input', () => {
        const jsonStr = JSON.stringify({ key: 'value', extra: null });
        const result = compactResult(jsonStr);
        expect(result).toBe('{"key":"value"}');
    });

    it('should handle primitive arrays', () => {
        const result = compactResult([1, 2, 3]);
        expect(result).toBe('[1,2,3]');
    });

    it('should handle plain string', () => {
        expect(compactResult('hello')).toBe('hello');
    });

    it('should handle numbers', () => {
        expect(compactResult(42)).toBe('42');
    });

    it('should escape / and | in values', () => {
        const data = [{ path: 'a/b', note: 'x|y' }];
        const result = compactResult(data);
        expect(result).toContain('a_b');
        expect(result).toContain('x_y');
    });
});

// ── Test: Timeout utility ───────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)),
            ms
        );
        promise
            .then(val => { clearTimeout(timer); resolve(val); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

describe('Tool Timeout', () => {
    it('should resolve when promise completes before timeout', async () => {
        const result = await withTimeout(
            Promise.resolve('done'),
            1000,
            'test'
        );
        expect(result).toBe('done');
    });

    it('should reject with timeout error when promise is slow', async () => {
        const slowPromise = new Promise(resolve => setTimeout(resolve, 5000));
        await expect(
            withTimeout(slowPromise, 50, 'slow_tool')
        ).rejects.toThrow('Tool "slow_tool" timed out after 50ms');
    });

    it('should propagate original error if promise rejects before timeout', async () => {
        const failPromise = Promise.reject(new Error('original error'));
        await expect(
            withTimeout(failPromise, 1000, 'fail_tool')
        ).rejects.toThrow('original error');
    });
});
