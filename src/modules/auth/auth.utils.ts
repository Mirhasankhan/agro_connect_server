export const generateOTP = (length = 4, expiryMinutes = 5) => {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;

    const otp = Math.floor(min + Math.random() * (max - min + 1)).toString();
    const otpExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return { otp, otpExpiry };
};

export const generateOrderId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";

    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `AC-${code}`;
};
