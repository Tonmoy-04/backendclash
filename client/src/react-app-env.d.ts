/// <reference types="react-scripts" />

interface Window {
  electronAPI?: {
    backend?: {
      getInfo: () => Promise<{
        port: number | null;
        baseUrl: string | null;
        apiBaseUrl: string | null;
        startedByElectron: boolean;
        pid: number | null;
      }>;
    };
    db?: {
      query: (sql: string, params?: any[]) => Promise<any>;
      execute: (sql: string, params?: any[]) => Promise<any>;
    };
    file?: {
      selectFile: () => Promise<string>;
      saveFile: (data: any) => Promise<void>;
      exportData: (data: any, filename: string) => Promise<void>;
    };
    backup?: {
      create: () => Promise<void>;
      restore: (path: string) => Promise<void>;
    };
    print?: {
      invoice: (data: any) => Promise<void>;
      report: (data: any) => Promise<void>;
    };
    shell?: {
      openExternal: (url: string) => Promise<void>;
    };
    getVersion?: () => Promise<string>;
    on?: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener?: (channel: string, callback: (...args: any[]) => void) => void;
  };
  electron?: {
    shell?: {
      openExternal: (url: string) => Promise<void>;
    };
  };
}
