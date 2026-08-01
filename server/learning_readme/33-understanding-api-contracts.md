# Understanding API Contracts (`src/contracts/api.contracts.ts`)

## What are API Contracts?
In this application, `api.contracts.ts` serves as the single source of truth for the shape of our API's inputs (requests) and outputs (responses). It uses **Zod**, a TypeScript-first schema declaration and validation library, to define these shapes.

By defining these schemas centrally, we ensure that:
1. Every incoming request is strictly validated against a known structure.
2. Every outgoing response conforms to a predictable format.
3. Our code remains strongly typed, reducing runtime errors.

## The `.openapi()` Method and `@asteasolutions/zod-to-openapi`
You will notice that almost every Zod schema in this file ends with a `.openapi(...)` call. For example:

```typescript
const AuthLoginRequestSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().nonempty().min(4),
  })
  .openapi("AuthLoginRequest");
```

This `.openapi()` method is not a native part of Zod. It is provided by the `@asteasolutions/zod-to-openapi` library (initialized at the top of the file via `extendZodWithOpenApi(z)`).

### Why use `.openapi()`?
The primary reason we use this library and method is to adhere to the **DRY (Don't Repeat Yourself)** principle. 

Normally, in a Node.js API, you have to define the shape of your data twice:
1. Once for the validation logic (e.g., using Zod, Joi, or custom logic).
2. Once again to document the API using Swagger/OpenAPI standard (often via verbose YAML or JSON files).

By attaching `.openapi("SchemaName")` directly to the Zod schema, we instruct the application to **automatically generate** the Swagger/OpenAPI documentation from the exact same validation schema used in the runtime code. This ensures our API documentation is *always* 100% in sync with our actual validation rules.

We can also use it to add OpenAPI-specific metadata like descriptions and examples:
```typescript
const ApiTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .openapi("ApiTimestamp", {
    description: "ISO-8601 timestamp in UTC.",
    example: "2026-04-22T10:00:00.000Z",
  });
```

## How It Connects to the Rest of the Application

The schemas defined in `api.contracts.ts` are heavily utilized across two main layers of the application:

### 1. Request Validation (Controllers)
The contracts are imported into individual controllers to validate incoming client data (`req.body`, `req.params`, etc.). If the data does not match the schema, an error is thrown before the business logic is even executed.

*Example from `src/controllers/auth/login.ts`:*
```typescript
import { AuthLoginRequestSchema } from "@/contracts/api.contracts.ts";

// Parses and validates the request body against the contract
const { email, password: unencryptedPassword } = AuthLoginRequestSchema.parse(req.body);
```

### 2. OpenAPI Generation (Documentation)
The contracts are imported into `src/openapi/document.ts` to build the comprehensive OpenAPI v3.1 specification. The schemas are bound to specific routes, defining what the endpoint expects and what it will return.

*Example from `src/openapi/document.ts`:*
```typescript
import { AuthLoginRequestSchema, AuthLoginResponseSchema } from "@/contracts/api.contracts.ts";

registerRoute({
  method: "post",
  path: "/api/auth/login",
  // ...
  request: {
    body: {
      content: { "application/json": { schema: AuthLoginRequestSchema } },
    },
  },
  responses: {
    "200": jsonResponse("Success", AuthLoginResponseSchema),
  },
});
```

In summary, `api.contracts.ts` elegantly bridges runtime request validation with automated, highly-accurate API documentation.
