export declare function createClient(fetch: (request: Request) => Response | Promise<Response>, origin?: string): {
    jar: Map<string, string>;
    request: (method: string, path: string, body?: unknown, init?: RequestInit) => Promise<{
        status: number;
        headers: Headers;
        cookies: string[];
        data: any;
    }>;
    get: (path: string) => Promise<{
        status: number;
        headers: Headers;
        cookies: string[];
        data: any;
    }>;
    post: (path: string, body?: unknown) => Promise<{
        status: number;
        headers: Headers;
        cookies: string[];
        data: any;
    }>;
    delete: (path: string) => Promise<{
        status: number;
        headers: Headers;
        cookies: string[];
        data: any;
    }>;
};
