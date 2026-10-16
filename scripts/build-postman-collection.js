const fs = require("fs");
const path = require("path");

const crypto = require("crypto");

// Helper to generate deterministic UUIDs
function uuid(seed) {
    if (!seed) {
        seed = Math.random().toString();
    }
    const hash = crypto.createHash("md5").update(String(seed)).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Helper to construct request url object
function makeUrl(pathSegments, queryParams = [], useServerUrl = false) {
    const host = useServerUrl ? ["{{serverUrl}}"] : ["{{baseUrl}}"];
    const query = (queryParams || []).map((q) => ({
        key: q.key,
        value: q.value !== undefined ? String(q.value) : "",
        description: q.description || "",
        disabled: q.disabled !== undefined ? q.disabled : false,
    }));

    const cleanSegments = pathSegments.filter((p) => p !== "");
    const rawHost = useServerUrl ? "{{serverUrl}}" : "{{baseUrl}}";
    const rawPath = cleanSegments.length ? "/" + cleanSegments.join("/") : "";
    const queryString = query.length
        ? "?" + query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join("&")
        : "";

    return {
        raw: `${rawHost}${rawPath}${queryString}`,
        host: host,
        path: cleanSegments,
        query: query,
    };
}

// Helper to create a request definition
function createRequest({
    name,
    method,
    pathSegments,
    description = "",
    headers = [],
    queryParams = [],
    body = null,
    isPublic = false,
    useServerUrl = false,
    event = [],
}) {
    const finalHeaders = [...headers];
    if (body && body.mode === "raw") {
        if (!finalHeaders.some((h) => h.key.toLowerCase() === "content-type")) {
            finalHeaders.push({
                key: "Content-Type",
                value: "application/json",
            });
        }
    }

    return {
        name,
        request: {
            method,
            header: finalHeaders,
            body: body,
            url: makeUrl(pathSegments, queryParams, useServerUrl),
            description: description,
            auth: isPublic
                ? {
                      type: "noauth",
                  }
                : null, // Inherits bearer from collection
        },
        response: [],
        event: event,
    };
}

// Helper to create a response example
function createResponseExample({
    name,
    originalRequest,
    statusCode = 200,
    statusText = "OK",
    bodyObj,
    headers = [{ key: "Content-Type", value: "application/json" }],
}) {
    const bodyStr = typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj, null, 2);
    const reqMethod = originalRequest?.method || "GET";
    const reqUrl = originalRequest?.url?.raw || "";
    const seed = `${reqMethod}_${reqUrl}_${name}_${statusCode}`;

    return {
        id: uuid(seed),
        name,
        originalRequest: {
            method: originalRequest.method,
            header: originalRequest.header,
            url: originalRequest.url,
            body: originalRequest.body,
        },
        status: statusText,
        code: statusCode,
        _postman_previewlanguage: "json",
        header: headers,
        cookie: [],
        body: bodyStr,
    };
}

// Helper to add responses to item
function withExamples(item, examples) {
    item.response = examples.map((ex) =>
        createResponseExample({
            name: ex.name,
            originalRequest: item.request,
            statusCode: ex.statusCode || 200,
            statusText: ex.statusText || "OK",
            bodyObj: ex.body,
        }),
    );
    return item;
}

// --- DEFINE ALL FOLDERS AND REQUESTS ---

// 1. SYSTEM
const systemRequests = [
    withExamples(
        createRequest({
            name: "Health Check",
            method: "GET",
            pathSegments: [],
            useServerUrl: true,
            isPublic: true,
            description:
                "### Server Health Check\nChecks whether the Argo Connect backend server is active and running.\n\n- **Authentication:** Public (None)\n- **Endpoint:** `GET /`",
        }),
        [
            {
                name: "200 OK - Server Active",
                body: {
                    success: true,
                    message: "El Psy Congroo!",
                    server_name: "argo_connect",
                    server_type: "WEB",
                },
            },
        ],
    ),
];

// 2. AUTH MODULE
const authRequests = [
    withExamples(
        createRequest({
            name: "Register User",
            method: "POST",
            pathSegments: ["auth", "register"],
            isPublic: true,
            description:
                "### Register User\nRegisters a new user (BUYER, DRIVER, or PRODUCER) and dispatches a 6-digit OTP code to the provided email.\n\n- **Authentication:** Public\n- **Role Supported:** `BUYER`, `DRIVER`, `PRODUCER`\n\n### Request Body Fields:\n- `fullName`: Full name of user (Required)\n- `email`: Valid email address (Required)\n- `password`: Strong password string (Required)\n- `role`: One of `BUYER`, `DRIVER`, `PRODUCER` (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        fullName: "Alice Cooper",
                        email: "alice.buyer@example.com",
                        password: "Password123!",
                        role: "BUYER",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Verification Code Sent",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Verification code sent to your email",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Verify Registration",
            method: "POST",
            pathSegments: ["auth", "verify-registration"],
            isPublic: true,
            description:
                "### Verify Registration\nVerifies the 6-digit OTP sent to the user's email during registration, creating the verified user account.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `email`: Registered email address (Required)\n- `otp`: 6-digit verification OTP (Required)\n- `fcmToken`: Firebase Cloud Messaging device push token // optional",
            body: {
                mode: "raw",
                raw: "{\n  \"email\": \"alice.buyer@example.com\",\n  \"otp\": \"123456\",\n  \"fcmToken\": \"dKj48_fake_fcm_token_device_string_xyz\" // optional\n}",
                options: { raw: { language: "json" } },
            },
            event: [
                {
                    listen: "test",
                    script: {
                        type: "text/javascript",
                        exec: [
                            "if (pm.response.code === 200) {",
                            "    var jsonData = pm.response.json();",
                            "    if (jsonData.data && jsonData.data.accessToken) {",
                            "        pm.collectionVariables.set('accessToken', jsonData.data.accessToken);",
                            "        console.log('Access token updated from verify registration');",
                            "    }",
                            "}",
                        ],
                    },
                },
            ],
        }),
        [
            {
                name: "200 OK - Verified Successfully (Buyer)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Verified successfully! Please complete your profile to start buying.",
                    data: {
                        id: "672f10b7e21a224a5b112233",
                        role: "BUYER",
                        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MmYxMGI3ZTIxYTIyNGE1YjExMjIzMyIsImVtYWlsIjoiYWxpY2UuYnV5ZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiQlVZRVIifQ.sample_jwt_token",
                    },
                },
            },
            {
                name: "200 OK - Verified Successfully (Producer)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Verified successfully! Please complete your profile to start selling.",
                    data: {
                        id: "672f10b7e21a224a5b112234",
                        role: "PRODUCER",
                        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MmYxMGI3ZTIxYTIyNGE1YjExMjIzNCIsImVtYWlsIjoicHJvZHVjZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiUFJPRFVRRVIifQ.sample_jwt_token",
                    },
                },
            },
            {
                name: "400 Bad Request - OTP Expired",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "OTP expired",
                },
            },
            {
                name: "403 Forbidden - Incorrect OTP",
                statusCode: 403,
                statusText: "Forbidden",
                body: {
                    success: false,
                    statusCode: 403,
                    message: "Incorrect OTP",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Login User",
            method: "POST",
            pathSegments: ["auth", "login"],
            isPublic: true,
            description:
                "### Login User\nAuthenticates user credentials and returns a signed JWT access token. Automatically stores `accessToken` into collection variables.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `email`: Registered email (Required)\n- `password`: Account password (Required)\n- `fcmToken`: Firebase device token for push notifications // optional",
            body: {
                mode: "raw",
                raw: "{\n  \"email\": \"alice.buyer@example.com\",\n  \"password\": \"Password123!\",\n  \"fcmToken\": \"dKj48_fake_fcm_token_device_string_xyz\" // optional\n}",
                options: { raw: { language: "json" } },
            },
            event: [
                {
                    listen: "test",
                    script: {
                        type: "text/javascript",
                        exec: [
                            "if (pm.response.code === 200) {",
                            "    var jsonData = pm.response.json();",
                            "    if (jsonData.data && jsonData.data.accessToken) {",
                            "        pm.collectionVariables.set('accessToken', jsonData.data.accessToken);",
                            "        console.log('Access token successfully set to collection variable: accessToken');",
                            "    }",
                            "}",
                        ],
                    },
                },
            ],
        }),
        [
            {
                name: "200 OK - Login Success (Setup Completed)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Login successful",
                    data: {
                        accessToken:
                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MmYxMGI3ZTIxYTIyNGFiMTExMjIzMyIsImVtYWlsIjoiYWxpY2UuYnV5ZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiQlVZRVItemF0IjoxNzI4ODkwMDAwLCJleHAiOjE3Mjk0OTQ4MDB9.sampleSignature",
                        role: "BUYER",
                        isSetuCompleted: true,
                    },
                },
            },
            {
                name: "200 OK - Login Success (Setup Incomplete)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Login successful",
                    data: {
                        accessToken:
                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MmYxMGI3ZTIxYTIyNGFiMTExMjIzNCIsImVtYWlsIjoicHJvZHVjZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiUFJPRFVRRVIiLCJpYXQiOjE3Mjg4OTAwMDAsImV4cCI6MTcyOTQ5NDgwMH0.sampleSignature",
                        role: "PRODUCER",
                        isSetuCompleted: false,
                    },
                },
            },
            {
                name: "401 Unauthorized - Invalid Credentials",
                statusCode: 401,
                statusText: "Unauthorized",
                body: {
                    success: false,
                    statusCode: 401,
                    message: "Invalid Credentials",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Send Forgot Password OTP",
            method: "POST",
            pathSegments: ["auth", "send-otp", "password-reset"],
            isPublic: true,
            description:
                "### Forgot Password OTP\nSends a 6-digit password reset OTP to the specified user email address.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `email`: User registered email address (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        email: "alice.buyer@example.com",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - OTP Sent",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "OTP Sent Successfully!",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Verify Forgot Password OTP",
            method: "POST",
            pathSegments: ["auth", "verify-otp", "password-reset"],
            isPublic: true,
            description:
                "### Verify Password Reset OTP\nValidates the OTP received by email for resetting forgotten password. Returns an authorized temporary access token to reset password.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `email`: User registered email (Required)\n- `otp`: 6-digit OTP code (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        email: "alice.buyer@example.com",
                        otp: "654321",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
            event: [
                {
                    listen: "test",
                    script: {
                        type: "text/javascript",
                        exec: [
                            "if (pm.response.code === 200) {",
                            "    var jsonData = pm.response.json();",
                            "    if (jsonData.data && jsonData.data.accessToken) {",
                            "        pm.collectionVariables.set('accessToken', jsonData.data.accessToken);",
                            "        console.log('Temporary reset token saved to accessToken variable');",
                            "    }",
                            "}",
                        ],
                    },
                },
            ],
        }),
        [
            {
                name: "200 OK - OTP Verified",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "OTP Verification successful",
                    data: {
                        accessToken:
                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tempResetTokenPayload.sampleSignature",
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Reset Password",
            method: "POST",
            pathSegments: ["auth", "reset-password"],
            description:
                "### Reset Password\nSets a new password for the account using the bearer token obtained from verifying forgot password OTP.\n\n- **Authentication:** Bearer Token (Authenticated)\n\n### Request Body Fields:\n- `password`: New password string (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        password: "NewSecurePassword456!",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Password Reset Successful",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Password Reset successful",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Change Password",
            method: "POST",
            pathSegments: ["auth", "change-password"],
            description:
                "### Change Password\nAllows an authenticated user to change their current password by providing the old password and the new password.\n\n- **Authentication:** Bearer Token (Authenticated)\n\n### Request Body Fields:\n- `oldPassword`: Current password (Required)\n- `newPassword`: New replacement password (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        oldPassword: "Password123!",
                        newPassword: "BrandNewPassword789!",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Password Changed",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Password Changed successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Refresh Access Token",
            method: "POST",
            pathSegments: ["auth", "refresh-token"],
            isPublic: true,
            description:
                "### Refresh Access Token\nIssues a fresh access token using a valid JWT refresh token.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `refreshToken`: Valid JWT refresh token string (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        refreshToken:
                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validRefreshTokenPayload.sampleSignature",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
            event: [
                {
                    listen: "test",
                    script: {
                        type: "text/javascript",
                        exec: [
                            "if (pm.response.code === 200) {",
                            "    var jsonData = pm.response.json();",
                            "    if (jsonData.data && jsonData.data.accessToken) {",
                            "        pm.collectionVariables.set('accessToken', jsonData.data.accessToken);",
                            "        console.log('Refreshed accessToken saved to variable');",
                            "    }",
                            "}",
                        ],
                    },
                },
            ],
        }),
        [
            {
                name: "200 OK - Token Refreshed",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Access Token generated",
                    data: {
                        accessToken:
                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshedAccessTokenPayload.sampleSignature",
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Create Producer Profile",
            method: "POST",
            pathSegments: ["auth", "create-producer-profile"],
            description:
                "### Create Producer Profile (Multipart)\nUploads required legal and verification documents and registers the producer profile.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **Body Mode:** `form-data`\n\n### File Fields:\n- `nidUrl`: National Identity card file (Required for all producers)\n- `landCertificate`: Land ownership certificate file (Required for `Private` producerType) // optional for Company\n- `farmPhotoUrl`: Photograph of the farm/field (Required for `Private` producerType) // optional for Company\n- `companyCertificate`: Company registration certificate file (Required for `Company` producerType) // optional for Private\n- `rcmUrl`: RCM certificate document file (Required for `Company` producerType) // optional for Private\n- `taxUrl`: Tax declaration document file (Required for `Company` producerType) // optional for Private\n\n### Text Fields:\n- `phoneNumber`: Phone number with country code (Required)\n- `producerType`: `Private` or `Company` (Required)\n- `city`: City location (Required)\n- `region`: Province or administrative region (Required)\n- `address`: Detailed physical address (Required)\n- `farmName`: Name of the farm or agricultural enterprise (Required)\n- `farmSize`: Size of farm in hectares (Required)\n- `farmLocation`: GPS/geographic location description (Required)\n- `companyName`: Registered corporate name // optional (Required if Company)\n- `rccmNo`: RCCM business registry number // optional (Required if Company)\n- `sirenNo`: SIREN registry number // optional (Required if Company)",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "nidUrl",
                        type: "file",
                        src: [],
                        description: "National ID Document (PDF, JPG, PNG) (Required)",
                    },
                    {
                        key: "landCertificate",
                        type: "file",
                        src: [],
                        description:
                            "Land Ownership Certificate // optional for Company, required for Private",
                    },
                    {
                        key: "farmPhotoUrl",
                        type: "file",
                        src: [],
                        description:
                            "Farm Field Photo // optional for Company, required for Private",
                    },
                    {
                        key: "companyCertificate",
                        type: "file",
                        src: [],
                        description:
                            "Company Certificate // optional for Private, required for Company",
                    },
                    {
                        key: "rcmUrl",
                        type: "file",
                        src: [],
                        description:
                            "RCM Document // optional for Private, required for Company",
                    },
                    {
                        key: "taxUrl",
                        type: "file",
                        src: [],
                        description:
                            "Tax Declaration Document // optional for Private, required for Company",
                    },
                    {
                        key: "phoneNumber",
                        value: "+2250702030405",
                        type: "text",
                        description: "Phone number (Required)",
                    },
                    {
                        key: "producerType",
                        value: "Private",
                        type: "text",
                        description: "'Private' or 'Company' (Required)",
                    },
                    {
                        key: "city",
                        value: "Bouake",
                        type: "text",
                        description: "City (Required)",
                    },
                    {
                        key: "region",
                        value: "Vallee du Bandama",
                        type: "text",
                        description: "Region (Required)",
                    },
                    {
                        key: "address",
                        value: "Route de Tiassale, Km 14",
                        type: "text",
                        description: "Physical address (Required)",
                    },
                    {
                        key: "farmName",
                        value: "Traore Organic Cashew & Mango Farm",
                        type: "text",
                        description: "Farm name (Required)",
                    },
                    {
                        key: "farmSize",
                        value: "12.5",
                        type: "text",
                        description: "Farm size in hectares (Required)",
                    },
                    {
                        key: "farmLocation",
                        value: "North Bouake District 4",
                        type: "text",
                        description: "Farm location details (Required)",
                    },
                    {
                        key: "companyName",
                        value: "Traore Agri-Enterprises SARL",
                        type: "text",
                        description: "companyName // optional",
                    },
                    {
                        key: "rccmNo",
                        value: "CI-ABJ-2024-B-12345",
                        type: "text",
                        description: "rccmNo // optional",
                    },
                    {
                        key: "sirenNo",
                        value: "987654321",
                        type: "text",
                        description: "sirenNo // optional",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Private Producer Profile Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer profile created successfully",
                },
            },
            {
                name: "200 OK - Company Producer Profile Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer profile created successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Producer Profile",
            method: "PUT",
            pathSegments: ["auth", "update-producer-profile"],
            description:
                "### Update Producer Profile (Multipart)\nUpdates existing producer farm details and replaces uploaded certificate documents if new files are attached.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **Body Mode:** `form-data`\n\n### Fields (All Optional):\n- `nidUrl`: Replacement NID file // optional\n- `landCertificate`: Replacement land certificate file // optional\n- `farmPhotoUrl`: Replacement farm photo // optional\n- `companyCertificate`: Replacement company cert // optional\n- `rcmUrl`: Replacement RCM file // optional\n- `taxUrl`: Replacement tax cert file // optional\n- `farmName`: Updated farm name // optional\n- `farmSize`: Updated farm size in hectares // optional\n- `farmLocation`: Updated location details // optional\n- `companyName`: Updated company name // optional\n- `rccmNo`: Updated RCCM number // optional\n- `sirenNo`: Updated SIREN number // optional",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "landCertificate",
                        type: "file",
                        src: [],
                        description: "landCertificate // optional",
                    },
                    {
                        key: "farmPhotoUrl",
                        type: "file",
                        src: [],
                        description: "farmPhotoUrl // optional",
                    },
                    {
                        key: "companyCertificate",
                        type: "file",
                        src: [],
                        description: "companyCertificate // optional",
                    },
                    {
                        key: "rcmUrl",
                        type: "file",
                        src: [],
                        description: "rcmUrl // optional",
                    },
                    {
                        key: "taxUrl",
                        type: "file",
                        src: [],
                        description: "taxUrl // optional",
                    },
                    {
                        key: "nidUrl",
                        type: "file",
                        src: [],
                        description: "nidUrl // optional",
                    },
                    {
                        key: "farmName",
                        value: "Traore Agro-Industrial Green Fields",
                        type: "text",
                        description: "farmName // optional",
                    },
                    {
                        key: "farmSize",
                        value: "15.0",
                        type: "text",
                        description: "farmSize // optional",
                    },
                    {
                        key: "farmLocation",
                        value: "Bouake Agro Tech Valley",
                        type: "text",
                        description: "farmLocation // optional",
                    },
                    {
                        key: "companyName",
                        value: "Traore Global Agro Ltd",
                        type: "text",
                        description: "companyName // optional",
                    },
                    {
                        key: "rccmNo",
                        value: "CI-ABJ-2026-B-99887",
                        type: "text",
                        description: "rccmNo // optional",
                    },
                    {
                        key: "sirenNo",
                        value: "123456789",
                        type: "text",
                        description: "sirenNo // optional",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Producer Profile Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer profile updated successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Create Driver Profile",
            method: "POST",
            pathSegments: ["auth", "create-driver-profile"],
            description:
                "### Create Driver Profile (Multipart)\nUploads required vehicle photo, identity, and licensing documents and creates driver profile.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n- **Body Mode:** `form-data`\n\n### File Fields (All Required):\n- `vehiclePhotoUrl`: Official photo of the driver's vehicle (Required)\n- `nidUrl`: National Identity card document (Required)\n- `drivingLicenseUrl`: Valid driver's license document (Required)\n- `vehicleRegistrationUrl`: Official vehicle registration document (Required)\n- `insuranceUrl`: Active insurance policy certificate (Required)\n- `policeClearanceUrl`: Police record clearance document (Required)\n\n### Text Fields:\n- `phoneNumber`: Valid phone number (Required)\n- `city`: Operating city (Required)\n- `region`: Operating region (Required)\n- `address`: Home or depot address (Required)\n- `vehicleType`: Enum: `BIKE`, `MOTORCYCLE`, `THREE_WHEELER`, `VAN`, `TRUCK`, `PICKUP` (Required)\n- `registrationNumber`: Official license plate number (Required)\n- `model`: Vehicle make and model (Required)\n- `year`: Manufacturing year between 1900 and 2026 (Required)\n- `vehicleColor`: Exterior color of vehicle (Required)",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "vehiclePhotoUrl",
                        type: "file",
                        src: [],
                        description: "Vehicle Photo (Required)",
                    },
                    {
                        key: "drivingLicenseUrl",
                        type: "file",
                        src: [],
                        description: "Driver's License (Required)",
                    },
                    {
                        key: "vehicleRegistrationUrl",
                        type: "file",
                        src: [],
                        description: "Vehicle Registration Document (Required)",
                    },
                    {
                        key: "insuranceUrl",
                        type: "file",
                        src: [],
                        description: "Vehicle Insurance Certificate (Required)",
                    },
                    {
                        key: "policeClearanceUrl",
                        type: "file",
                        src: [],
                        description: "Police Clearance Certificate (Required)",
                    },
                    {
                        key: "nidUrl",
                        type: "file",
                        src: [],
                        description: "National ID Card Document (Required)",
                    },
                    {
                        key: "phoneNumber",
                        value: "+2250703040506",
                        type: "text",
                        description: "Phone number (Required)",
                    },
                    {
                        key: "city",
                        value: "Abidjan",
                        type: "text",
                        description: "City (Required)",
                    },
                    {
                        key: "region",
                        value: "Lagunes",
                        type: "text",
                        description: "Region (Required)",
                    },
                    {
                        key: "address",
                        value: "Yopougon Sideci, Rue 12",
                        type: "text",
                        description: "Residential or Depot address (Required)",
                    },
                    {
                        key: "vehicleType",
                        value: "VAN",
                        type: "text",
                        description:
                            "One of: BIKE, MOTORCYCLE, THREE_WHEELER, VAN, TRUCK, PICKUP (Required)",
                    },
                    {
                        key: "registrationNumber",
                        value: "1234-AB-01",
                        type: "text",
                        description: "Vehicle license plate registration (Required)",
                    },
                    {
                        key: "model",
                        value: "Toyota HiAce",
                        type: "text",
                        description: "Vehicle Model and Make (Required)",
                    },
                    {
                        key: "year",
                        value: "2022",
                        type: "text",
                        description: "Manufacturing Year 1900-2026 (Required)",
                    },
                    {
                        key: "vehicleColor",
                        value: "White",
                        type: "text",
                        description: "Vehicle exterior color (Required)",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Driver Profile Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver profile created successfully",
                },
            },
            {
                name: "400 Bad Request - Missing Required Documents",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "Vehicle photo, NID, driving license, vehicle registration, insurance, and police clearance documents are required for Driver profile",
                },
            },
            {
                name: "409 Conflict - Profile Already Exists",
                statusCode: 409,
                statusText: "Conflict",
                body: {
                    success: false,
                    statusCode: 409,
                    message: "Driver profile already exists!",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Driver Profile",
            method: "PUT",
            pathSegments: ["auth", "update-driver-profile"],
            description:
                "### Update Driver Profile (Multipart)\nUpdates vehicle details and documents for the authenticated driver.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n- **Body Mode:** `form-data`\n\n### Fields (All Optional):\n- `vehiclePhotoUrl`: Replacement vehicle photo file // optional\n- `drivingLicenseUrl`: Replacement license file // optional\n- `vehicleRegistrationUrl`: Replacement registration file // optional\n- `insuranceUrl`: Replacement insurance file // optional\n- `policeClearanceUrl`: Replacement police clearance file // optional\n- `nidUrl`: Replacement NID file // optional\n- `vehicleType`: Updated vehicle type enum // optional\n- `registrationNumber`: Updated license plate // optional\n- `model`: Updated vehicle model // optional\n- `year`: Updated manufacturing year // optional\n- `vehicleColor`: Updated vehicle color // optional\n- `phoneNumber`: Updated phone number // optional\n- `city`: Updated city // optional\n- `region`: Updated region // optional\n- `address`: Updated address // optional",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "vehiclePhotoUrl",
                        type: "file",
                        src: [],
                        description: "vehiclePhotoUrl // optional",
                    },
                    {
                        key: "drivingLicenseUrl",
                        type: "file",
                        src: [],
                        description: "drivingLicenseUrl // optional",
                    },
                    {
                        key: "vehicleRegistrationUrl",
                        type: "file",
                        src: [],
                        description: "vehicleRegistrationUrl // optional",
                    },
                    {
                        key: "insuranceUrl",
                        type: "file",
                        src: [],
                        description: "insuranceUrl // optional",
                    },
                    {
                        key: "policeClearanceUrl",
                        type: "file",
                        src: [],
                        description: "policeClearanceUrl // optional",
                    },
                    {
                        key: "nidUrl",
                        type: "file",
                        src: [],
                        description: "nidUrl // optional",
                    },
                    {
                        key: "vehicleType",
                        value: "TRUCK",
                        type: "text",
                        description: "vehicleType // optional",
                    },
                    {
                        key: "registrationNumber",
                        value: "5678-CD-01",
                        type: "text",
                        description: "registrationNumber // optional",
                    },
                    {
                        key: "model",
                        value: "Mercedes Sprinter",
                        type: "text",
                        description: "model // optional",
                    },
                    {
                        key: "year",
                        value: "2023",
                        type: "text",
                        description: "year // optional",
                    },
                    {
                        key: "vehicleColor",
                        value: "Blue",
                        type: "text",
                        description: "vehicleColor // optional",
                    },
                    {
                        key: "phoneNumber",
                        value: "+2250703040599",
                        type: "text",
                        description: "phoneNumber // optional",
                    },
                    {
                        key: "city",
                        value: "Abidjan",
                        type: "text",
                        description: "city // optional",
                    },
                    {
                        key: "region",
                        value: "Lagunes",
                        type: "text",
                        description: "region // optional",
                    },
                    {
                        key: "address",
                        value: "Koumassi Boulevard du 7 Decembre",
                        type: "text",
                        description: "address // optional",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Driver Profile Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver profile updated successfully",
                },
            },
            {
                name: "404 Not Found - Driver Profile Not Found",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Driver profile not found",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Create Buyer Profile",
            method: "POST",
            pathSegments: ["auth", "create-buyer-profile"],
            description:
                "### Create Buyer Profile\nRegisters profile details for a buyer user account.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `phoneNumber`: Phone number with country code (Required)\n- `city`: City (Required)\n- `region`: Region / State (Required)\n- `address`: Detailed shipping / business address (Required)\n- `profileType`: Buyer business classification e.g. 'Wholesale Distributor', 'Supermarket', 'Individual' (Required)\n- `institution`: Institution or corporate trading name (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        phoneNumber: "+2250701020304",
                        city: "Abidjan",
                        region: "Lagunes",
                        address: "Plateau, Boulevard Carde, Immeuble Alpha",
                        profileType: "Supermarket Chain",
                        institution: "Ivoire Fresh Market Group",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Buyer Profile Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Buyer profile created successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update User Profile",
            method: "PUT",
            pathSegments: ["auth", "update-profile"],
            description:
                "### Update General User Profile (Multipart)\nUpdates name, contact info, address, and profile picture avatar for any registered user.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`, `PRODUCER`, `BUYER`)\n- **Body Mode:** `form-data`\n\n### Fields:\n- `profileImage`: Avatar image file (PNG, JPG, WEBP) // optional\n- `fullName`: Updated user full name // optional\n- `phoneNumber`: Updated phone number in international format // optional\n- `city`: Updated city // optional\n- `region`: Updated administrative region // optional\n- `address`: Updated address line // optional",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "profileImage",
                        type: "file",
                        src: [],
                        description: "profileImage // optional",
                    },
                    {
                        key: "fullName",
                        value: "Alice Cooper Updated",
                        type: "text",
                        description: "fullName // optional",
                    },
                    {
                        key: "phoneNumber",
                        value: "+2250701020399",
                        type: "text",
                        description: "phoneNumber // optional",
                    },
                    {
                        key: "city",
                        value: "Abidjan",
                        type: "text",
                        description: "city // optional",
                    },
                    {
                        key: "region",
                        value: "Lagunes",
                        type: "text",
                        description: "region // optional",
                    },
                    {
                        key: "address",
                        value: "Marcory Zone 4C, Rue Pierre et Marie Curie",
                        type: "text",
                        description: "address // optional",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Profile Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Profile updated successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get User Profile",
            method: "GET",
            pathSegments: ["auth", "profile"],
            description:
                "### Get User Profile\nFetches complete personal profile details, account status, and role-specific profile information (BuyerProfile, ProducerProfile, or DriverProfile).\n\n- **Authentication:** Bearer Token (Role: `DRIVER`, `PRODUCER`, `BUYER`)",
        }),
        [
            {
                name: "200 OK - Buyer Profile Details",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "User profile fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112233",
                        fullName: "Alice Cooper",
                        email: "alice.buyer@example.com",
                        profileImage:
                            "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                        role: "BUYER",
                        status: "ACTIVE",
                        driverProfile: false,
                        producerProfile: false,
                        buyerProfile: {
                            phoneNumber: "+2250701020304",
                            address: "Plateau, Boulevard Carde",
                            city: "Abidjan",
                            region: "Lagunes",
                            institution: "Ivoire Fresh Market Group",
                            profileType: "Supermarket Chain",
                        },
                    },
                },
            },
            {
                name: "200 OK - Producer Profile Details",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "User profile fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112234",
                        fullName: "Amadou Traore",
                        email: "amadou.producer@example.com",
                        profileImage:
                            "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                        role: "PRODUCER",
                        status: "ACTIVE",
                        driverProfile: false,
                        producerProfile: {
                            verificationStatus: "Accepted",
                            phoneNumber: "+2250702030405",
                            address: "Route de Tiassale, Km 14",
                            city: "Bouake",
                            region: "Vallee du Bandama",
                        },
                        buyerProfile: false,
                    },
                },
            },
            {
                name: "200 OK - Driver Profile Details",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "User profile fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112235",
                        fullName: "Kouame Koffi",
                        email: "kouame.driver@example.com",
                        profileImage:
                            "https://res.cloudinary.com/demo/image/upload/v12345/kouame.jpg",
                        role: "DRIVER",
                        status: "ACTIVE",
                        driverProfile: {
                            verificationStatus: "Accepted",
                            phoneNumber: "+2250703040506",
                            address: "Yopougon Sideci, Rue 12",
                            city: "Abidjan",
                            region: "Lagunes",
                        },
                        producerProfile: false,
                        buyerProfile: false,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Driver Home Data",
            method: "GET",
            pathSegments: ["auth", "driver-home-data"],
            description:
                "### Driver Home Dashboard Data\nFetches real-time driver profile data including total earnings, current balance, ratings, availability status, and recent deliveries.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)",
        }),
        [
            {
                name: "200 OK - Driver Home Data Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver home data fetched successfully",
                    data: {
                        user: {
                            id: "672f10b7e21a224a5b112235",
                            fullName: "Koffi Mensah",
                            profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/driver.jpg",
                            deliveries: [
                                {
                                    id: "672f10b7e21a224a5b112295",
                                    orderId: "672f10b7e21a224a5b112280",
                                    status: "InTransit",
                                    createdAt: "2026-10-15T08:00:00.000Z",
                                    order: {
                                        totalAmount: 15000,
                                        shippingAddress: {
                                            addressLine: "Marcory Zone 4, Rue du 7 Decembre",
                                            city: "Abidjan",
                                        },
                                    },
                                },
                            ],
                            _count: {
                                deliveries: 48,
                                notifications: 3,
                            },
                        },
                        allTimeEarnings: 124500,
                        avgRating: 4.8,
                        totalReviews: 39,
                        currentEarnings: 34500,
                        isAvailable: true,
                    },
                },
            },
            {
                name: "200 OK - New Driver (Zero Deliveries)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver home data fetched successfully",
                    data: {
                        user: {
                            id: "672f10b7e21a224a5b112239",
                            fullName: "Jean Kouassi",
                            profileImage: null,
                            deliveries: [],
                            _count: {
                                deliveries: 0,
                                notifications: 0,
                            },
                        },
                        allTimeEarnings: 0,
                        avgRating: 0,
                        totalReviews: 0,
                        currentEarnings: 0,
                        isAvailable: false,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Producer Home Data",
            method: "GET",
            pathSegments: ["auth", "producer-home-data"],
            description:
                "### Producer Home Dashboard Data\nFetches active statistics for producer dashboard including verification status, all-time earnings, top catalog products, and counts of active orders and unread alerts.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)",
        }),
        [
            {
                name: "200 OK - Producer Home Data Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer home data fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112234",
                        fullName: "Amadou Traore",
                        profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                        producerProfile: {
                            verificationStatus: "Accepted",
                            allTimeEarnings: 385000,
                        },
                        products: [
                            {
                                id: "672f10b7e21a224a5b112240",
                                name: "Organic Kent Mangoes",
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                                sellingUnit: "CRATE",
                                availableQuantity: 150,
                                sold: 85,
                                avgRating: 4.9,
                                category: {
                                    name: "Fruits",
                                },
                            },
                        ],
                        _count: {
                            notifications: 2,
                            products: 6,
                        },
                    },
                    activeOrderItems: 4,
                },
            },
            {
                name: "200 OK - New Producer (Pending Verification)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer home data fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112238",
                        fullName: "Fatou Kone",
                        profileImage: null,
                        producerProfile: {
                            verificationStatus: "Pending",
                            allTimeEarnings: 0,
                        },
                        products: [],
                        _count: {
                            notifications: 1,
                            products: 0,
                        },
                    },
                    activeOrderItems: 0,
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Toggle Driver Online Status",
            method: "PUT",
            pathSegments: ["auth", "toggle-online-status"],
            description:
                "### Toggle Driver Availability Status\nFlips driver between Online (available for dispatch) and Offline. Blocked if driver currently has active deliveries.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)",
        }),
        [
            {
                name: "200 OK - Now Online",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Youra are now online",
                },
            },
            {
                name: "200 OK - Now Offline",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Youra are now offline",
                },
            },
            {
                name: "400 Bad Request - Active Deliveries In Progress",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "Cannot go online while having active deliveries",
                },
            },
        ],
    ),
];

// 3. ADMIN MODULE
const adminRequests = [
    withExamples(
        createRequest({
            name: "All Producers",
            method: "GET",
            pathSegments: ["admin", "all-producers"],
            description:
                "### List All Producers\nReturns paginated list of producers with search, verification status filter, producer type filter, and summary counts.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Query Parameters:\n- `search`: Search query string on email and fullName // optional\n- `verificationStatus`: Filter by `Pending`, `Accepted`, `Rejected` // optional\n- `producerType`: Filter by `Private` or `Company` // optional\n- `order`: Sort direction `asc` or `desc` // optional\n- `page`: Page number (Default: 1) // optional\n- `limit`: Items per page (Default: 10) // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Traore",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "verificationStatus",
                    value: "Pending",
                    description: "verificationStatus // optional",
                    disabled: true,
                },
                {
                    key: "producerType",
                    value: "Private",
                    description: "producerType // optional",
                    disabled: true,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
                {
                    key: "order",
                    value: "desc",
                    description: "order // optional",
                    disabled: true,
                },
            ],
        }),
        [
            {
                name: "200 OK - Producers Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All producer fetched successfully",
                    data: {
                        users: [
                            {
                                id: "672f10b7e21a224a5b112234",
                                fullName: "Amadou Traore",
                                email: "amadou.producer@example.com",
                                profileImage:
                                    "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                _count: {
                                    products: 8,
                                },
                                producerProfile: {
                                    farmName: "Traore Organic Cashew & Mango Farm",
                                    allTimeEarnings: 15400.5,
                                    verificationStatus: "Accepted",
                                    producerType: "Private",
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                            pendingReview: 1,
                            certified: 1,
                            productCount: 8,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Producers Found (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All producer fetched successfully",
                    data: {
                        users: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                            pendingReview: 0,
                            certified: 0,
                            productCount: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Accept or Reject Producer Account",
            method: "PATCH",
            pathSegments: ["admin", "producer-approval"],
            description:
                "### Review Producer Account Verification\nApproves or rejects a pending producer application. When rejected, a reason must be supplied.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Request Body Fields:\n- `accountId`: User ID of the producer (Required)\n- `isAccept`: `true` to approve, `false` to reject (Required)\n- `rejectReason`: Rejection explanation message // optional (Required if isAccept is false)",
            body: {
                mode: "raw",
                raw: "{\n  \"accountId\": \"672f10b7e21a224a5b112234\",\n  \"isAccept\": true,\n  \"rejectReason\": \"Missing clear land title document\" // optional\n}",
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Producer Accepted",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Accepted producer account successfully",
                },
            },
            {
                name: "200 OK - Producer Rejected",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Rejected producer account successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "All Drivers",
            method: "GET",
            pathSegments: ["admin", "all-drivers"],
            description:
                "### List All Drivers\nReturns paginated drivers list with vehicle filters, verification status filters, and active driver counts.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Query Parameters:\n- `search`: Search driver name or email // optional\n- `verificationStatus`: `Pending`, `Accepted`, `Rejected` // optional\n- `vehicleType`: Enum: `BIKE`, `MOTORCYCLE`, `THREE_WHEELER`, `VAN`, `TRUCK`, `PICKUP` // optional\n- `order`: `asc` or `desc` // optional\n- `page`: Page number // optional\n- `limit`: Items per page // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Koffi",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "verificationStatus",
                    value: "Accepted",
                    description: "verificationStatus // optional",
                    disabled: true,
                },
                {
                    key: "vehicleType",
                    value: "VAN",
                    description: "vehicleType // optional",
                    disabled: true,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Drivers Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All driver fetched successfully",
                    data: {
                        users: [
                            {
                                id: "672f10b7e21a224a5b112235",
                                fullName: "Kouame Koffi",
                                email: "kouame.driver@example.com",
                                profileImage:
                                    "https://res.cloudinary.com/demo/image/upload/v12345/kouame.jpg",
                                _count: {
                                    deliveries: 45,
                                },
                                driverProfile: {
                                    avgRating: 4.8,
                                    verificationStatus: "Accepted",
                                    vehicleType: "VAN",
                                    isAvailable: true,
                                    phoneNumber: "+2250703040506",
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                            activeDriversCount: 1,
                            pendingDriversCount: 0,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Drivers Found (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All driver fetched successfully",
                    data: {
                        users: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                            activeDriversCount: 0,
                            pendingDriversCount: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "All Buyers",
            method: "GET",
            pathSegments: ["admin", "all-buyers"],
            description:
                "### List All Buyers\nFetches paginated list of all registered buyers and overall suspended account counts.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Query Parameters:\n- `search`: Search buyer name or email // optional\n- `order`: `asc` or `desc` // optional\n- `page`: Page index // optional\n- `limit`: Page size // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Alice",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Buyers Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All buyer fetched successfully",
                    data: {
                        users: [
                            {
                                id: "672f10b7e21a224a5b112233",
                                fullName: "Alice Cooper",
                                email: "alice.buyer@example.com",
                                profileImage:
                                    "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                status: "ACTIVE",
                                _count: {
                                    orders: 8,
                                },
                                buyerProfile: {
                                    phoneNumber: "+2250701020304",
                                    profileType: "Supermarket Chain",
                                    city: "Abidjan",
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                            suspended: 0,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Buyers Found (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All buyer fetched successfully",
                    data: {
                        users: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                            suspended: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Accept or Reject Driver Account",
            method: "PATCH",
            pathSegments: ["admin", "driver-approval"],
            description:
                "### Review Driver Account Verification\nApproves or rejects a driver's pending verification status.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Request Body Fields:\n- `accountId`: User ID of driver (Required)\n- `isAccept`: `true` to approve, `false` to reject (Required)\n- `rejectReason`: Rejection explanation string // optional (Required if isAccept is false)",
            body: {
                mode: "raw",
                raw: "{\n  \"accountId\": \"672f10b7e21a224a5b112235\",\n  \"isAccept\": true,\n  \"rejectReason\": \"Vehicle registration expired\" // optional\n}",
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Driver Accepted",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Accepted driver account successfully",
                },
            },
            {
                name: "200 OK - Driver Rejected",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Rejected driver account successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Create Category",
            method: "POST",
            pathSegments: ["admin", "create-category"],
            isPublic: true,
            description:
                "### Create Category (Multipart)\nUploads category banner image and creates a product taxonomy category.\n\n- **Authentication:** Public\n- **Body Mode:** `form-data`\n\n### File Fields:\n- `imageUrl`: Category banner image file (Required)\n\n### Text Fields:\n- `name`: Category name (Required)\n- `slug`: Unique URL-friendly slug (Required)\n- `description`: Detailed description (Required)",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "imageUrl",
                        type: "file",
                        src: [],
                        description: "Category image file (Required)",
                    },
                    {
                        key: "name",
                        value: "Fresh Fruits",
                        type: "text",
                        description: "Category name (Required)",
                    },
                    {
                        key: "slug",
                        value: "fresh-fruits",
                        type: "text",
                        description: "Unique slug (Required)",
                    },
                    {
                        key: "description",
                        value: "Freshly harvested tropical and seasonal fruits",
                        type: "text",
                        description: "Category description (Required)",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Category Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Category created successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "All Categories",
            method: "GET",
            pathSegments: ["admin", "all-categories"],
            isPublic: true,
            description:
                "### List All Categories\nFetches all active and inactive product categories for the marketplace catalog.\n\n- **Authentication:** Public",
        }),
        [
            {
                name: "200 OK - Categories List",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All categories fetched successfully",
                    data: [
                        {
                            id: "672f10b7e21a224a5b112240",
                            name: "Fresh Fruits",
                            slug: "fresh-fruits",
                            description: "Freshly harvested tropical and seasonal fruits",
                            imageUrl:
                                "https://res.cloudinary.com/demo/image/upload/v12345/fruits.jpg",
                            isActive: true,
                        },
                        {
                            id: "672f10b7e21a224a5b112241",
                            name: "Tubers & Roots",
                            slug: "tubers-roots",
                            description: "Yams, cassava, and sweet potatoes",
                            imageUrl:
                                "https://res.cloudinary.com/demo/image/upload/v12345/tubers.jpg",
                            isActive: true,
                        },
                    ],
                },
            },
            {
                name: "200 OK - Empty Categories List",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All categories fetched successfully",
                    data: [],
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Toggle Category Status",
            method: "PATCH",
            pathSegments: ["admin", "toggle-category-status", ":id"],
            description:
                "### Toggle Category Active Status\nFlips the active visibility status of a category.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n- **URL Param:** `id` - Category MongoId (Required)",
            queryParams: [],
        }),
        [
            {
                name: "200 OK - Category Deactivated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Category Deactived successfully",
                },
            },
            {
                name: "200 OK - Category Activated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Category Actived successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Assign Driver to Delivery",
            method: "POST",
            pathSegments: ["admin", "assign-driver"],
            isPublic: true,
            description:
                "### Assign Driver to Order Delivery\nAssigns an available, verified driver to an active paid order.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `orderId`: MongoId of active order (Required)\n- `driverId`: MongoId of verified driver user (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        orderId: "672f10b7e21a224a5b112290",
                        driverId: "672f10b7e21a224a5b112235",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Driver Assigned",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver assigned to delivery successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Create Coupon",
            method: "POST",
            pathSegments: ["admin", "create-coupon"],
            description:
                "### Create Promotional Coupon\nCreates a discount percentage coupon code with expiration date.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Request Body Fields:\n- `code`: Unique alphanumeric coupon code (Required)\n- `discount`: Percentage discount from 1 to 99 (Required)\n- `expiryDate`: ISO Date string expiration (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        code: "HARVEST15",
                        discount: 15,
                        expiryDate: "2026-12-31T23:59:59.000Z",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Coupon Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Coupon created successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Terms and Conditions",
            method: "PATCH",
            pathSegments: ["admin", "update-terms"],
            description:
                "### Update Platform Terms\nUpdates or initializes platform terms and legal conditions text/HTML.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Request Body Fields:\n- `content`: Terms content markdown or HTML (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        content:
                            "<h1>Agro Connect Terms & Conditions</h1><p>Welcome to Agro Connect. All platform users agree to fair trade and quality compliance standards.</p>",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Terms Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Terms updated successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "All Orders (Admin)",
            method: "GET",
            pathSegments: ["admin", "all-orders"],
            queryParams: [
                { key: "search", value: "ORD-1728", description: "search // optional" },
                { key: "status", value: "Delivered", description: "status // optional" },
                { key: "page", value: "1", description: "page // optional" },
                { key: "limit", value: "10", description: "limit // optional" },
            ],
            description:
                "### List All Orders (Admin)\nFetches paginated list of paid orders across the platform with customer details, order metrics, item counts, and revenue statistics.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n\n### Query Parameters:\n- `search`: Search orderId, customer fullName, or customer email // optional\n- `status`: Filter by status: `Active`, `Delivered`, `Cancelled` // optional\n- `page`: Page index (default: 1) // optional\n- `limit`: Page size (default: 10) // optional",
        }),
        [
            {
                name: "200 OK - Orders Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All orders fetched successfully",
                    data: {
                        orders: [
                            {
                                id: "672f10b7e21a224a5b112280",
                                orderId: "ORD-1728891234567-8901",
                                status: "Delivered",
                                totalAmount: 15000,
                                createdAt: "2026-10-14T09:00:00.000Z",
                                _count: {
                                    items: 2,
                                },
                                customer: {
                                    id: "672f10b7e21a224a5b112233",
                                    fullName: "Alice Cooper",
                                    email: "alice.buyer@example.com",
                                    profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 35,
                            totalPage: 4,
                            completed: 28,
                            cancelled: 2,
                            totalAmount: 485000,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Orders (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "All orders fetched successfully",
                    data: {
                        orders: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                            completed: 0,
                            cancelled: 0,
                            totalAmount: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Order by ID (Admin)",
            method: "GET",
            pathSegments: ["admin", "order", ":id"],
            description:
                "### View Order Details (Admin)\nRetrieves comprehensive information for a specific order including customer profile, shipping address, ordered products with farm origin, and assigned delivery logistics.\n\n- **Authentication:** Bearer Token (Role: `ADMIN`)\n- **URL Param:** `id` - Order MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Order Details Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Order fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112280",
                        orderId: "ORD-1728891234567-8901",
                        status: "Delivered",
                        createdAt: "2026-10-14T09:00:00.000Z",
                        totalAmount: 15000,
                        cancelReason: null,
                        customer: {
                            id: "672f10b7e21a224a5b112233",
                            fullName: "Alice Cooper",
                            email: "alice.buyer@example.com",
                            profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                        },
                        shippingAddress: {
                            addressLine: "Cocody Danga, Villa 14",
                            city: "Abidjan",
                            instruction: "Leave with security guard",
                            postCode: "00225",
                        },
                        items: [
                            {
                                id: "672f10b7e21a224a5b112285",
                                productName: "Organic Kent Mangoes",
                                quantity: 5,
                                unitPrice: 1500,
                                subtotal: 7500,
                                sellingUnit: "CRATE",
                                product: {
                                    imageUrls: ["https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg"],
                                    producer: {
                                        fullName: "Amadou Traore",
                                        profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                        producerProfile: {
                                            farmName: "Traore Organic Farm",
                                            address: "Bouake Sector 3",
                                            city: "Bouake",
                                            farmSize: 25,
                                            producerType: "Private",
                                        },
                                    },
                                },
                            },
                        ],
                        deliveries: [
                            {
                                id: "672f10b7e21a224a5b112295",
                                status: "Delivered",
                                latitude: 5.3484,
                                longitude: -4.0197,
                                updatedAt: "2026-10-14T11:45:00.000Z",
                                driver: {
                                    id: "672f10b7e21a224a5b112235",
                                    fullName: "Koffi Mensah",
                                    email: "koffi.driver@example.com",
                                    profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/driver.jpg",
                                    driverProfile: {
                                        phoneNumber: "+2250703040506",
                                        registrationNumber: "1234-AB-01",
                                        vehicleType: "VAN",
                                        vehicleColor: "White",
                                        vehiclePhotoUrl: "https://res.cloudinary.com/demo/image/upload/v12345/van.jpg",
                                        model: "Toyota HiAce 2022",
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                name: "404 Not Found - Order Not Found",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Order not found",
                },
            },
        ],
    ),
];

// 4. PRODUCT MODULE
const productRequests = [
    withExamples(
        createRequest({
            name: "Create Product",
            method: "POST",
            pathSegments: ["product", "create"],
            description:
                "### Create Product (Multipart)\nCreates a new agricultural product listing under the verified producer's catalog.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **Body Mode:** `form-data`\n\n### File Fields:\n- `imageUrls`: Multiple product photos (At least 1 file required)\n\n### Text Fields:\n- `name`: Product name (Required)\n- `description`: Detailed description of harvest, quality, origin (Required)\n- `categoryId`: MongoId of category (Required)\n- `sellingUnit`: Enum: `KG`, `GRAM`, `PIECE`, `DOZEN`, `LITER`, `BAG`, `BUNDLE`, `CRATE` (Required)\n- `pricePerUnit`: Price per unit in integer currency units (Required)\n- `availableQuantity`: Available stock quantity in integer units (Required)\n- `isFeatured`: Feature on homepage // optional\n- `isActive`: Product listing active visibility // optional",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "imageUrls",
                        type: "file",
                        src: [],
                        description: "Product photos (At least 1 file required)",
                    },
                    {
                        key: "name",
                        value: "Organic Kent Mangoes",
                        type: "text",
                        description: "Product name (Required)",
                    },
                    {
                        key: "description",
                        value: "Export quality Kent mangoes, naturally ripened and sweet.",
                        type: "text",
                        description: "Product description (Required)",
                    },
                    {
                        key: "categoryId",
                        value: "672f10b7e21a224a5b112240",
                        type: "text",
                        description: "Category MongoId (Required)",
                    },
                    {
                        key: "sellingUnit",
                        value: "CRATE",
                        type: "text",
                        description: "KG, GRAM, PIECE, DOZEN, LITER, BAG, BUNDLE, CRATE (Required)",
                    },
                    {
                        key: "pricePerUnit",
                        value: "1500",
                        type: "text",
                        description: "Unit price (Required)",
                    },
                    {
                        key: "availableQuantity",
                        value: "250",
                        type: "text",
                        description: "Available quantity (Required)",
                    },
                    {
                        key: "isFeatured",
                        value: "true",
                        type: "text",
                        description: "isFeatured // optional",
                    },
                    {
                        key: "isActive",
                        value: "true",
                        type: "text",
                        description: "isActive // optional",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Product Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product created successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get All Products",
            method: "GET",
            pathSegments: ["product", "all"],
            description:
                "### Marketplace Product Catalog\nSearches and filters active products with pagination, category filter, selling unit, price ranges, and wishlist flags.\n\n- **Authentication:** OptionalAuth (Anonymous or Bearer Token)\n\n### Query Parameters:\n- `search`: Search name & description // optional\n- `categoryId`: Filter by category MongoId // optional\n- `sellingUnit`: Filter by selling unit enum // optional\n- `minPrice`: Minimum pricePerUnit // optional\n- `maxPrice`: Maximum pricePerUnit // optional\n- `isActive`: 'true' or 'false' // optional\n- `sort`: Sort field: `pricePerUnit`, `availableQuantity`, `avgRating`, `createdAt` // optional\n- `order`: `asc` or `desc` // optional\n- `page`: Page index // optional\n- `limit`: Items per page // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Mango",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "categoryId",
                    value: "672f10b7e21a224a5b112240",
                    description: "categoryId // optional",
                    disabled: true,
                },
                {
                    key: "sellingUnit",
                    value: "CRATE",
                    description: "sellingUnit // optional",
                    disabled: true,
                },
                {
                    key: "minPrice",
                    value: "500",
                    description: "minPrice // optional",
                    disabled: true,
                },
                {
                    key: "maxPrice",
                    value: "5000",
                    description: "maxPrice // optional",
                    disabled: true,
                },
                {
                    key: "sort",
                    value: "pricePerUnit",
                    description: "sort // optional",
                    disabled: true,
                },
                {
                    key: "order",
                    value: "asc",
                    description: "order // optional",
                    disabled: true,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Paginated Products",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Products fetched successfully",
                    data: {
                        products: [
                            {
                                id: "672f10b7e21a224a5b112250",
                                name: "Organic Kent Mangoes",
                                pricePerUnit: 1500,
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                                availableQuantity: 250,
                                avgRating: 4.9,
                                totalReviews: 18,
                                producer: {
                                    producerProfile: {
                                        farmName: "Traore Organic Cashew & Mango Farm",
                                        companyName: null,
                                        city: "Bouake",
                                    },
                                },
                                wishlists: [],
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - Empty Products List",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Products fetched successfully",
                    data: {
                        products: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Top Rated Products",
            method: "GET",
            pathSegments: ["product", "top-rated"],
            description:
                "### Top Rated Products\nFetches top 5 rated active marketplace products.\n\n- **Authentication:** OptionalAuth",
        }),
        [
            {
                name: "200 OK - Top Rated Products",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Top rated products fetched successfully",
                    data: {
                        products: [
                            {
                                id: "672f10b7e21a224a5b112250",
                                name: "Organic Kent Mangoes",
                                description:
                                    "Export quality Kent mangoes, naturally ripened and sweet.",
                                sellingUnit: "CRATE",
                                pricePerUnit: 1500,
                                availableQuantity: 250,
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                                avgRating: 4.9,
                                totalReviews: 18,
                                producer: {
                                    producerProfile: {
                                        farmName: "Traore Organic Cashew & Mango Farm",
                                        companyName: null,
                                        city: "Bouake",
                                    },
                                },
                                wishlists: [],
                            },
                        ],
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get All Products by Producer",
            method: "GET",
            pathSegments: ["product", "producer-wise"],
            description:
                "### Producer Catalog Items\nFetches paginated products uploaded by the authenticated producer.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n\n### Query Parameters:\n- `search`: Search within producer products // optional\n- `isActive`: 'true' or 'false' status filter // optional\n- `page`: Page index // optional\n- `limit`: Items per page // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Mango",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "isActive",
                    value: "true",
                    description: "isActive // optional",
                    disabled: true,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Producer Products",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Products fetched successfully",
                    data: {
                        products: [
                            {
                                id: "672f10b7e21a224a5b112250",
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                                name: "Organic Kent Mangoes",
                                pricePerUnit: 1500,
                                availableQuantity: 250,
                                sellingUnit: "CRATE",
                                sold: 45,
                                category: {
                                    name: "Fresh Fruits",
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Producer Products (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Products fetched successfully",
                    data: {
                        products: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Product Details by ID",
            method: "GET",
            pathSegments: ["product", "details", ":id"],
            description:
                "### Product Details\nRetrieves comprehensive product details including farm and producer information, reviews, and cumulative delivered sales revenue.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `id` - Product MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Product Details Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product fetched successfully",
                    data: {
                        product: {
                            id: "672f10b7e21a224a5b112250",
                            name: "Organic Kent Mangoes",
                            description:
                                "Export quality Kent mangoes, naturally ripened and sweet.",
                            sellingUnit: "CRATE",
                            pricePerUnit: 1500,
                            availableQuantity: 250,
                            imageUrls: [
                                "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                "https://res.cloudinary.com/demo/image/upload/v12345/mango2.jpg",
                            ],
                            avgRating: 4.9,
                            createdAt: "2026-10-01T08:00:00.000Z",
                            isActive: true,
                            _count: {
                                orderItems: 24,
                            },
                            producer: {
                                id: "672f10b7e21a224a5b112234",
                                fullName: "Amadou Traore",
                                profileImage:
                                    "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                producerProfile: {
                                    farmName: "Traore Organic Cashew & Mango Farm",
                                    address: "Route de Tiassale, Km 14",
                                    companyName: null,
                                },
                            },
                            totalReviews: 18,
                            category: {
                                name: "Fresh Fruits",
                            },
                            reviews: [
                                {
                                    rating: 5,
                                    comment: "Very sweet and fresh! Arrived in great condition.",
                                    createdAt: "2026-10-05T14:22:10.000Z",
                                    buyer: {
                                        fullName: "Alice Cooper",
                                        profileImage:
                                            "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                    },
                                },
                            ],
                            wishlists: [],
                        },
                        revenue: 36000,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Product Details",
            method: "PUT",
            pathSegments: ["product", "update"],
            description:
                "### Update Product Details\nUpdates editable attributes for a producer's existing product.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n\n### Request Body Fields:\n- `productId`: MongoId of product (Required)\n- `name`: Updated name // optional\n- `description`: Updated description // optional\n- `categoryId`: Updated category MongoId // optional\n- `sellingUnit`: Updated selling unit enum // optional\n- `pricePerUnit`: Updated pricePerUnit integer // optional\n- `availableQuantity`: Updated available quantity integer // optional\n- `isActive`: Updated active visibility flag // optional\n- `isFeatured`: Updated featured status flag // optional",
            body: {
                mode: "raw",
                raw: "{\n  \"productId\": \"672f10b7e21a224a5b112250\",\n  \"name\": \"Organic Kent Mangoes - Premium Batch\", // optional\n  \"description\": \"Fresh harvest premium Kent mangoes with organic certification.\", // optional\n  \"categoryId\": \"672f10b7e21a224a5b112240\", // optional\n  \"sellingUnit\": \"CRATE\", // optional\n  \"pricePerUnit\": 1600, // optional\n  \"availableQuantity\": 300, // optional\n  \"isActive\": true, // optional\n  \"isFeatured\": true // optional\n}",
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Product Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product updated successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Product Images",
            method: "PUT",
            pathSegments: ["product", "update-images"],
            description:
                "### Update Product Images (Multipart)\nReplaces or appends images for an existing product, specifying URLs to keep and uploading new files.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **Body Mode:** `form-data`\n\n### Fields:\n- `productId`: Product MongoId (Required)\n- `keptImages`: Array of existing image URLs to keep // optional\n- `imageUrls`: New image files to upload // optional",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "productId",
                        value: "672f10b7e21a224a5b112250",
                        type: "text",
                        description: "Product MongoId (Required)",
                    },
                    {
                        key: "keptImages",
                        value: "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                        type: "text",
                        description: "keptImages // optional",
                    },
                    {
                        key: "imageUrls",
                        type: "file",
                        src: [],
                        description: "imageUrls // optional new files",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Product Images Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product images updated successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Producer Info by ID",
            method: "GET",
            pathSegments: ["product", "producer-info", ":id"],
            description:
                "### Public Producer Profile & Farm Details\nFetches public farm overview, rating, all reviews, product catalog, and completed order counts for a producer.\n\n- **Authentication:** OptionalAuth\n- **URL Param:** `id` - Producer user MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Producer Info Details",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer info fetched successfully",
                    data: {
                        producer: {
                            id: "672f10b7e21a224a5b112234",
                            createdAt: "2026-09-15T10:00:00.000Z",
                            fullName: "Amadou Traore",
                            profileImage:
                                "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                            producerProfile: {
                                farmName: "Traore Organic Cashew & Mango Farm",
                                phoneNumber: "+2250702030405",
                                farmLocation: "Bouake",
                            },
                        },
                        reviews: [
                            {
                                id: "672f10b7e21a224a5b112260",
                                rating: 5,
                                comment: "Very reliable producer, always top notch produce.",
                                createdAt: "2026-10-06T09:12:00.000Z",
                                product: {
                                    name: "Organic Kent Mangoes",
                                },
                                buyer: {
                                    fullName: "Alice Cooper",
                                    profileImage:
                                        "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                },
                            },
                        ],
                        products: [
                            {
                                id: "672f10b7e21a224a5b112250",
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                                name: "Organic Kent Mangoes",
                                pricePerUnit: 1500,
                                sellingUnit: "CRATE",
                                category: {
                                    name: "Fresh Fruits",
                                },
                                wishlists: false,
                            },
                        ],
                        avgRating: 5,
                        totalOrders: 24,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Our Best Producers",
            method: "GET",
            pathSegments: ["product", "our-best-producers"],
            description:
                "### Our Best Producers\nFetches top 5 verified producers ranked by review count and rating.\n\n- **Authentication:** OptionalAuth",
        }),
        [
            {
                name: "200 OK - Best Producers List",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Our best producers fetched successfully",
                    data: {
                        producers: [
                            {
                                id: "672f10b7e21a224a5b112234",
                                fullName: "Amadou Traore",
                                profileImage:
                                    "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                _count: {
                                    products: 8,
                                },
                                producerProfile: {
                                    farmName: "Traore Organic Cashew & Mango Farm",
                                    farmLocation: "Bouake",
                                    farmPhotoUrl:
                                        "https://res.cloudinary.com/demo/image/upload/v12345/farm.jpg",
                                },
                                avgRating: 4.9,
                                totalReviews: 32,
                            },
                        ],
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Product Details for Producer",
            method: "GET",
            pathSegments: ["product", "producer-product-details", ":id"],
            description:
                "### View Product Details for Producer\nRetrieves full product metrics including customer ratings, reviews, ordered item history, and total aggregate revenue earned by this product.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **URL Param:** `id` - Product MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Product Details & Revenue Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product fetched successfully",
                    data: {
                        product: {
                            id: "672f10b7e21a224a5b112240",
                            name: "Organic Kent Mangoes",
                            description: "Premium sweet juicy mangoes harvest from northern orchards.",
                            sellingUnit: "CRATE",
                            pricePerUnit: 1500,
                            availableQuantity: 150,
                            imageUrls: [
                                "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                            ],
                            avgRating: 4.9,
                            createdAt: "2026-10-05T08:00:00.000Z",
                            isActive: true,
                            _count: {
                                orderItems: 18,
                            },
                            orderItems: [
                                {
                                    subtotal: 7500,
                                    productName: "Organic Kent Mangoes",
                                    quantity: 5,
                                    sellingUnit: "CRATE",
                                    status: "Delivered",
                                    unitPrice: 1500,
                                    review: {
                                        rating: 5,
                                        comment: "Exquisite quality and taste!",
                                        createdAt: "2026-10-10T14:30:00.000Z",
                                        buyer: {
                                            fullName: "Alice Cooper",
                                            profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                        },
                                    },
                                },
                            ],
                            totalReviews: 12,
                            category: {
                                name: "Fruits",
                            },
                        },
                        revenue: 127500,
                    },
                },
            },
            {
                name: "404 Not Found - Product Not Found",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Product not found",
                },
            },
        ],
    ),
];

// 5. SHOPPING MODULE
const shoppingRequests = [
    withExamples(
        createRequest({
            name: "Add Product to Cart",
            method: "POST",
            pathSegments: ["shopping", "add-cart"],
            description:
                "### Add Item to Shopping Cart\nAdds a designated quantity of a product to the buyer's active cart.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `productId`: Product MongoId (Required)\n- `quantity`: Quantity integer >= 1 (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        productId: "672f10b7e21a224a5b112250",
                        quantity: 3,
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Added to Cart",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product added to cart successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get User Cart Items",
            method: "GET",
            pathSegments: ["shopping", "cart"],
            description:
                "### View Cart\nFetches all product items currently in the authenticated buyer's cart.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)",
        }),
        [
            {
                name: "200 OK - Cart Items Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Cart items retrieved successfully",
                    data: [
                        {
                            id: "672f10b7e21a224a5b112270",
                            quantity: 3,
                            product: {
                                id: "672f10b7e21a224a5b112250",
                                name: "Organic Kent Mangoes",
                                pricePerUnit: 1500,
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                            },
                        },
                    ],
                },
            },
            {
                name: "200 OK - Cart Is Empty",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Cart items retrieved successfully",
                    data: [],
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Cart Item Quantity",
            method: "PATCH",
            pathSegments: ["shopping", "update-cart"],
            description:
                "### Update Cart Quantity\nIncrements or decrements the quantity of a specific cart item.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `cartId`: MongoId of cart record (Required)\n- `increment`: `true` to add 1, `false` to subtract 1 (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        cartId: "672f10b7e21a224a5b112270",
                        increment: true,
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Quantity Increased",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Cart item quantity increased successfully",
                },
            },
            {
                name: "200 OK - Quantity Decreased",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Cart item quantity decreased successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Remove Product from Cart",
            method: "DELETE",
            pathSegments: ["shopping", "remove-cart", ":id"],
            description:
                "### Remove Item from Cart\nDeletes a specific cart line item by its Cart record ID.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `id` - Cart record MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Removed from Cart",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product removed from cart successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Toggle Wishlist Item",
            method: "POST",
            pathSegments: ["shopping", "wishlist-toggle", ":id"],
            description:
                "### Toggle Product Wishlist\nAdds product to wishlist if not already saved, or removes it if already present.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `id` - Product MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Added to Wishlist",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product added to wishlist successfully",
                },
            },
            {
                name: "200 OK - Removed from Wishlist",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Product removed from wishlist successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get User Wishlist Items",
            method: "GET",
            pathSegments: ["shopping", "wishlist"],
            description:
                "### View Wishlist\nFetches all product items currently saved to the buyer's wishlist.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)",
        }),
        [
            {
                name: "200 OK - Wishlist Items Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Wishlist items retrieved successfully",
                    data: [
                        {
                            id: "672f10b7e21a224a5b112280",
                            product: {
                                id: "672f10b7e21a224a5b112250",
                                name: "Organic Kent Mangoes",
                                pricePerUnit: 1500,
                                imageUrls: [
                                    "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                ],
                            },
                        },
                    ],
                },
            },
            {
                name: "200 OK - Wishlist Is Empty",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Wishlist items retrieved successfully",
                    data: [],
                },
            },
        ],
    ),
];

// 6. ORDER MODULE
const orderRequests = [
    withExamples(
        createRequest({
            name: "Create Order",
            method: "POST",
            pathSegments: ["order", "create"],
            description:
                "### Create Order & Initialize Payment\nConverts cart items into an active order and generates the checkout session URL.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `shippingAddressId`: MongoId of chosen shipping address (Required)\n- `cartIds`: Array of Cart MongoIds to purchase (Required)\n- `couponCode`: Promotional coupon code // optional",
            body: {
                mode: "raw",
                raw: "{\n  \"shippingAddressId\": \"672f10b7e21a224a5b1122a0\",\n  \"cartIds\": [\n    \"672f10b7e21a224a5b112270\"\n  ],\n  \"couponCode\": \"HARVEST15\" // optional\n}",
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Order Created",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Order created successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        checkOutUrl:
                            "https://res.cloudinary.com/dbpao5h91/image/upload/v1791863901/projects/jmqlhy3afcd1fnbvrccz.png",
                        transactionId: "transactionId",
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Initiate Checkout for Existing Order",
            method: "POST",
            pathSegments: ["order", "checkout", ":orderId"],
            description:
                "### Initiate CinetPay Checkout\nGenerates a fresh CinetPay payment session URL for an existing pending order.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `orderId` - Order reference identifier (Required)",
        }),
        [
            {
                name: "200 OK - Checkout Session Initiated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Checkout initiated successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        checkOutUrl: "https://checkout.cinetpay.com/payment/cp_session_xyz789",
                        paymentUrl: "https://checkout.cinetpay.com/payment/cp_session_xyz789",
                        transactionId: "CP_TX_1728891234567",
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Verify Payment",
            method: "POST",
            pathSegments: ["order", "verify", ":transactionId"],
            description:
                "### Verify Payment Status\nQueries payment status against CinetPay and updates order status accordingly.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `transactionId` - CinetPay transaction ID or Order ID (Required)",
        }),
        [
            {
                name: "200 OK - Payment Verified as Paid",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Payment status verified successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        status: "Active",
                        paymentStatus: "Paid",
                        isPaid: true,
                    },
                },
            },
            {
                name: "200 OK - Payment Failed / Cancelled",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Payment status verified successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        status: "Cancelled",
                        paymentStatus: "Failed",
                        isPaid: false,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get User Orders",
            method: "GET",
            pathSegments: ["order", "user-wise"],
            description:
                "### Buyer Order History\nFetches paginated list of orders placed by the authenticated buyer.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Query Parameters:\n- `search`: Search order identifier // optional\n- `status`: Filter by OrderStatus: `Pending`, `Active`, `PartiallyCancelled`, `Shipped`, `Delivered`, `Cancelled`, `Refunded` // optional\n- `paymentStatus`: Filter by PaymentStatus: `Pending`, `Paid`, `Failed`, `PartiallyRefunded`, `Refunded` // optional\n- `page`: Page index // optional\n- `limit`: Items per page // optional",
            queryParams: [
                {
                    key: "search",
                    value: "ORD-1728",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "status",
                    value: "Delivered",
                    description: "status // optional",
                    disabled: true,
                },
                {
                    key: "paymentStatus",
                    value: "Paid",
                    description: "paymentStatus // optional",
                    disabled: true,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Buyer Orders Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Orders fetched successfully",
                    data: {
                        orders: [
                            {
                                id: "672f10b7e21a224a5b112290",
                                orderId: "ORD-1728891234567-8901",
                                status: "Delivered",
                                paymentStatus: "Paid",
                                totalAmount: 4500,
                                shippingAddress: {
                                    addressLine: "Plateau, Boulevard Carde",
                                    city: "Abidjan",
                                    instruction: "Deliver to 4th floor reception",
                                    postCode: "BP 123",
                                },
                                createdAt: "2026-10-08T11:00:00.000Z",
                                items: [
                                    {
                                        id: "672f10b7e21a224a5b112291",
                                        productName: "Organic Kent Mangoes",
                                        quantity: 3,
                                        unitPrice: 1500,
                                        subtotal: 4500,
                                        sellingUnit: "CRATE",
                                        product: {
                                            imageUrls: [
                                                "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                            ],
                                            producer: {
                                                fullName: "Amadou Traore",
                                                profileImage:
                                                    "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                                producerProfile: {
                                                    farmName:
                                                        "Traore Organic Cashew & Mango Farm",
                                                    address: "Route de Tiassale, Km 14",
                                                    city: "Bouake",
                                                    farmSize: 12.5,
                                                    producerType: "Private",
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Orders Placed (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Orders fetched successfully",
                    data: {
                        orders: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Producer Wise Orders",
            method: "GET",
            pathSegments: ["order", "producer-wise"],
            description:
                "### Producer Ordered Items\nFetches paginated order line items containing products produced by the authenticated producer.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n\n### Query Parameters:\n- `search`: Search product or order name // optional\n- `status`: OrderStatus filter // optional\n- `paymentStatus`: PaymentStatus filter // optional\n- `page`: Page index // optional\n- `limit`: Items per page // optional",
            queryParams: [
                {
                    key: "search",
                    value: "Mango",
                    description: "search // optional",
                    disabled: false,
                },
                {
                    key: "page",
                    value: "1",
                    description: "page // optional",
                    disabled: false,
                },
                {
                    key: "limit",
                    value: "10",
                    description: "limit // optional",
                    disabled: false,
                },
            ],
        }),
        [
            {
                name: "200 OK - Producer Orders Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Orders fetched successfully",
                    data: {
                        orderItems: [
                            {
                                id: "672f10b7e21a224a5b112291",
                                productName: "Organic Kent Mangoes",
                                createdAt: "2026-10-08T11:00:00.000Z",
                                sellingUnit: "CRATE",
                                quantity: 3,
                                subtotal: 4500,
                                unitPrice: 1500,
                                product: {
                                    imageUrls: [
                                        "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                    ],
                                },
                                order: {
                                    orderId: "ORD-1728891234567-8901",
                                    customer: {
                                        fullName: "Alice Cooper",
                                        profileImage:
                                            "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                                        buyerProfile: {
                                            institution: "Ivoire Fresh Market Group",
                                        },
                                    },
                                },
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Producer Orders (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Orders fetched successfully",
                    data: {
                        orderItems: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Order Details by ID",
            method: "GET",
            pathSegments: ["order", "details", ":id"],
            description:
                "### Detailed Order Information\nFetches comprehensive order details, delivery shipping address, items, and producer contact info.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n- **URL Param:** `id` - Order MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Order Details Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Order fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112290",
                        orderId: "ORD-1728891234567-8901",
                        status: "Delivered",
                        paymentStatus: "Paid",
                        totalAmount: 4500,
                        cancelReason: null,
                        shippingAddress: {
                            addressLine: "Plateau, Boulevard Carde",
                            city: "Abidjan",
                            instruction: "Deliver to 4th floor reception",
                            postCode: "BP 123",
                        },
                        createdAt: "2026-10-08T11:00:00.000Z",
                        items: [
                            {
                                id: "672f10b7e21a224a5b112291",
                                productName: "Organic Kent Mangoes",
                                quantity: 3,
                                unitPrice: 1500,
                                subtotal: 4500,
                                sellingUnit: "CRATE",
                                product: {
                                    imageUrls: [
                                        "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                                    ],
                                    producer: {
                                        fullName: "Amadou Traore",
                                        profileImage:
                                            "https://res.cloudinary.com/demo/image/upload/v12345/amadou.jpg",
                                        producerProfile: {
                                            farmName: "Traore Organic Cashew & Mango Farm",
                                            address: "Route de Tiassale, Km 14",
                                            city: "Bouake",
                                            farmSize: 12.5,
                                            producerType: "Private",
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Delivery Status",
            method: "PUT",
            pathSegments: ["order", "delivery", "update-status"],
            description:
                "### Update Delivery Status (Driver)\nAllows assigned driver to mark a delivery as PickedUp or Cancelled.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n\n### Request Body Fields:\n- `deliveryId`: MongoId of delivery (Required)\n- `status`: Either `PickedUp` or `Cancelled` (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        deliveryId: "672f10b7e21a224a5b112295",
                        status: "PickedUp",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Delivery Marked as PickedUp",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Delivery marked as picked up successfully",
                },
            },
            {
                name: "200 OK - Delivery Cancelled",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Delivery cancelled successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Send Delivery Completion OTP",
            method: "PATCH",
            pathSegments: ["order", "send-completion-otp", ":id"],
            description:
                "### Send Delivery OTP to Customer\nDispatches a delivery completion verification OTP code to the recipient customer's email.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n- **URL Param:** `id` - Delivery MongoId (Required)",
        }),
        [
            {
                name: "200 OK - OTP Sent to Customer",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "OTP sent to customer successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Verify Delivery Completion OTP",
            method: "POST",
            pathSegments: ["order", "verify-completion-otp"],
            description:
                "### Confirm Order Delivery with OTP\nVerifies customer OTP on delivery handover, marking delivery as Delivered and updating producer & driver earnings.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n\n### Request Body Fields:\n- `deliveryId`: MongoId of delivery (Required)\n- `otp`: 6-digit OTP code provided by the recipient (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        deliveryId: "672f10b7e21a224a5b112295",
                        otp: "987654",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Delivery Completed Successfully",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Delivery marked as completed successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Apply Coupon",
            method: "POST",
            pathSegments: ["order", "apply-coupon"],
            isPublic: true,
            description:
                "### Validate & Apply Coupon\nVerifies coupon code validity and returns eligible discount percentage.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `code`: Coupon promo code string (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        code: "HARVEST15",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Coupon Applied",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Coupon applied successfully",
                    data: {
                        discount: 15,
                    },
                },
            },
            {
                name: "404 Not Found - Coupon Not Found",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Coupon not found",
                },
            },
            {
                name: "410 Gone - Coupon Expired",
                statusCode: 410,
                statusText: "Gone",
                body: {
                    success: false,
                    statusCode: 410,
                    message: "Coupon has expired",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Order Item Details for Producer",
            method: "GET",
            pathSegments: ["order", "item", "details", ":id"],
            description:
                "### View Order Item Details for Producer\nFetches details of a specific line item sold by the producer, including customer information, delivery destination address, assigned driver details, and current coordinates.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n- **URL Param:** `id` - OrderItem MongoId (Required)",
        }),
        [
            {
                name: "200 OK - Order Item Details Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Order item details fetched successfully",
                    data: {
                        id: "672f10b7e21a224a5b112285",
                        productName: "Organic Kent Mangoes",
                        createdAt: "2026-10-14T09:00:00.000Z",
                        sellingUnit: "CRATE",
                        quantity: 5,
                        subtotal: 7500,
                        unitPrice: 1500,
                        isReviewed: true,
                        status: "Delivered",
                        product: {
                            imageUrls: [
                                "https://res.cloudinary.com/demo/image/upload/v12345/mango1.jpg",
                            ],
                        },
                        review: {
                            id: "672f10b7e21a224a5b112290",
                            rating: 5,
                            comment: "Fresh and deliciously sweet mangoes!",
                            createdAt: "2026-10-14T12:00:00.000Z",
                        },
                        order: {
                            orderId: "ORD-1728891234567-8901",
                            customer: {
                                fullName: "Alice Cooper",
                                profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/alice.jpg",
                            },
                            shippingAddress: {
                                addressLine: "Cocody Danga, Villa 14",
                                city: "Abidjan",
                                postCode: "00225",
                            },
                            deliveries: [
                                {
                                    status: "Delivered",
                                    createdAt: "2026-10-14T09:15:00.000Z",
                                    latitude: 5.3484,
                                    longitude: -4.0197,
                                    updatedAt: "2026-10-14T11:45:00.000Z",
                                    driver: {
                                        fullName: "Koffi Mensah",
                                        profileImage: "https://res.cloudinary.com/demo/image/upload/v12345/driver.jpg",
                                        driverProfile: {
                                            id: "672f10b7e21a224a5b112236",
                                            vehicleType: "VAN",
                                            registrationNumber: "1234-AB-01",
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
            {
                name: "404 Not Found - Order Item Not Found",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Order item not found",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Update Navigation",
            method: "PATCH",
            pathSegments: ["order", "update-navigation"],
            description:
                "### Update Live GPS Navigation for Delivery\nUpdates real-time GPS coordinates for an assigned order in PickedUp status and shifts the delivery status to `InTransit`.\n\n- **Authentication:** Bearer Token (Role: `DRIVER`)\n\n### Request Body Fields:\n- `deliveryId`: MongoId of active delivery (Required)\n- `latitude`: Float between -90 and 90 (Required)\n- `longitude`: Float between -180 and 180 (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        deliveryId: "672f10b7e21a224a5b112295",
                        latitude: 5.34843,
                        longitude: -4.01972,
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Navigation Updated",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Navigation updated successfully",
                },
            },
            {
                name: "404 Not Found - Delivery Not Picked Up",
                statusCode: 404,
                statusText: "Not Found",
                body: {
                    success: false,
                    statusCode: 404,
                    message: "Delivery not found or not in PickedUp status",
                },
            },
        ],
    ),
];

// 7. WEBHOOK MODULE
const webhookRequests = [
    withExamples(
        createRequest({
            name: "Handle CinetPay Webhook",
            method: "POST",
            pathSegments: ["webhook", "cinetpay"],
            isPublic: true,
            description:
                "### CinetPay Payment Notification Webhook\nServer-to-server callback endpoint receiving instant payment transaction status notifications.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `cpm_trans_id`: Transaction reference ID (Required)\n- `cpm_site_id`: Merchant site ID // optional\n- `cpm_trans_date`: Transaction timestamp // optional\n- `cpm_amount`: Transaction amount // optional\n- `cpm_currency`: Currency code e.g. XOF // optional\n- `cpm_payment_method`: Method e.g. OM, MOMO, CARD // optional\n- `cpm_result`: Outcome code '00' // optional",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        cpm_trans_id: "CP_TX_1728891234567",
                        cpm_site_id: "987654",
                        cpm_trans_date: "2026-10-08 11:15:30",
                        cpm_amount: 4500,
                        cpm_currency: "XOF",
                        cpm_payment_method: "OM",
                        cpm_result: "00",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Webhook Processed",
                body: {
                    received: true,
                    message: "CinetPay notification processed successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        status: "Active",
                        paymentStatus: "Paid",
                        isPaid: true,
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Handle CinetPay Notify Alternate",
            method: "POST",
            pathSegments: ["webhook", "cinetpay", "notify"],
            isPublic: true,
            description:
                "### CinetPay Alternate Notify Callback\nAlternate notification URL path supported by CinetPay integration.\n\n- **Authentication:** Public\n\n### Request Body Fields:\n- `cpm_trans_id`: CinetPay transaction ID (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        cpm_trans_id: "CP_TX_1728891234567",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Notify Callback Processed",
                body: {
                    received: true,
                    message: "CinetPay notification processed successfully",
                    data: {
                        orderId: "ORD-1728891234567-8901",
                        status: "Active",
                        paymentStatus: "Paid",
                        isPaid: true,
                    },
                },
            },
        ],
    ),
];

// 8. SHIPPING ADDRESS MODULE
const shippingAddressRequests = [
    withExamples(
        createRequest({
            name: "Create Shipping Address",
            method: "POST",
            pathSegments: ["shipping-address", "create"],
            description:
                "### Create Shipping Address\nSaves a new destination delivery address for the authenticated buyer.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `addressLine`: Street address and building / door number (Required)\n- `city`: City (Required)\n- `postCode`: Postal / delivery district code (Required)\n- `instruction`: Special courier delivery notes / instructions (Required)",
            body: {
                mode: "raw",
                raw: "{\n  \"addressLine\": \"Plateau, Boulevard Carde, Immeuble Alpha 4E\",\n  \"city\": \"Abidjan\",\n  \"postCode\": \"BP 123\",\n  \"instruction\": \"Call front desk receptionist on arrival\" // optional\n}",
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "201 Created - Shipping Address Created",
                statusCode: 200, // ResponseService formats with 200
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Shipping Address created successfully!",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Shipping Addresses",
            method: "GET",
            pathSegments: ["shipping-address"],
            description:
                "### View Saved Shipping Addresses\nRetrieves all saved delivery addresses for the authenticated buyer.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)",
        }),
        [
            {
                name: "200 OK - Addresses Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Shipping Address fetched successfully!",
                    data: [
                        {
                            id: "672f10b7e21a224a5b1122a0",
                            addressLine: "Plateau, Boulevard Carde, Immeuble Alpha 4E",
                            city: "Abidjan",
                            instruction: "Call front desk receptionist on arrival",
                            postCode: "BP 123",
                        },
                    ],
                },
            },
            {
                name: "200 OK - No Addresses Saved (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Shipping Address fetched successfully!",
                    data: [],
                },
            },
        ],
    ),
];

// 9. FEEDBACK MODULE
const feedbackRequests = [
    withExamples(
        createRequest({
            name: "Submit Review",
            method: "POST",
            pathSegments: ["feedback", "submit-review"],
            description:
                "### Submit Product Review\nSubmits rating and written feedback for an item in a delivered order.\n\n- **Authentication:** Bearer Token\n\n### Request Body Fields:\n- `orderItemId`: MongoId of delivered order line item (Required)\n- `rating`: Rating integer between 1 and 5 (Required)\n- `comment`: Written review comment (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        orderItemId: "672f10b7e21a224a5b112291",
                        rating: 5,
                        comment:
                            "Remarkable quality! Very fresh produce delivered promptly in safe packaging.",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Review Submitted",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Review submitted successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get Terms and Conditions",
            method: "GET",
            pathSegments: ["feedback", "terms"],
            description:
                "### View Terms & Conditions\nFetches current platform terms and condition content.\n\n- **Authentication:** Bearer Token",
        }),
        [
            {
                name: "200 OK - Terms Retrieved",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Terms fetched successfully",
                    data: {
                        content:
                            "<h1>Agro Connect Terms & Conditions</h1><p>Welcome to Agro Connect. All platform users agree to fair trade and quality compliance standards.</p>",
                    },
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Send Support Request",
            method: "POST",
            pathSegments: ["feedback", "support"],
            description:
                "### Send Customer Support Request (Multipart)\nSubmits a support assistance inquiry with optional problem attachment screenshots.\n\n- **Authentication:** Bearer Token\n- **Body Mode:** `form-data`\n\n### File Fields:\n- `files`: Attachment files (screenshots, receipts) // optional\n\n### Text Fields:\n- `subject`: Inquiry subject headline (Required)\n- `message`: Detailed description of the issue or question (Required)",
            body: {
                mode: "formdata",
                formdata: [
                    {
                        key: "subject",
                        value: "Delivery Delay Inquiry for Order ORD-1728891234567-8901",
                        type: "text",
                        description: "Subject title (Required)",
                    },
                    {
                        key: "message",
                        value: "Hello support team, I would like to verify the estimated arrival time for our warehouse shipment.",
                        type: "text",
                        description: "Inquiry details (Required)",
                    },
                    {
                        key: "files",
                        type: "file",
                        src: [],
                        description: "files // optional attachment files",
                    },
                ],
            },
        }),
        [
            {
                name: "200 OK - Support Request Sent",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Support request sent successfully",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Submit Review to Driver",
            method: "POST",
            pathSegments: ["feedback", "driver-review"],
            description:
                "### Submit Review to Driver\nAllows buyer to rate and review the driver after delivery completion. Updates driver average rating and total review count.\n\n- **Authentication:** Bearer Token (Role: `BUYER`)\n\n### Request Body Fields:\n- `orderId`: MongoId of the completed order (Required)\n- `rating`: Rating score integer from 1 to 5 (Required)\n- `comment`: Feedback review text (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        orderId: "672f10b7e21a224a5b112280",
                        rating: 5,
                        comment: "Driver arrived quickly and handled our delicate produce with care.",
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Driver Review Submitted",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Driver review submitted successfully",
                },
            },
            {
                name: "400 Bad Request - Review Already Submitted",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "Driver review already submitted for this order",
                },
            },
            {
                name: "400 Bad Request - No Driver Assigned",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "No driver found for this order",
                },
            },
        ],
    ),
];

// 10. NOTIFICATION MODULE
const notificationRequests = [
    withExamples(
        createRequest({
            name: "Get User Notifications",
            method: "GET",
            pathSegments: ["notification", "user-wise"],
            queryParams: [
                { key: "notificationType", value: "Delivery", description: "notificationType // optional" },
                { key: "page", value: "1", description: "page // optional" },
                { key: "limit", value: "10", description: "limit // optional" },
            ],
            description:
                "### View User Notifications\nRetrieves paginated in-app alerts and notifications for the authenticated user, optionally filtered by notification type. Automatically marks unread notifications as read.\n\n- **Authentication:** Bearer Token\n\n### Query Parameters:\n- `notificationType`: Filter by type: `Order`, `Delivery`, `System`, `Profile` // optional\n- `page`: Page index (default: 1) // optional\n- `limit`: Items per page (default: 10) // optional",
        }),
        [
            {
                name: "200 OK - Notifications Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Notifications fetched successfully",
                    data: {
                        notifications: [
                            {
                                id: "672f10b7e21a224a5b1122b0",
                                receiverId: "672f10b7e21a224a5b112233",
                                title: "Order Shipped",
                                content:
                                    "Your order ORD-1728891234567-8901 has been picked up by the driver.",
                                isRead: true,
                                notificationType: "Delivery",
                                createdAt: "2026-10-14T09:30:00.000Z",
                                updatedAt: "2026-10-14T10:00:00.000Z",
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - Filtered by Type",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Notifications fetched successfully",
                    data: {
                        notifications: [
                            {
                                id: "672f10b7e21a224a5b1122b1",
                                receiverId: "672f10b7e21a224a5b112233",
                                title: "New Order Placed",
                                content: "You have received a new purchase for Organic Kent Mangoes.",
                                isRead: true,
                                notificationType: "Order",
                                createdAt: "2026-10-14T09:00:00.000Z",
                                updatedAt: "2026-10-14T09:05:00.000Z",
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Notifications (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Notifications fetched successfully",
                    data: {
                        notifications: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
];

// 11. PAYMENT MODULE
const paymentRequests = [
    withExamples(
        createRequest({
            name: "Get Producer Earnings Summary",
            method: "GET",
            pathSegments: ["payment", "producer-earnings"],
            queryParams: [
                { key: "type", value: "weekly", description: "type (weekly, monthly, or yearly) (Required)" },
            ],
            description:
                "### Producer Earnings Analytics\nCalculates net payout earnings (90% of subtotal) from delivered orders grouped by weekly, monthly, or yearly intervals.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER`)\n\n### Query Parameters:\n- `type`: Grouping interval: `weekly`, `monthly`, or `yearly` (Required)",
        }),
        [
            {
                name: "200 OK - Weekly Earnings Breakdown",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer weekly earnings fetched successfully",
                    data: [
                        {
                            sat: 13500.0,
                            sun: 8200.5,
                            mon: 22400.0,
                            tue: 15600.0,
                            wed: 19800.0,
                            thu: 31200.0,
                            fri: 27500.0,
                        },
                    ],
                },
            },
            {
                name: "200 OK - Monthly Earnings Breakdown",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer monthly earnings fetched successfully",
                    data: [
                        {
                            jan: 45000.0,
                            feb: 52000.0,
                            mar: 68000.0,
                            apr: 74500.0,
                            may: 89000.0,
                            jun: 95000.0,
                            jul: 110000.0,
                            aug: 105000.0,
                            sep: 124000.0,
                            oct: 138200.0,
                            nov: 0.0,
                            dec: 0.0,
                        },
                    ],
                },
            },
            {
                name: "200 OK - Yearly Earnings Breakdown",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Producer yearly earnings fetched successfully",
                    data: [
                        {
                            "2024": 420000.0,
                            "2025": 890500.0,
                            "2026": 900700.0,
                        },
                    ],
                },
            },
            {
                name: "400 Bad Request - Invalid Earning Type",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "type must be one of the following values: yearly, monthly, weekly",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Send Withdraw Request",
            method: "POST",
            pathSegments: ["payment", "withdraw"],
            description:
                "### Request Fund Withdrawal\nSubmits a withdrawal request from available earnings balance for verified Producers or Drivers.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER` or `DRIVER`)\n\n### Request Body Fields:\n- `amount`: Withdrawal integer amount >= 1 (Required)",
            body: {
                mode: "raw",
                raw: JSON.stringify(
                    {
                        amount: 25000,
                    },
                    null,
                    2,
                ),
                options: { raw: { language: "json" } },
            },
        }),
        [
            {
                name: "200 OK - Withdraw Request Sent",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "Withdraw request sent successfully",
                },
            },
            {
                name: "400 Bad Request - Insufficient Balance",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "Insufficient balance",
                },
            },
            {
                name: "400 Bad Request - Pending Request Exists",
                statusCode: 400,
                statusText: "Bad Request",
                body: {
                    success: false,
                    statusCode: 400,
                    message: "You already have a pending withdraw request",
                },
            },
        ],
    ),
    withExamples(
        createRequest({
            name: "Get User Withdraw Requests",
            method: "GET",
            pathSegments: ["payment", "withdraw-requests"],
            queryParams: [
                { key: "status", value: "Pending", description: "status // optional" },
                { key: "page", value: "1", description: "page // optional" },
                { key: "limit", value: "10", description: "limit // optional" },
            ],
            description:
                "### View User Withdraw Requests\nRetrieves paginated withdrawal transaction requests submitted by the authenticated producer or driver.\n\n- **Authentication:** Bearer Token (Role: `PRODUCER` or `DRIVER`)\n\n### Query Parameters:\n- `status`: Filter by TransactionStatus: `Pending`, `Success`, `Failed` // optional\n- `page`: Page index (default: 1) // optional\n- `limit`: Items per page (default: 10) // optional",
        }),
        [
            {
                name: "200 OK - Withdraw Requests Found",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "User withdraw requests fetched successfully",
                    data: {
                        withdrawRequests: [
                            {
                                id: "672f10b7e21a224a5b1122e1",
                                userId: "672f10b7e21a224a5b112234",
                                amount: 25000,
                                status: "Pending",
                                createdAt: "2026-10-15T10:00:00.000Z",
                                updatedAt: "2026-10-15T10:00:00.000Z",
                            },
                        ],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            totalPage: 1,
                        },
                    },
                },
            },
            {
                name: "200 OK - No Withdraw Requests (Empty)",
                body: {
                    success: true,
                    statusCode: 200,
                    message: "User withdraw requests fetched successfully",
                    data: {
                        withdrawRequests: [],
                        meta: {
                            page: 1,
                            limit: 10,
                            total: 0,
                            totalPage: 0,
                        },
                    },
                },
            },
        ],
    ),
];

// Assemble full collection
const collection = {
    info: {
        _postman_id: "a7b3d291-f8e4-4c02-9988-agroconnect01",
        name: "Agro Connect Backend API",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        description:
            "# Agro Connect Server API Collection\nComplete Postman collection covering all backend endpoints for the Agro Connect marketplace platform.\n\n### Base Variables:\n- `baseUrl`: `http://localhost:4092/api/v1`\n- `serverUrl`: `http://localhost:4092`\n- `accessToken`: JWT Bearer Token (automatically set on Login)\n\n### Authentication:\nAll endpoints are protected with Bearer JWT by default unless explicitly decorated with `@IsPublic()`.",
    },
    auth: {
        type: "bearer",
        bearer: [
            {
                key: "token",
                value: "{{accessToken}}",
                type: "string",
            },
        ],
    },
    variable: [
        {
            key: "baseUrl",
            value: "http://localhost:4092/api/v1",
            type: "string",
        },
        {
            key: "serverUrl",
            value: "http://localhost:4092",
            type: "string",
        },
        {
            key: "accessToken",
            value: "",
            type: "string",
        },
    ],
    item: [
        {
            name: "00. System",
            description: "Server root health check and status endpoints.",
            item: systemRequests,
        },
        {
            name: "01. Auth",
            description:
                "User registration, OTP verification, authentication, password management, and role profile setups.",
            item: authRequests,
        },
        {
            name: "02. Admin",
            description:
                "Administrator operations including producer and driver approvals, catalog category management, driver assignments, coupons, and terms.",
            item: adminRequests,
        },
        {
            name: "03. Product",
            description:
                "Product management, image updates, marketplace catalog listings, filtering, top-rated products, and producer metrics.",
            item: productRequests,
        },
        {
            name: "04. Shopping",
            description: "Shopping cart items, quantity adjustments, and wishlist management.",
            item: shoppingRequests,
        },
        {
            name: "05. Order",
            description:
                "Order checkout, CinetPay payment verification, delivery OTP workflows, and discount coupon applications.",
            item: orderRequests,
        },
        {
            name: "06. Webhook",
            description: "CinetPay server-to-server notification callbacks.",
            item: webhookRequests,
        },
        {
            name: "07. Shipping Address",
            description: "Buyer destination delivery address management.",
            item: shippingAddressRequests,
        },
        {
            name: "08. Feedback",
            description:
                "Product review submissions, platform terms inquiries, and support ticket submissions.",
            item: feedbackRequests,
        },
        {
            name: "09. Notification",
            description: "User notifications and status updates.",
            item: notificationRequests,
        },
        {
            name: "10. Payment",
            description: "Producer earnings calculation, withdraw requests, and payout history.",
            item: paymentRequests,
        },
    ],
};

// Count endpoints and examples
let totalEndpoints = 0;
let totalExamples = 0;
let endpointsWithMultipleExamples = 0;
let fileUploadEndpoints = 0;
let optionalFieldEndpoints = 0;

function analyzeItems(items) {
    for (const item of items) {
        if (item.item && Array.isArray(item.item)) {
            analyzeItems(item.item);
        } else if (item.request) {
            totalEndpoints++;
            const numExamples = item.response ? item.response.length : 0;
            totalExamples += numExamples;
            if (numExamples > 1) {
                endpointsWithMultipleExamples++;
            }
            if (
                item.request.body &&
                item.request.body.mode === "formdata" &&
                item.request.body.formdata.some((f) => f.type === "file")
            ) {
                fileUploadEndpoints++;
            }
            if (
                item.request.description &&
                item.request.description.includes("// optional")
            ) {
                optionalFieldEndpoints++;
            }
        }
    }
}

analyzeItems(collection.item);

console.log(`Discovered & configured ${totalEndpoints} endpoints.`);
console.log(`Generated ${totalExamples} total successful response examples.`);
console.log(`${endpointsWithMultipleExamples} endpoints have multiple successful response examples.`);
console.log(`${fileUploadEndpoints} file-upload endpoints configured.`);
console.log(`${optionalFieldEndpoints} endpoints document optional fields.`);

// Output files
const postmanJsonPath = path.join(process.cwd(), "postman.json");
const postmanCollectionJsonPath = path.join(process.cwd(), "postman-collection.json");

const serialized = JSON.stringify(collection, null, 2);

fs.writeFileSync(postmanJsonPath, serialized, "utf8");
console.log(`Wrote collection to: ${postmanJsonPath}`);

fs.writeFileSync(postmanCollectionJsonPath, serialized, "utf8");
console.log(`Updated collection in: ${postmanCollectionJsonPath}`);
