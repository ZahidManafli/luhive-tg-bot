import express, { Request, Response } from 'express';
import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { notifyNewEvent, notifyEventUpdate } from '../services/notification.js';
import { Event } from '../services/supabase.js';

export interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Event;
  old_record?: Event;
  schema: string;
}

export function createWebhookServer(bot: Telegraf<any>): express.Application {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Supabase webhook endpoint for new/updated events
  app.post('/webhook/event', async (req: Request, res: Response) => {
    try {
      // Verify webhook secret
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${config.webhookSecret}`) {
        console.warn('Webhook: Invalid authorization');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const payload: WebhookPayload = req.body;
      console.log(`Webhook received: ${payload.type} on ${payload.table}`);

      // Handle new published events
      if (payload.type === 'INSERT' && payload.record.status === 'published') {
        console.log(`New event published: ${payload.record.title}`);
        const result = await notifyNewEvent(bot, payload.record);
        res.json({
          success: true,
          message: 'Notifications sent',
          ...result,
        });
        return;
      }

      // Handle event updates (published -> cancelled)
      if (payload.type === 'UPDATE') {
        const oldRecord = payload.old_record;
        const newRecord = payload.record;

        // Event was cancelled
        if (oldRecord?.status === 'published' && newRecord.status === 'cancelled') {
          console.log(`Event cancelled: ${newRecord.title}`);
          const result = await notifyEventUpdate(bot, newRecord, 'cancelled');
          res.json({
            success: true,
            message: 'Cancellation notifications sent',
            ...result,
          });
          return;
        }

        // Event was updated (and is still published)
        if (newRecord.status === 'published') {
          // Only notify if significant changes were made
          const significantChange =
            oldRecord?.start_time !== newRecord.start_time ||
            oldRecord?.location_address !== newRecord.location_address ||
            oldRecord?.title !== newRecord.title;

          if (significantChange) {
            console.log(`Event updated: ${newRecord.title}`);
            const result = await notifyEventUpdate(bot, newRecord, 'updated');
            res.json({
              success: true,
              message: 'Update notifications sent',
              ...result,
            });
            return;
          }
        }

        // Event was just published (draft -> published)
        if (oldRecord?.status !== 'published' && newRecord.status === 'published') {
          console.log(`Event published: ${newRecord.title}`);
          const result = await notifyNewEvent(bot, newRecord);
          res.json({
            success: true,
            message: 'Notifications sent',
            ...result,
          });
          return;
        }
      }

      // Handle event deletion
      if (payload.type === 'DELETE' && payload.old_record?.status === 'published') {
        console.log(`Event deleted: ${payload.old_record.title}`);
        const result = await notifyEventUpdate(bot, payload.old_record, 'deleted');
        res.json({
          success: true,
          message: 'Deletion notifications sent',
          ...result,
        });
        return;
      }

      res.json({ success: true, message: 'No action taken' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

export function startWebhookServer(bot: Telegraf<any>): void {
  const app = createWebhookServer(bot);

  app.listen(config.port, () => {
    console.log(`🌐 Webhook server running on port ${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   Event webhook: http://localhost:${config.port}/webhook/event`);
  });
}

