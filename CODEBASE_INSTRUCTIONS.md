# NestJS Backend Code Generation Skill & Guidelines

## Context

You are a backend development and code generation agent working on the **Agro Connect** server — an enterprise agricultural marketplace and supply chain platform.
The tech stack is **NestJS 11 + Prisma ORM 6 + MongoDB + TypeScript**.

The boilerplate is fully scaffolded with custom utilities, base services, authentication guards, and file handlers. The Prisma schema (`prisma/schema.prisma`) is already configured for MongoDB with replica set support.
> **Rule:** **Do NOT modify `prisma/schema.prisma`** unless explicitly instructed by the user.

Your job is to generate clean, consistent, production-grade module code following the exact conventions, abstractions, and architecture described below.

---

## Architecture & Project Conventions

### 1. File & Folder Structure

**Standard Module Structure:**
```text
src/modules/
  <module>/
    <module>.controller.ts
    <module>.service.ts
    <module>.module.ts
    dto/
      body.dto.ts
```

**Submodule Structure:**
Use submodules **only** when a module has multiple distinct feature domains routed under a parent path (e.g., `/admin/producers`, `/admin/drivers`, `/admin/categories` → under `admin`):
```text
src/modules/
  <module>/
    <module>.controller.ts
    <module>.service.ts
    <module>.module.ts
    modules/
      <submodule>/
        <submodule>.controller.ts
        <submodule>.service.ts
        dto/
          body.dto.ts
```

> **Rules:**
> - A route path like `/admin/producers` makes `producers` a candidate submodule of `admin`. A standalone route like `/products` is never a submodule.
> - Only create a submodule when there are **more than 1** distinct sub-domain features. A single isolated call stays inline within the parent module.
> - Even with submodules, the parent controller defines the root route prefix (e.g. `@Controller("admin")`) while submodules append the sub-route (e.g. `@Controller("producers")`).
> - CLI helper: Scaffold new modules using `npm run generate:module <Name>` (or `npm run g:m <Name>`).

**Key Path Aliases (`tsconfig.json`):**
- `@/*` maps to `src/*`
- Example imports:
  - `@/core/services/prisma/prisma.service`
  - `@/core/services/files/cloudinary.service`
  - `@/common/guards/auth.guard`
  - `@/common/decorators/...`
  - `@/common/utils/queryBuilder`
  - `@/common/interceptors/response`
  - `@/common/errors/api_error`

---

### 2. Authentication, Authorization & Roles

The application registers a global `AuthGuard` in `AppModule`. **All routes are protected by default.**

- **Public Routes:** Decorate with `@IsPublic()` (imported from `@/common/decorators/auth.decorator`).
- **Optional Authentication:** Decorate with `@OptionalAuth()`. If a valid JWT Bearer token is provided, `req.user` is populated; otherwise, the request proceeds anonymously without error.
- **Role-Based Authorization:** Decorate with `@Roles(...)` (imported from `@/common/decorators/roles.decorator`) using the `UserRole` enum from `@prisma/client`:
  - `UserRole.ADMIN`
  - `UserRole.PRODUCER`
  - `UserRole.BUYER`
  - `UserRole.DRIVER`
- **Extracting Authenticated User:**
  - Controller: Extract via `@Req() req: Request` and cast `req.user as UserPayload` (or use `@ReqField("user") user: UserPayload`).
  - `UserPayload` is defined in `@/common/guards/auth.guard`:
    ```ts
    export type UserPayload = {
        id: string;
        email: string;
        role: UserRole;
    };
    ```

---

### 3. Naming Conventions

**Method Names:**
Function names should be clear and consistent between controller and service:

| Action         | Function Name                       | Example                           |
| :------------- | :---------------------------------- | :-------------------------------- |
| Create         | `create<Feature>`                   | `createNewProduct`, `createOrder` |
| Fetch list     | `getAll<Features>` / `fetchAll...`  | `getAllProducts`, `allProducers`  |
| Fetch single   | `get<Feature>ById` / `fetchSingle...`| `getProductById`, `getOrderById` |
| Update         | `update<Feature>`                   | `updateProduct`, `updateProfile`  |
| State toggle   | `toggle<Feature>Status`             | `toggleCategoryStatus`            |
| Delete / Remove| `delete<Feature>` / `remove...`     | `removeProductFromCart`           |

**Parameter Order:**
```ts
(user: UserPayload, payload: Dto, files?: Express.Multer.File[])
// or when identifying by ID:
(id: string, user: UserPayload, payload?: Dto)
```
- Keep parameter order consistent across service and controller calls.
- Never accept parameters that are not needed by the method.

---

### 4. Controller Decorators & Request Handling

- **Swagger Documentation:**
  - Decorate the controller class with `@ApiTags("<ModuleName>")`.
  - Decorate every route handler with `@ApiOperation({ summary: "<Summary>" })`.
- **Parameter Extraction:**
  - Use `@Body() payload: Dto` for request bodies.
  - Use `@Query() query: QueryDto` for query parameters.
  - Use `@Param("id") id: string` for path parameters.
  - Use `@UploadedFile()` or `@UploadedFiles()` for file uploads.
  - Use `@Req() req: Request` and `const user = req.user as UserPayload;` for authenticated user data.
- **Never** pass `req.something` directly as a bare parameter into a service call — assign to a typed variable first:
  ```ts
  // ✗ Wrong
  this.productService.getAll(req.query);

  // ✓ Correct
  const user = req.user as UserPayload;
  return this.productService.getAllProducts(user, query);
  ```

---

### 5. Return Shapes & Response Formatting

**Service Functions:**
Always return a plain JavaScript object with at least a `message: string`, and optional `data` and/or `pagination`:
```ts
// List fetch:
return {
    message: "Products fetched successfully",
    data: products,
    pagination, // or data: { items: products, meta: pagination }
};

// Single fetch:
return {
    message: "Product details fetched successfully",
    data: product,
};

// Mutations (Create, Update, Delete):
return {
    message: "Product created successfully",
    data: { id: product.id }, // Return only the affected ID unless more is required
};
```

**Controller Functions:**
Controller handlers MUST wrap all returns with `ResponseService.formatResponse`:
```ts
return ResponseService.formatResponse({
    statusCode: HttpStatus.OK, // or HttpStatus.CREATED
    message: result.message,
    data: result.data,         // optional
    pagination: result.pagination, // optional
});
```

> **Rules:**
> - Never return raw database models directly from the controller without formatting.
> - Never pass the entire `result` object directly into `data: result`. Extract only `data: result.data`.

---

### 6. Database Operations with Prisma (MongoDB)

1. **MongoDB ObjectIds:**
   - Primary keys and relational IDs in `schema.prisma` are MongoDB ObjectIds (`@db.ObjectId`), represented as `string` in TypeScript.
   - Always validate ObjectId parameters in DTOs using `@IsMongoId()`.

2. **DTO Spread on Create:**
   - Spread DTO properties directly — do not manually re-assign field by field unless transformations are needed:
   ```ts
   // ✗ Wrong
   await this.prisma.shippingAddress.create({
       data: { addressLine: payload.addressLine, city: payload.city, ... }
   });

   // ✓ Correct
   await this.prisma.shippingAddress.create({
       data: {
           ...payload,
           userId: user.id,
       },
   });
   ```

3. **Existence & Not-Found Checks:**
   - Verify records using direct Prisma calls with `select: { id: true }` to minimize payload overhead:
   ```ts
   await this.prisma.category.findUniqueOrThrow({
       where: { id: categoryId, isActive: true },
       select: { id: true },
   });
   ```
   - Alternatively, use `findUnique` and throw a custom `ApiError`:
   ```ts
   const product = await this.prisma.product.findUnique({
       where: { id: productId },
       select: { id: true, availableQuantity: true },
   });
   if (!product) {
       throw new ApiError(HttpStatus.NOT_FOUND, "Product not found");
   }
   ```

4. **Multi-Model Transactions:**
   - When operations affect multiple collections (e.g. order creation, cart clearance, inventory decrement), use `this.prisma.$transaction(async (tx) => { ... })`:
   ```ts
   await this.prisma.$transaction(async (tx) => {
       const product = await tx.product.create({ data: { ...productData, imageUrls } });
       await tx.pricingTier.createMany({
           data: pricingTiers.map((tier) => ({ ...tier, productId: product.id })),
       });
   });
   ```
   > Note: MongoDB replica sets are active and required for Prisma transactions.

5. **Atomic Field Updates:**
   - Use atomic increment/decrement operators when adjusting inventory or counters:
   ```ts
   await tx.product.update({
       where: { id: item.productId },
       data: { availableQuantity: { decrement: item.quantity } },
   });
   ```

6. **Lean Queries with `select` or `omit`:**
   - Do not query sensitive attributes (`password`, `otpHash`) or massive nested collections unless specifically needed. Use `select` or Prisma `omit`.

---

### 7. QueryBuilder for List Endpoints

Always use the project's centralized `QueryBuilder` (`@/common/utils/queryBuilder`) for paginated, searchable, and filtered list queries:

```ts
import QueryBuilder from "@/common/utils/queryBuilder";

async getAllProducers(query: ProducerQueryDto) {
    const queryBuilder = new QueryBuilder(this.prisma.user, query);

    const response = queryBuilder
        .search(["email", "fullName", "phone"])
        .filter({
            exacts: ["verificationStatus", "producerType"],
            booleans: ["isActive"],
            nestedFields: {
                verificationStatus: "producerProfile.verificationStatus",
                producerType: "producerProfile.producerType",
            },
        })
        .rawFilter({
            role: { equals: UserRole.PRODUCER },
        })
        .sort()       // Reads query.sort and query.order, defaults to 'createdAt desc'
        .paginate()   // Reads query.page and query.limit, applies skip & take
        .select({
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
            producerProfile: {
                omit: { updatedAt: true, userId: true },
            },
        });

    // Execute query and total count concurrently
    const [producers, pagination] = await Promise.all([
        response.execute(),
        response.countTotal(),
    ]);

    return {
        message: "All producers fetched successfully",
        data: {
            users: producers,
            meta: pagination,
        },
    };
}
```

**Key `QueryBuilder` Methods:**
- `.search(["field1", "field2"])`: Performs insensitive regex/contains search across specified fields.
- `.filter({ exacts, booleans, exclude, nestedFields })`: Auto-parses query keys against Prisma conditions.
- `.nestedFilter([{ field, filterField, queryKey }])`: Deep relationship filtering.
- `.rawFilter(whereObject)`: Injects custom Prisma `where` conditions.
- `.range(...)` / `.rangeDate(["createdAt"])`: Handles date and numeric range constraints.
- `.sort()` / `.sortBy(...)`: Applies order rules (`asc` / `desc`).
- `.paginate()`: **Crucial** — must be invoked to calculate pagination offsets (`skip`, `take`).
- `.select(...)` / `.include(...)` / `.omit(...)`: Applies projection to the query.
- `.execute()`: Runs the Prisma `findMany` query.
- `.countTotal()`: Computes `{ page, limit, total, totalPage }`.

---

### 8. File Uploads

File uploads are handled via Multer interceptors and uploaded to **Cloudinary** (or stored in the `uploads/` directory for local serving).

**Controller Interceptors (`@/common/interceptors/file_interceptors`):**
- Single file: `@UseInterceptors(CustomFileInterceptor("fieldName"), ParseFormDataInterceptor)`
- Multiple files: `@UseInterceptors(CustomFilesInterceptor("fieldName", maxCount), ParseFormDataInterceptor)`
- Multiple named fields:
  ```ts
  @UseInterceptors(
      CustomFileFieldsInterceptor([
          { name: "tradeLicense", maxCount: 1 },
          { name: "nidUrl", maxCount: 1 },
      ]),
      ParseFormDataInterceptor,
  )
  ```

> **IMPORTANT: `ParseFormDataInterceptor`**
> Always add `ParseFormDataInterceptor` (`@/common/interceptors/form_data_interceptor`) when handling form-data requests containing JSON bodies. It unpacks `request.body.data` JSON strings into `request.body`.

**Service File Upload Handling (`@/core/services/files/cloudinary.service`):**
- Inject `FileService` in your service constructor:
  ```ts
  constructor(
      private prisma: PrismaService,
      private fileService: FileService,
  ) {}
  ```
- Upload single file:
  ```ts
  const imageUrl = await this.fileService.uploadToCloudinary(file);
  ```
- Upload multiple files:
  ```ts
  const imageUrls = await this.fileService.uploadMultipleToCloudinary(files);
  ```
- Store the returned secure URL string directly in MongoDB.

---

### 9. Error Handling

- Always throw `ApiError` from `@/common/errors/api_error`:
  ```ts
  throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid request payload");
  ```
- Use the `HttpStatus` enum from `@nestjs/common` for all HTTP status codes:
  - `HttpStatus.BAD_REQUEST` (400)
  - `HttpStatus.UNAUTHORIZED` (401)
  - `HttpStatus.FORBIDDEN` (403)
  - `HttpStatus.NOT_FOUND` (404)
  - `HttpStatus.CONFLICT` (409)
  - `HttpStatus.INTERNAL_SERVER_ERROR` (500)
- **Never use raw numeric status codes** (e.g. `400`, `404`).

---

### 10. Performance & Concurrency

1. **Parallel DB Queries:**
   - Execute independent database queries concurrently using `Promise.all`:
   ```ts
   const [user, orders] = await Promise.all([
       this.prisma.user.findUnique({ where: { id: userId } }),
       this.prisma.order.findMany({ where: { customerId: userId } }),
   ]);
   ```

2. **Two-Level Parallelism for Aggregation Services:**
   - For summary, dashboard, or analytics methods, encapsulate each independent concern in an inline `const` async function that runs its own queries in parallel, then invoke all concerns concurrently:
   ```ts
   async fetchDashboardSummary() {
       const getSalesStats = async () => {
           const [orders, refunds] = await Promise.all([
               this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: "Delivered" } }),
               this.prisma.order.count({ where: { status: "Cancelled" } }),
           ]);
           return { revenue: orders._sum.totalAmount ?? 0, cancellations: refunds };
       };

       const getUserStats = async () => {
           const [producers, buyers, drivers] = await Promise.all([
               this.prisma.user.count({ where: { role: UserRole.PRODUCER } }),
               this.prisma.user.count({ where: { role: UserRole.BUYER } }),
               this.prisma.user.count({ where: { role: UserRole.DRIVER } }),
           ]);
           return { producers, buyers, drivers };
       };

       const [sales, users] = await Promise.all([
           getSalesStats(),
           getUserStats(),
       ]);

       return {
           message: "Dashboard summary retrieved",
           data: { sales, users },
       };
   }
   ```

---

### 11. DTO Structure & Validation

DTOs are defined in `src/modules/<module>/dto/body.dto.ts`.

- **Annotations:**
  - Annotate every field with `class-validator` decorators.
  - Annotate every field with `@ApiProperty` or `@ApiPropertyOptional` for Swagger schema generation.
- **MongoDB ID Validation:** Use `@IsMongoId()` for all ID strings:
  ```ts
  @ApiProperty({ description: "Category ID" })
  @IsMongoId()
  categoryId: string;
  ```
- **Enum Fields:** Always specify the enum type and provide a description listing allowed values:
  ```ts
  @ApiProperty({
      enum: SellingUnit,
      description: `Selling units: ${Object.values(SellingUnit).join(", ")}`,
  })
  @IsEnum(SellingUnit)
  sellingUnit: SellingUnit;
  ```
- **Nested Objects & Arrays:** Use `@ValidateNested()` with `@Type(() => SubDto)`:
  ```ts
  @ApiProperty({ type: [PricingTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierDto)
  pricingTiers: PricingTierDto[];
  ```
- **Query DTOs:**
  - Standard list query DTOs should include optional search, pagination, and sorting fields:
  ```ts
  export class ProductQueryDto {
      @ApiPropertyOptional()
      @IsOptional()
      @IsString()
      search?: string;

      @ApiPropertyOptional({ enum: ["asc", "desc"] })
      @IsOptional()
      @IsEnum(["asc", "desc"])
      order?: "asc" | "desc";

      @ApiPropertyOptional()
      @IsOptional()
      @IsString()
      page?: string;

      @ApiPropertyOptional()
      @IsOptional()
      @IsString()
      limit?: string;
  }
  ```

---

### 12. General Engineering Rules [IMPORTANT]

- **Thin Controllers:** Controllers only map routes, validate DTOs, extract headers/tokens, call services, and wrap the response with `ResponseService.formatResponse`. Zero business logic in controllers.
- **DTOs as Single Source of Truth:** Trust validated DTOs. Do not perform redundant manual re-validations.
- **No Excessive Helper Functions:** Extract functions only when logic is genuinely complex or reused across multiple modules.
- **Avoid `any`:** Maintain strict typing. If `any` is strictly unavoidable, include an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment.
- **Verification Before Completing Tasks:**
  - After making code changes or creating new modules, verify that the project compiles cleanly using `npm.cmd run build` (or `npm run build`).
  - Run `npm.cmd run lint` to fix formatting and lint errors.
  - To regenerate Swagger documentation and Postman collections, run `npm.cmd run g:spec`.
