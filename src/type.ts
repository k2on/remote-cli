import { CLI } from './generatedSchemaInterface';
export * from './generatedSchemaInterface';

export interface Context {
    directory: string;
    cli: CLI;
}

export interface Splash {
    text: string;
    font: string;
    color?: string;
}
