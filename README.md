# Kontax

Kontax is a contact app built on the **T3 Stack** for saving and managing people your users meet.

## Stack

- Next.js + App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- tRPC
- Tailwind CSS

## Setup

1. Install dependencies: `npm install`
2. Start PostgreSQL (or run `./start-database.sh`)
3. Push Prisma schema: `npm run db:push`
4. Start development server: `npm run dev`

The app includes:

- Contact model in Prisma (`prisma/schema.prisma`)
- Contact tRPC router (`src/server/api/routers/contact.ts`)
- Contact-first homepage UI (`src/app/page.tsx`)
