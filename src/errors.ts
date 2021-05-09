import { ErrorObject } from 'ajv';

/**
 * The bass class for a CLI build error.
 */
export class BuildError extends Error {
    /**
     * Constructor for a build error.
     * @param {string} name    Name of the error.
     * @param {string} message Message of the error.
     */
    constructor(name: string, message: string) {
        super(`${name}: ${message}`);
    }
}

/**
 * Class to represent a file not found error.
 */
export class FileNotFound extends BuildError {
    /**
     * Constructor for a file not found error.
     * @param {string} filePath Path to the file that was not found.
     */
    constructor(public filePath: string) {
        super(
            filePath.includes('.') ? 'FileNotFound' : 'DirectoryNotFound',
            `'${filePath}' does not exist.`,
        );
    }
}

/**
 * Class to represent a file error.
 */
export class FileError extends BuildError {
    /**
     * Constructor for a file error.
     * @param {string} name     Name of the file error.
     * @param {string} message  Message of the file error.
     * @param {string} filePath Path of the invalid file.
     * @param {number} line     Line of the error.
     * @param {number} column   Column of the error.
     */
    constructor(
        name: string,
        message: string,
        public filePath: string,
        public line = 0,
        public column = 0,
    ) {
        super(name, message);
    }

    /**
     * Represent the error as a string.
     * @returns {string} The string representation.
     */
    toString(): string {
        return `::error file=${this.filePath},line=${this.line},col=${this.column}::${this.message}`;
    }
}

/**
 * Class to represent an invalid JSON schema.
 */
export class InvalidJSONSchema extends FileError {
    private static REASON_UNKNOWN = 'Reason Unknown';

    /**
     * Constructor for an invalid JSON schema.
     * @param {string} filePath The path of the invalid file.
     * @param {ErrorObject[]} errors Errors from the validator.
     */
    constructor(
        public filePath: string,
        public errors: undefined | null | ErrorObject[],
    ) {
        super(
            'InvalidJSONSchema',
            Array.isArray(errors) && errors.length > 0
                ? errors[0].message || InvalidJSONSchema.REASON_UNKNOWN
                : InvalidJSONSchema.REASON_UNKNOWN,
            filePath,
        );
    }
}

/**
 * Class to represent an invalid json syntax error.
 */
export class InvalidJSONSyntax extends FileError {
    /**
     * Constructor for an invalid json syntax error.
     * @param {string} filePath Path to the invalid syntax file.
     * @param {string} reason   Reason for the invalid syntax.
     * @param {number} line     Line of the error.
     * @param {number} column   Column of the error.
     */
    constructor(
        public filePath: string,
        public reason: string,
        line = 0,
        column = 0,
    ) {
        super('InvalidJSONSyntax', reason, filePath, line, column);
    }
}
