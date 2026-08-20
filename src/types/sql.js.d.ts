declare module 'sql.js' {
    interface SqlJsDatabase {
        prepare(stmt: string, values?: unknown[]): SqlJsStatement;
        exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
        export(): Uint8Array;
        close(): void;
        handleError?: (e: Error) => void;
    }
    interface SqlJsStatement {
        step(): boolean;
        get(): unknown[];
        getAsObject(): Record<string, unknown>;
        free(): void;
    }
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
    }
    export default function initSqlJs(config: Record<string, unknown>): Promise<SqlJsStatic>;
}
