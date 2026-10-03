import config from "@/config";

const baseEmailTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
</head>
<body style="margin:0;padding:32px;background:#f1f5f9;font-family:Segoe UI,Tahoma,Verdana,sans-serif;color:#334155;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.08);">

        <div style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:24px;text-align:center;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">${title}</h2>
        </div>

        <div style="padding:32px;text-align:center;">
            ${content}
        </div>

        <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b;">
            This is an automated message, please do not reply.<br /><br />
            © ${new Date().getFullYear()} ${config.company_name}. All rights reserved.
        </div>

    </div>
</body>
</html>
`;

export const generateEmailVerifyTemplate = (link: string) =>
    baseEmailTemplate(
        "Verify Your Email",
        `
        <p style="font-size:15px;color:#64748b;margin-bottom:24px;">
            Please confirm your email address to complete your registration.
        </p>

        <a href="${link}"
           style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;
                  text-decoration:none;border-radius:8px;font-weight:600;">
            Verify Email
        </a>

        <p style="font-size:13px;color:#64748b;margin-top:24px;">
            This link is valid for <strong>15 minutes</strong>.
        </p>
        `,
    );

export const generateVerifyOTPTemplate = (otp: string) =>
    baseEmailTemplate(
        "Verify Your Email",
        `
        <p style="font-size:15px;color:#64748b;margin-bottom:24px;">
            Use the OTP below to verify your email address:
        </p>

        <div style="display:inline-block;padding:16px 40px;background:#2563eb;color:#ffffff;
                    font-size:26px;font-weight:700;letter-spacing:4px;border-radius:8px;">
            ${otp}
        </div>

        <p style="font-size:13px;color:#64748b;margin-top:24px;">
            This code is valid for <strong>15 minutes</strong>.
        </p>
        `,
    );

export const generateForgetPasswordTemplate = (link: string) =>
    baseEmailTemplate(
        "Reset Your Password",
        `
        <p style="font-size:15px;color:#64748b;margin-bottom:24px;">
            We received a request to reset your password.
        </p>

        <a href="${link}"
           style="display:inline-block;padding:14px 28px;background:#2563eb;
                  color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
            Reset Password
        </a>

        <p style="font-size:13px;color:#64748b;margin-top:24px;">
            This link is valid for <strong>15 minutes</strong>.
        </p>
        `,
    );

export const resetPasswordEmail = (username: string, otp: string) => {
  const html = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Header -->
      <div style="background-color: #27c074ff; padding: 20px; text-align: center;">
        <img src="https://s3.zenex.cloud/emdadullah/uploads/dark/profileImage/1789461199915-brjm7pyvjg5.png" alt="Company Logo" style="height: 80px; margin-bottom: 10px;" />
        <h2 style="color: #fff; margin: 0;">Password Reset</h2>
      </div>

      <!-- Body -->
      <div style="padding: 30px; text-align: center;">
        <p style="font-size: 16px; color: #00c2d1; margin-bottom: 20px;">
          Hi <b>${username}</b>,
        </p>
        <p style="font-size: 16px; color: #555;">
          Use the verification code below to reset your password:
        </p>

        <h1 style="color: #00c2d1; font-size: 36px; letter-spacing: 4px; margin: 15px 0;">${otp}</h1>

        <p style="font-size: 14px; color: #777;">
          This OTP is valid for <b>5 minutes</b>. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} JH Trade. All rights reserved.
      </div>
    </div>
  </div>
  `;
  return html;
};


export const emailBody = (username: string, otp: string) => {
    const html = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); overflow: hidden;">
      
      <!-- Header -->
     <div style="background-color: #27c074ff; padding: 20px; text-align: center;">
        <img src="https://s3.zenex.cloud/emdadullah/uploads/dark/profileImage/1789461199915-brjm7pyvjg5.png" alt="Company Logo" style="height: 80px; margin-bottom: 10px;" />
        <h2 style="color: #fff; margin: 0;">Sign Up Verification</h2>
      </div>

      <!-- Body -->
      <div style="padding: 30px; text-align: center;">
        <p style="font-size: 16px; color: #00c2d1; margin-bottom: 20px;">
          Hi <b>${username}</b>,
        </p>
        <p style="font-size: 16px; color: #555;">
          Your verification code is:
        </p>

        <h1 style="color: #00c2d1; font-size: 36px; margin: 15px 0;">${otp}</h1>

        <p style="font-size: 14px; color: #777;">
          This OTP is valid for <b>5 minutes</b>. If you did not request this, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} JH Trade. All rights reserved.
      </div>
    </div>
  </div>
  `;
    return html;
};

export const emailBodyForDeliveryCompletion = (orderId: string, otp: string) =>
    baseEmailTemplate(
        "Delivery Completion Verification",
        `
        <p style="font-size:15px;color:#64748b;margin-bottom:24px;">
            Use the OTP below to confirm delivery for order
            <strong style="color:#334155;">${orderId}</strong>.
        </p>

        <div style="display:inline-block;padding:16px 40px;background:#2563eb;color:#ffffff;
                    font-size:26px;font-weight:700;letter-spacing:4px;border-radius:8px;">
            ${otp}
        </div>

        <p style="font-size:13px;color:#64748b;margin-top:24px;">
            Share this code with the delivery agent only when your order has been delivered.
        </p>

        <p style="font-size:13px;color:#64748b;margin-top:12px;">
            If you did not receive this delivery, please contact support.
        </p>
        `,
    );
