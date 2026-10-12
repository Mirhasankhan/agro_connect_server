import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import config from "@/config";
import { ApiError } from "@/common/errors/api_error";

export interface CinetPayCustomer {
    id?: string;
    name?: string;
    surname?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    city?: string;
    country?: string;
    state?: string;
    zipCode?: string;
}

export interface CinetPayPaymentInitParams {
    transactionId: string;
    amount: number;
    currency?: string;
    description: string;
    channels?: string;
    metadata?: Record<string, unknown>;
    customer?: CinetPayCustomer;
    notifyUrl?: string;
    returnUrl?: string;
}

export interface CinetPayPaymentInitResponse {
    success: boolean;
    paymentToken: string;
    paymentUrl: string;
    transactionId: string;
    rawResponse?: unknown;
}

export type CinetPayTransactionStatus =
    "ACCEPTED" | "REFUSED" | "PENDING" | "CANCELLED" | "UNKNOWN";

export interface CinetPayVerificationResult {
    isSuccess: boolean;
    isPending: boolean;
    isFailed: boolean;
    status: CinetPayTransactionStatus;
    code: string;
    message: string;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    transactionId: string;
    operatorId?: string;
    paymentDate?: string;
    metadata?: Record<string, unknown>;
    rawResponse: unknown;
}

interface CinetPayInitApiResponse {
    code?: string | number;
    message?: string;
    description?: string;
    payment_url?: string;
    payment_token?: string;
    data?: {
        payment_url?: string;
        payment_token?: string;
    };
}

interface CinetPayCheckApiResponse {
    code?: string | number;
    message?: string;
    description?: string;
    data?: {
        amount?: string | number;
        currency?: string;
        status?: string;
        payment_method?: string;
        description?: string;
        metadata?: string | Record<string, unknown>;
        operator_id?: string;
        payment_date?: string;
    };
}

@Injectable()
export class CinetPayService {
    private readonly logger = new Logger(CinetPayService.name);
    private readonly httpClient: AxiosInstance;

    private readonly apiKey: string;
    private readonly siteId: string;
    private readonly apiUrl: string;
    private readonly notifyUrl: string;
    private readonly returnUrl: string;
    private readonly defaultCurrency: string;
    private readonly defaultChannels: string;

    constructor() {
        this.apiKey = config.cinetpay.api_key;
        this.siteId = config.cinetpay.site_id;
        this.apiUrl =
            config.cinetpay.api_url ||
            "https://api-checkout.cinetpay.com/v2/payment";
        this.defaultCurrency = config.cinetpay.currency || "XOF";
        this.defaultChannels = config.cinetpay.channels || "ALL";

        const backendBase = config.url.backend || "http://localhost:4092";
        this.notifyUrl =
            config.cinetpay.notify_url ||
            `${backendBase}/api/v1/webhook/cinetpay`;

        const frontendBase =
            config.url.payment_success ||
            config.url.frontend ||
            "http://localhost:3000";
        this.returnUrl = config.cinetpay.return_url || frontendBase;

        this.httpClient = axios.create({
            timeout: 15000,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * Initializes a hosted payment checkout session with CinetPay.
     * Generates and returns the CinetPay hosted checkout URL for the customer.
     */
    async initiatePayment(
        params: CinetPayPaymentInitParams,
    ): Promise<CinetPayPaymentInitResponse> {
        if (!this.apiKey || !this.siteId) {
            this.logger.error(
                "CinetPay API key or Site ID is missing in configuration.",
            );
            throw new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CinetPay payment gateway is not properly configured",
            );
        }

        const notifyUrl = params.notifyUrl || this.notifyUrl;
        const returnUrl = params.returnUrl || this.returnUrl;
        const currency = (
            params.currency || this.defaultCurrency
        ).toUpperCase();
        const channels = params.channels || this.defaultChannels;

        const payload: Record<string, unknown> = {
            apikey: this.apiKey,
            site_id: this.siteId,
            transaction_id: params.transactionId,
            amount: Math.round(params.amount),
            currency,
            description: params.description,
            notify_url: notifyUrl,
            return_url: returnUrl,
            channels,
        };

        if (params.metadata) {
            payload.metadata = JSON.stringify(params.metadata);
        }

        if (params.customer) {
            if (params.customer.id) payload.customer_id = params.customer.id;
            if (params.customer.name)
                payload.customer_name = params.customer.name;
            if (params.customer.surname)
                payload.customer_surname = params.customer.surname;
            if (params.customer.email)
                payload.customer_email = params.customer.email;
            if (params.customer.phoneNumber)
                payload.customer_phone_number = params.customer.phoneNumber;
            if (params.customer.address)
                payload.customer_address = params.customer.address;
            if (params.customer.city)
                payload.customer_city = params.customer.city;
            if (params.customer.country)
                payload.customer_country = params.customer.country;
            if (params.customer.state)
                payload.customer_state = params.customer.state;
            if (params.customer.zipCode)
                payload.customer_zip_code = params.customer.zipCode;
        }

        try {
            this.logger.log(
                `Requesting CinetPay checkout URL for transaction: ${params.transactionId}`,
            );

            const response =
                await this.httpClient.post<CinetPayInitApiResponse>(
                    this.apiUrl,
                    payload,
                );
            const responseData = response.data;

            const code = String(responseData?.code ?? "");
            const paymentUrl =
                responseData?.data?.payment_url || responseData?.payment_url;
            const paymentToken =
                responseData?.data?.payment_token ||
                responseData?.payment_token ||
                "";

            if ((code === "201" || code === "200") && paymentUrl) {
                return {
                    success: true,
                    paymentToken,
                    paymentUrl,
                    transactionId: params.transactionId,
                    rawResponse: responseData,
                };
            }

            const errorDesc =
                responseData?.description ||
                responseData?.message ||
                "Initialization rejected by CinetPay";

            this.logger.error(
                `CinetPay payment initialization failed: ${errorDesc} (code: ${code})`,
            );

            throw new ApiError(
                HttpStatus.BAD_GATEWAY,
                `CinetPay checkout initialization failed: ${errorDesc}`,
            );
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }

            let message = "Unknown CinetPay communication error";
            let status: number | undefined;

            if (axios.isAxiosError(error)) {
                status = error.response?.status;
                const errorData = error.response?.data as
                    CinetPayInitApiResponse | undefined;
                message =
                    errorData?.description ||
                    errorData?.message ||
                    error.message ||
                    message;
            } else if (error instanceof Error) {
                message = error.message;
            }

            this.logger.error(
                `CinetPay API call error [HTTP ${status ?? "N/A"}]: ${message}`,
            );

            throw new ApiError(
                HttpStatus.BAD_GATEWAY,
                `Failed to communicate with CinetPay payment service: ${message}`,
            );
        }
    }

    /**
     * Performs a server-to-server transaction status verification using CinetPay official check API.
     * CinetPay official check endpoint: POST https://api-checkout.cinetpay.com/v2/payment/check
     */
    async checkTransactionStatus(
        transactionId: string,
    ): Promise<CinetPayVerificationResult> {
        if (!this.apiKey || !this.siteId) {
            this.logger.error(
                "CinetPay API key or Site ID missing for verification.",
            );
            throw new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CinetPay payment gateway is not properly configured",
            );
        }

        const checkUrl = `${this.apiUrl.replace(/\/payment\/?$/, "")}/payment/check`;

        const payload = {
            apikey: this.apiKey,
            site_id: this.siteId,
            transaction_id: transactionId,
        };

        try {
            this.logger.log(
                `Verifying CinetPay transaction server-to-server: ${transactionId}`,
            );

            const response =
                await this.httpClient.post<CinetPayCheckApiResponse>(
                    checkUrl,
                    payload,
                );
            const resData = response.data;

            const code = String(resData?.code ?? "");
            const message = resData?.message || "";
            const data = resData?.data || {};

            const rawStatus = String(data?.status || "").toUpperCase();
            let parsedStatus: CinetPayTransactionStatus = "UNKNOWN";

            if (rawStatus === "ACCEPTED") {
                parsedStatus = "ACCEPTED";
            } else if (rawStatus === "REFUSED") {
                parsedStatus = "REFUSED";
            } else if (rawStatus === "PENDING" || rawStatus === "INITIATED") {
                parsedStatus = "PENDING";
            } else if (rawStatus === "CANCELLED" || rawStatus === "EXPIRED") {
                parsedStatus = "CANCELLED";
            }

            let parsedMetadata: Record<string, unknown> | undefined;
            if (data?.metadata) {
                try {
                    parsedMetadata =
                        typeof data.metadata === "string"
                            ? (JSON.parse(data.metadata) as Record<
                                  string,
                                  unknown
                              >)
                            : (data.metadata as Record<string, unknown>);
                } catch {
                    parsedMetadata = undefined;
                }
            }

            return {
                isSuccess: parsedStatus === "ACCEPTED",
                isPending: parsedStatus === "PENDING",
                isFailed:
                    parsedStatus === "REFUSED" || parsedStatus === "CANCELLED",
                status: parsedStatus,
                code,
                message,
                amount:
                    data?.amount !== undefined
                        ? Number(data.amount)
                        : undefined,
                currency: data?.currency,
                paymentMethod: data?.payment_method,
                transactionId,
                operatorId: data?.operator_id,
                paymentDate: data?.payment_date,
                metadata: parsedMetadata,
                rawResponse: resData,
            };
        } catch (error: unknown) {
            let message = "Failed to check transaction status";
            let statusCode = "500";
            let rawResponse: unknown;

            if (axios.isAxiosError(error)) {
                statusCode = String(error.response?.status || "500");
                const errorData = error.response?.data as
                    CinetPayCheckApiResponse | undefined;
                rawResponse = errorData;
                message =
                    errorData?.description ||
                    errorData?.message ||
                    error.message ||
                    message;
            } else if (error instanceof Error) {
                message = error.message;
            }

            this.logger.error(
                `CinetPay transaction check error for ${transactionId}: ${message}`,
            );

            return {
                isSuccess: false,
                isPending: false,
                isFailed: true,
                status: "UNKNOWN",
                code: statusCode,
                message,
                transactionId,
                rawResponse,
            };
        }
    }
}
