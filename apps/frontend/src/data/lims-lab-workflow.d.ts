export const CATALOG_VERSION: string;
export const TEST_IDS: Record<string, string>;
export const limsLabWorkflowData: {
    version: string;
    testCatalog: Array<Record<string, unknown>>;
    workflow: Array<Record<string, unknown>>;
    roles: Array<Record<string, unknown>>;
    instruments: Array<Record<string, unknown>>;
    supplies: Array<Record<string, unknown>>;
};
export function getOrderableLabTests(): any[];
export function findLabTestWorkflowProfile(test: unknown): any | null;
export function enrichLabTestWithWorkflowData<T>(test: T): T & Record<string, any>;
