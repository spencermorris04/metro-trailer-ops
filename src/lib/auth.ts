import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";

import { db, schema } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/server/notification-service";

function getBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "replace-me-with-a-long-random-secret";
}

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  secret: getAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
      twoFactor: schema.authTwoFactors,
    },
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your Metro Trailer password",
        text: `Reset your Metro Trailer password using this secure link: ${url}`,
        relatedEntityType: "auth_user",
        relatedEntityId: user.id,
      });
    },
    onPasswordReset: async ({ user }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Your Metro Trailer password was changed",
        text: "Your Metro Trailer password was changed successfully. If you did not perform this action, contact support immediately.",
        relatedEntityType: "auth_user",
        relatedEntityId: user.id,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your Metro Trailer email",
        text: `Verify your Metro Trailer account using this secure link: ${url}`,
        relatedEntityType: "auth_user",
        relatedEntityId: user.id,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
    freshAge: 60 * 10,
    deferSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  plugins: [
    nextCookies(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendTransactionalEmail({
          to: email,
          subject: "Metro Trailer verification code",
          text: `Your Metro Trailer verification code for ${type} is ${otp}.`,
          relatedEntityType: "auth_email_otp",
          relatedEntityId: email,
        });
      },
    }),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendTransactionalEmail({
            to: user.email,
            subject: "Metro Trailer authentication code",
            text: `Your Metro Trailer authentication code is ${otp}.`,
            relatedEntityType: "auth_user",
            relatedEntityId: user.id,
          });
        },
      },
    }),
  ],
});
