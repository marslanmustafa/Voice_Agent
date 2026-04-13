/**
 * VoiceAgent — NextAuth Configuration
 * Credentials (email/password) + Google OAuth
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/email/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email:    credentials.email,
                password: credentials.password,
              }),
            }
          );
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id:          data.user.id,
            email:       data.user.email,
            name:        data.user.name,
            image:       data.user.avatar_url,
            accessToken: data.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user, account }) {
      // Google OAuth: exchange Google id_token for our own JWT
      if (account?.provider === "google" && account.id_token) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/google`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: account.id_token }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.access_token;
            token.userId      = data.user.id;
          }
        } catch {
          // Google OAuth backend not configured — token stays undefined
        }
      }
      if (user) {
        token.accessToken = (user as any).accessToken ?? token.accessToken;
        token.userId      = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).userId      = token.userId;
      return session;
    },
  },
});
