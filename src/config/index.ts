import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
    env: process.env.NODE_ENV,
    port: process.env.PORT || 5000,
    company_name: process.env.COMPANY_NAME,
    url: {
        frontend: process.env.FRONTEND_URL,
        backend: process.env.BACKEND_URL,
        uploads: process.env.BACKEND_UPLOADS_URL,
        stream: process.env.BACKEND_STREAM_URL,
        reset_pass: process.env.RESET_PASS_URL,
        payment_success: process.env.PAYMENT_SUCCESS_URL,
        payment_failed: process.env.PAYMENT_FAILED_URL,
    },
    cinetpay: {
        api_url:
            process.env.CINETPAY_API_URL ||
            "https://api-checkout.cinetpay.com/v2/payment",
        api_key: process.env.CINETPAY_API_KEY || "",
        site_id: process.env.CINETPAY_SITE_ID || "",
        notify_url: process.env.CINETPAY_NOTIFY_URL || "",
        return_url:
            process.env.CINETPAY_RETURN_URL ||
            process.env.PAYMENT_SUCCESS_URL ||
            "",
        currency: process.env.CINETPAY_CURRENCY || "XOF",
        channels: process.env.CINETPAY_CHANNELS || "ALL",
    },
    jwt: {
        jwt_secret: process.env.JWT_SECRET,
        jwt_secret_expires_in: isNaN(Number(process.env.JWT_SECRET_EXPIRES_IN))
            ? 604800
            : Number(process.env.JWT_SECRET_EXPIRES_IN),
        refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
        refresh_token_expires_in: isNaN(
            Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
        )
            ? 2592000
            : Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
        reset_token_secret: process.env.RESET_TOKEN_SECRET,
        reset_token_expires_in: isNaN(
            Number(process.env.RESET_TOKEN_EXPIRES_IN),
        )
            ? 900
            : Number(process.env.RESET_TOKEN_EXPIRES_IN),
    },
    smtp: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        sender: process.env.SENDER_EMAIL,
    },
    paypal: {
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
        mode: process.env.PAYPAL_MODE,
    },
    sendGrid: {
        api_key: process.env.SENDGRID_API_KEY,
        sender: process.env.SENDGRID_EMAIL,
    },
    resend: {
        api_key: process.env.RESEND_API_KEY,
        sender: process.env.RESEND_EMAIL,
    },
    brevo: {
        api_key: process.env.BREVO_API_KEY,
        sender: process.env.BREVO_EMAIL,
    },
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        bucketName: process.env.AWS_BUCKET_NAME,
    },
    password: {
        salt: isNaN(Number(process.env.PASSWORD_SALT))
            ? 10
            : Number(process.env.PASSWORD_SALT),
    },
};
