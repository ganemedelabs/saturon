# Style Guide

> **Note:** This style guide is not strict. Follow it when you can, but use your judgment for readability, practicality, and context.

This document outlines the coding standards and guidelines for the Saturon project. We use ESLint and Prettier to maintain consistent code style and quality.

## Coding Standards

### General Guidelines

- Write clear, readable, and maintainable code.
- Use descriptive variable and function names.

### File Naming

- Use **camelCase** for file names, variables, and functions.

### Indentation

- Use 4 spaces for indentation.

### Quotes

- Use double quotes (`"`) for strings, except when using template literals.

### Semicolons

- Always use semicolons at the end of statements.

### Line Length

- Limit lines to 120 characters.

## Scripts

Use the following npm scripts to manage code quality and formatting:

- **Lint Code:**

    ```bash
    npm run lint
    ```

    This command runs ESLint on your codebase to identify and report issues.

- **Fix Linting Issues:**

    ```bash
    npm run lint:fix
    ```

    This command automatically fixes fixable ESLint issues in your codebase.

- **Format Code:**

    ```bash
    npm run format
    ```

    This command formats your code using Prettier according to the specified configuration.

## Additional Resources

- [ESLint Documentation](https://eslint.org/docs/latest/use)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)
