# Pathfinder

WhatsApp RIASEC career assessment platform for South African high school students.

## Project Structure

- **backend/** — Node.js/TypeScript Express API
- **admin/** — React admin dashboard
- **supabase/migrations/** — PostgreSQL database schema

## Getting Started

1. Set up environment variables (see `.env.example`)
2. Deploy backend to Vercel (serverless)
3. Deploy admin to Vercel (static)
4. Create Supabase project and run migrations
5. Configure Twilio WhatsApp webhook

## Key Features

- 40-question RIASEC assessment via WhatsApp
- Claude AI-powered career insights
- College & course recommendations
- Institution lead management dashboard
- Student profile tracking

## Tech Stack

- Backend: Node.js, TypeScript, Express, Supabase, Anthropic SDK, Twilio
- Admin: React 18, TypeScript, Tanstack Query, Supabase Auth
- Database: PostgreSQL (Supabase)
- Hosting: Vercel serverless
