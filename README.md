# Luhive Telegram Bot

A Telegram bot for the Luhive community platform. Users can browse communities, view events, register for events, and receive notifications when new events are published.

## Features

- 🔐 **Login/Logout** - Connect your Luhive account via email/password
- 📋 **Communities** - Browse, join, and leave communities
- 📅 **Events** - View and register for upcoming events
- 🔔 **Notifications** - Receive alerts when subscribed communities publish new events

## Setup

### 1. Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Database Setup

Run the SQL migration in your Supabase SQL Editor:

```sql
-- See migrations/001_create_telegram_users.sql
```

### 3. Environment Variables

Copy `env.example` to `.env` and fill in the values:

```bash
cp env.example .env
```

Required variables:
- `TELEGRAM_BOT_TOKEN` - Your bot token from BotFather
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (from project settings)
- `WEBHOOK_SECRET` - Random secret for securing webhook endpoints
- `APP_BASE_URL` - Your Luhive web app URL (for links in messages)

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Bot

Development mode with hot reload:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Supabase Webhook Setup

To enable real-time event notifications, set up a Database Webhook in Supabase:

1. Go to your Supabase dashboard → Database → Webhooks
2. Create a new webhook with these settings:
   - **Name:** `telegram-event-notifications`
   - **Table:** `events`
   - **Events:** `INSERT`, `UPDATE`
   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** `https://your-bot-server.com/webhook/event`
   - **Headers:**
     - `Authorization`: `Bearer YOUR_WEBHOOK_SECRET`
     - `Content-Type`: `application/json`

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and menu |
| `/communities` | Browse all communities |
| `/events` | View upcoming events from your communities |
| `/login` | Connect your Luhive account |
| `/logout` | Disconnect your account |
| `/help` | Show help information |

## Project Structure

```
src/
├── index.ts              # Entry point
├── config.ts             # Environment configuration
├── bot/
│   ├── commands/         # Command handlers
│   │   ├── start.ts
│   │   ├── login.ts
│   │   ├── communities.ts
│   │   ├── events.ts
│   │   └── help.ts
│   └── menus.ts          # Inline keyboards
├── services/
│   ├── supabase.ts       # Database client
│   ├── auth.ts           # Authentication
│   ├── community.ts      # Community operations
│   ├── event.ts          # Event operations
│   └── notification.ts   # Send notifications
└── webhook/
    └── server.ts         # Express webhook server
```

## Development

Type checking:
```bash
npm run typecheck
```

Build:
```bash
npm run build
```

## License

ISC

