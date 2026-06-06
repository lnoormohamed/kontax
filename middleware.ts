import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
});

export const config = {
  matcher: [
    "/((?!_next|_next/image|_next/static|favicon.ico|api/auth|api/trpc|login|register).*)",
  ],
};
