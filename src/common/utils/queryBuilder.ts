/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import { GetResult, OperationPayload } from "@prisma/client/runtime/library";

export interface NestedFilter {
    field: string;
    filterField: string;
    queryKey: string;
}

export interface rangeFilteringPrams {
    field: string;
    maxQueryKey: string;
    minQueryKey: string;
    dataType: "date" | "number" | "string";
}

type IsEnum<T> = T extends string | number
    ? string extends T
        ? false
        : number extends T
          ? false
          : true
    : false;

type EnumKeys<T> = {
    [K in keyof T]: IsEnum<T[K]> extends true ? K : never;
}[keyof T];

type IsBoolean<T> = T extends boolean
    ? boolean extends T
        ? false
        : true
    : false;

type BooleanKeys<T> = {
    [K in keyof T]: IsBoolean<T[K]> extends true ? K : never;
}[keyof T];

type DateKeys<T> = {
    [K in keyof T]: T[K] extends Date ? K : never;
}[keyof T];

type CleanOptions<TInclude, TSelect, TOmit> = (TInclude extends undefined
    ? {}
    : { include: TInclude }) &
    (TSelect extends undefined ? {} : { select: TSelect }) &
    (TOmit extends undefined ? {} : { omit: TOmit });

type JoinRecords<O, N> = (O extends undefined ? {} : O) & N;

type ExtractField<TArgs, K extends keyof any> = [
    Exclude<TArgs, undefined>,
] extends [{ [P in K]?: infer S }]
    ? S
    : Record<string, any>;

type WithString<T> = Array<Exclude<T, T[] | undefined> | (string & {})>;

// -----------------------------------------------------------------------------
// QueryBuilder
// -----------------------------------------------------------------------------

class QueryBuilder<
    Model extends { findMany: (...args: any) => any },
    TPayload,
    TFindManyArgs = NonNullable<Parameters<Model["findMany"]>[0]>,
    TInclude = undefined,
    TSelect = undefined,
    TOmit = undefined,
> {
    private model: any;

    private query: Record<string, unknown>;

    private prismaQuery: Partial<TFindManyArgs> | any = {};

    private _logQuery = false;

    private readonly queryControlFields = new Set([
        "search",
        "sort",
        "order",
        "limit",
        "page",
        "fields",
        "populate",
        "dateRange",
        "startDate",
        "endDate",
        "minPrice",
        "maxPrice",
    ]);

    /**
     * @template Model
     * Prisma model client, e.g. typeof prisma.user
     *
     * @template TPayload
     * Prisma payload type, e.g. Prisma.$UserPayload
     *
     * @param model
     * Prisma model client
     *
     * @param query
     * Raw query object
     */
    // constructor(model: Model, query: Record<string, unknown>) {
    //     this.model = model;
    //     this.query = query;
    // }

    constructor(model: Model, query?: object) {
        this.model = model;
        this.query = (query ?? {}) as Record<string, unknown>;
    }

    private addAndCondition(condition: Record<string, any>) {
        if (!condition || Object.keys(condition).length === 0) {
            return;
        }

        const where = this.prismaQuery.where ?? {};

        const existingAnd = Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : [];

        const baseWhere = { ...where };

        delete baseWhere.AND;

        this.prismaQuery.where = {
            ...baseWhere,
            AND: [...existingAnd, condition],
        };
    }

    /**
     * Creates nested Prisma object from dot notation.
     *
     * Example:
     *
     * "profile.status"
     *
     * becomes:
     *
     * {
     *     profile: {
     *         status: ...
     *     }
     * }
     */
    private buildNestedCondition(
        field: string,
        value: Record<string, any> | any,
    ) {
        const parts = field.split(".");

        return parts.reduceRight<Record<string, any>>((acc, key, index) => {
            if (index === parts.length - 1) {
                return {
                    [key]: value,
                };
            }

            return {
                [key]: acc,
            };
        }, {});
    }

    /**
     * Returns whether a query value should be treated as empty.
     */
    private isEmptyValue(value: unknown) {
        return value === undefined || value === null || value === "";
    }

    /**
     * Converts a query value into a number safely.
     */
    private parseNumber(value: unknown, key: string): number {
        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
            throw new Error(
                `Invalid numeric query parameter "${key}": "${String(value)}"`,
            );
        }

        return parsed;
    }

    /**
     * Converts a query value into a valid Date.
     */
    private parseDate(value: unknown, key: string): Date {
        const date = new Date(String(value));

        if (Number.isNaN(date.getTime())) {
            throw new Error(
                `Invalid date query parameter "${key}": "${String(value)}"`,
            );
        }

        return date;
    }

    /**
     * Cleans a Prisma where object.
     *
     * Removes empty AND/OR arrays.
     */
    private cleanWhere(where: Record<string, any>) {
        const cleanedWhere = { ...where };

        if (Array.isArray(cleanedWhere.AND)) {
            const cleanedAnd = cleanedWhere.AND.filter(Boolean);

            if (cleanedAnd.length === 0) {
                delete cleanedWhere.AND;
            } else {
                cleanedWhere.AND = cleanedAnd;
            }
        }

        if (Array.isArray(cleanedWhere.OR)) {
            const cleanedOr = cleanedWhere.OR.filter(Boolean);

            if (cleanedOr.length === 0) {
                delete cleanedWhere.OR;
            } else {
                cleanedWhere.OR = cleanedOr;
            }
        }

        return cleanedWhere;
    }

    search(
        fields: TFindManyArgs extends { distinct?: infer T }
            ? WithString<T>
            : string[],
    ) {
        const search = this.query.search;

        if (this.isEmptyValue(search)) {
            return this;
        }

        const searchValue = String(search);

        const conditions = (fields as string[]).map((field) =>
            this.buildNestedCondition(field, {
                contains: searchValue,
                mode: "insensitive",
            }),
        );

        this.addAndCondition({
            OR: conditions,
        });

        return this;
    }

    filter({
        exacts = [],
        booleans = [],
        exclude = [],
    }: {
        exacts?: (
            EnumKeys<Awaited<ReturnType<Model["findMany"]>>[0]> | (string & {})
        )[];

        booleans?: (
            | BooleanKeys<Awaited<ReturnType<Model["findMany"]>>[0]>
            | (string & {})
        )[];

        exclude?: string[];
    } = {}) {
        const queryObj = { ...this.query };

        const excludeFields = new Set([...this.queryControlFields, ...exclude]);

        for (const field of excludeFields) {
            delete queryObj[field];
        }

        const formattedFilters: Record<string, any> = {};

        for (const [field, value] of Object.entries(queryObj)) {
            // Ignore empty values
            if (this.isEmptyValue(value)) {
                continue;
            }

            // null
            if (value === "null") {
                Object.assign(
                    formattedFilters,
                    this.buildNestedCondition(field, null),
                );

                continue;
            }

            // not null
            if (value === "notnull") {
                Object.assign(
                    formattedFilters,
                    this.buildNestedCondition(field, {
                        not: null,
                    }),
                );

                continue;
            }

            // Exact / enum field
            if ((exacts as string[]).includes(field)) {
                Object.assign(
                    formattedFilters,
                    this.buildNestedCondition(field, {
                        equals: value,
                    }),
                );

                continue;
            }

            // Boolean field
            if ((booleans as string[]).includes(field)) {
                if (value !== "true" && value !== "false") {
                    throw new Error(
                        `Invalid boolean query parameter "${field}". Expected "true" or "false".`,
                    );
                }

                Object.assign(
                    formattedFilters,
                    this.buildNestedCondition(field, value === "true"),
                );

                continue;
            }

            // Default string contains filter
            Object.assign(
                formattedFilters,
                this.buildNestedCondition(field, {
                    contains: String(value),
                    mode: "insensitive",
                }),
            );
        }

        if (Object.keys(formattedFilters).length > 0) {
            this.addAndCondition(formattedFilters);
        }

        return this;
    }

    nestedFilter(filters: NestedFilter[]) {
        filters.forEach(({ field, filterField, queryKey }) => {
            const value = this.query[queryKey];

            if (this.isEmptyValue(value)) {
                return;
            }

            const nested = this.buildNestedCondition(field, {
                [filterField]: value,
            });

            this.addAndCondition(nested);
        });

        return this;
    }

    filterByRange(filters: rangeFilteringPrams[]) {
        return this.range(
            filters.map((f) => ({
                field: f.field as any,
                startKey: f.minQueryKey,
                endKey: f.maxQueryKey,
                type: f.dataType,
            })),
        );
    }

    rawArgs(args: Partial<TFindManyArgs>) {
        Object.entries(args).forEach(([key, value]) => {
            if (key === "where" && value) {
                const whereValue = value as Record<string, any>;

                const { AND, OR, ...normalWhere } = whereValue;

                if (Object.keys(normalWhere).length > 0) {
                    this.addAndCondition(normalWhere);
                }

                if (AND) {
                    const conditions = Array.isArray(AND) ? AND : [AND];

                    conditions.forEach((condition) => {
                        this.addAndCondition(condition);
                    });
                }

                if (OR) {
                    this.addAndCondition({
                        OR: Array.isArray(OR) ? OR : [OR],
                    });
                }

                return;
            }

            if (value && typeof value === "object" && !Array.isArray(value)) {
                this.prismaQuery[key] = {
                    ...(this.prismaQuery[key] ?? {}),
                    ...value,
                };
            } else {
                this.prismaQuery[key] = value;
            }
        });

        return this;
    }

    rawFilter(
        filters: TFindManyArgs extends { where?: infer W }
            ? NonNullable<W>
            : Record<string, any>,
    ) {
        if (!filters) {
            return this;
        }

        const filterValue = filters as Record<string, any>;

        const { AND, ...rest } = filterValue;

        if (Object.keys(rest).length > 0) {
            this.addAndCondition(rest);
        }

        if (AND) {
            const conditions = Array.isArray(AND) ? AND : [AND];

            conditions.forEach((condition) => {
                this.addAndCondition(condition);
            });
        }

        return this;
    }

    range(
        filters: {
            field: TFindManyArgs extends { distinct?: infer T }
                ? T | (string & {})
                : string;

            startKey: string;

            endKey: string;

            type: "date" | "number" | "string";
        }[],
    ) {
        filters.forEach(({ field, startKey, endKey, type }) => {
            let minValue = this.query[startKey];

            let maxValue = this.query[endKey];

            // Ignore empty values
            if (this.isEmptyValue(minValue)) {
                minValue = undefined;
            }

            if (this.isEmptyValue(maxValue)) {
                maxValue = undefined;
            }

            // Nothing to filter
            if (minValue === undefined && maxValue === undefined) {
                return;
            }

            // Cast numbers
            if (type === "number") {
                if (minValue !== undefined) {
                    minValue = this.parseNumber(minValue, startKey);
                }

                if (maxValue !== undefined) {
                    maxValue = this.parseNumber(maxValue, endKey);
                }
            }

            // Cast dates
            if (type === "date") {
                if (minValue !== undefined) {
                    minValue = this.parseDate(minValue, startKey);
                }

                if (maxValue !== undefined) {
                    maxValue = this.parseDate(maxValue, endKey);
                }
            }

            const rangeCondition: Record<string, any> = {};

            if (minValue !== undefined) {
                rangeCondition.gte = minValue;
            }

            if (maxValue !== undefined) {
                rangeCondition.lte = maxValue;
            }

            const nestedCondition = this.buildNestedCondition(
                field as string,
                rangeCondition,
            );

            this.addAndCondition(nestedCondition);
        });

        return this;
    }

    rangeDate(
        fields: (
            DateKeys<Awaited<ReturnType<Model["findMany"]>>[0]> | (string & {})
        )[],
    ) {
        const startDate = this.query.startDate;

        const endDate = this.query.endDate;

        const rangeQuery: Record<string, Date> = {};

        if (!this.isEmptyValue(startDate)) {
            rangeQuery.gte = this.parseDate(startDate, "startDate");
        }

        if (!this.isEmptyValue(endDate)) {
            rangeQuery.lte = this.parseDate(endDate, "endDate");
        }

        if (Object.keys(rangeQuery).length === 0) {
            return this;
        }

        const stringFields = fields as string[];

        const conditions = stringFields.map((field) =>
            this.buildNestedCondition(field, rangeQuery),
        );

        this.addAndCondition({
            OR: conditions,
        });

        return this;
    }

    sort() {
        const rawOrder = this.query.order;

        const sort = rawOrder
            ? String(rawOrder).split(",").filter(Boolean)
            : ["-createdAt"];

        if (this.query.sort) {
            sort.push(
                this.query.sort === "newest" ? "-createdAt" : "createdAt",
            );
        }

        const orderBy = sort.reduce<Record<string, "asc" | "desc">>(
            (acc, field) => {
                if (field.startsWith("-")) {
                    acc[field.slice(1)] = "desc";
                } else {
                    acc[field] = "asc";
                }

                return acc;
            },
            {},
        );

        this.prismaQuery.orderBy = orderBy;

        return this;
    }

    sortBy(
        fields: TFindManyArgs extends { orderBy?: infer T }
            ? T
            : Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[],
    ) {
        const existing =
            this.prismaQuery.orderBy && !Array.isArray(this.prismaQuery.orderBy)
                ? this.prismaQuery.orderBy
                : {};

        const nextFields = Array.isArray(fields)
            ? fields.reduce<Record<string, "asc" | "desc">>(
                  (acc, field) => ({
                      ...acc,
                      ...field,
                  }),
                  {},
              )
            : fields;

        this.prismaQuery.orderBy = {
            ...(existing as Record<string, "asc" | "desc">),
            ...(nextFields as Record<string, "asc" | "desc">),
        };

        return this;
    }

    paginate() {
        const page = Math.max(Number(this.query.page) || 1, 1);

        const limit = Math.max(Number(this.query.limit) || 10, 1);

        const skip = (page - 1) * limit;

        this.prismaQuery.skip = skip;

        this.prismaQuery.take = limit;

        return this;
    }

    fields() {
        const rawFields = this.query.fields;

        if (this.isEmptyValue(rawFields)) {
            return this;
        }

        const fields = String(rawFields)
            .split(",")
            .map((field) => field.trim())
            .filter(Boolean);

        if (fields.length === 0) {
            return this;
        }

        this.prismaQuery.select = fields.reduce(
            (acc: Record<string, boolean>, field) => {
                acc[field] = true;

                return acc;
            },
            {},
        );

        return this;
    }

    include<T extends ExtractField<TFindManyArgs, "include">>(
        fields: T,
    ): [TSelect] extends [undefined]
        ? QueryBuilder<
              Model,
              TPayload,
              TFindManyArgs,
              JoinRecords<TInclude, T>,
              TSelect,
              TOmit
          >
        : "Please either choose `select` or `include`" {
        this.prismaQuery.include = {
            ...this.prismaQuery.include,
            ...(fields as Record<string, unknown>),
        };

        return this as any;
    }

    // -------------------------------------------------------------------------
    // Select
    // -------------------------------------------------------------------------

    /**
     * Adds Prisma select fields.
     */
    select<T extends ExtractField<TFindManyArgs, "select">>(
        fields: T,
    ): [TInclude] extends [undefined]
        ? [TOmit] extends [undefined]
            ? QueryBuilder<
                  Model,
                  TPayload,
                  TFindManyArgs,
                  TInclude,
                  JoinRecords<TSelect, T>,
                  TOmit
              >
            : "Please either choose `select` or `omit`"
        : "Please either choose `select` or `include`" {
        this.prismaQuery.select = {
            ...this.prismaQuery.select,
            ...(fields as Record<string, unknown>),
        };

        return this as any;
    }

    omit<T extends ExtractField<TFindManyArgs, "omit">>(
        fields: T,
    ): [TSelect] extends [undefined]
        ? QueryBuilder<
              Model,
              TPayload,
              TFindManyArgs,
              TInclude,
              TSelect,
              JoinRecords<TOmit, T>
          >
        : "Please either choose `select` or `omit`" {
        this.prismaQuery.omit = {
            ...this.prismaQuery.omit,
            ...(fields as Record<string, unknown>),
        };

        return this as any;
    }

    async execute(
        extraOptions: TFindManyArgs extends {
            [key: string]: any;
        }
            ? TFindManyArgs
            : Record<string, any> = {} as any,
    ): Promise<
        TPayload extends OperationPayload
            ? GetResult<
                  TPayload,
                  CleanOptions<TInclude, TSelect, TOmit>,
                  "findMany"
              >
            : any[]
    > {
        const query = this.cleanQuery(this.prismaQuery);

        const options = extraOptions as Record<string, any>;

        let finalQuery = {
            ...query,
            ...options,
        };

        // Safely merge extra where
        if (options.where) {
            const builderWhere = query.where ?? {};

            const { AND, ...normalExtraWhere } = options.where;

            const existingAnd = Array.isArray(builderWhere.AND)
                ? builderWhere.AND
                : builderWhere.AND
                  ? [builderWhere.AND]
                  : [];

            const extraAnd = AND ? (Array.isArray(AND) ? AND : [AND]) : [];

            finalQuery = {
                ...finalQuery,

                where: {
                    ...builderWhere,
                    ...normalExtraWhere,

                    AND: [...existingAnd, ...extraAnd],
                },
            };
        }

        finalQuery = this.cleanQuery(finalQuery);

        return this.model.findMany(finalQuery);
    }

    async countTotal(): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPage: number;
    }> {
        const query = this.cleanQuery(this.prismaQuery);

        if (this._logQuery) {
            console.log(JSON.stringify(query, null, 4));
        }

        const total = await this.model.count({
            where: query.where,
        });

        const page = Math.max(Number(this.query.page) || 1, 1);

        const limit = Math.max(Number(this.query.limit) || 10, 1);

        const totalPage = Math.ceil(total / limit);

        return {
            page,
            limit,
            total,
            totalPage,
        };
    }

    logQuery() {
        this._logQuery = true;

        return this;
    }

    getQuery() {
        return this.cleanQuery(this.prismaQuery);
    }

    private cleanQuery(query: Record<string, any>) {
        if (!query.where) {
            return query;
        }

        const cleanedWhere = this.cleanWhere(query.where);

        return {
            ...query,
            where: cleanedWhere,
        };
    }
}

export default QueryBuilder;
