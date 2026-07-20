# Vula Career Guide

WhatsApp RIASEC career assessment platform for South African high school students.

## Project Structure

- **api/** — Vercel serverless functions (WhatsApp webhooks, report generation, admin/sponsor endpoints, cron jobs)
- **lib/** — Shared logic: assessment engine, career/RIASEC data, i18n, provinces
- **admin/** — React admin dashboard
- **web/** — Public marketing site and legal pages (privacy, terms, POPIA, PAIA, cookies, disclaimer)
- **supabase/migrations/** — PostgreSQL database schema
- **tests/** — Flow and integration tests

## Getting Started

1. Set up environment variables (see `.env.template`)
2. Deploy the API to Vercel (serverless functions in `api/`)
3. Deploy `admin/` to Vercel (static)
4. Create a Supabase project and run migrations
5. Configure the Twilio WhatsApp webhook

## Key Features

- 30-question RIASEC assessment via WhatsApp
- Claude AI-powered career insights, including an AI Impact (Low/Medium/High) rating per matched career
- Subject and qualification pathway recommendations, including TVET/artisan routes
- Sponsor course placement, matched by learner profile and city
- Free downloadable PDF report
- Institution/sponsor lead management dashboard

## Tech Stack

- API: Vercel serverless functions, Node.js, Supabase, Anthropic SDK, Twilio
- Admin: React 18, TypeScript, Tanstack Query, Supabase Auth
- Database: PostgreSQL (Supabase)
- Hosting: Vercel serverless
