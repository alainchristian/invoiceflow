import "dotenv/config";
import { createApp } from "./app.js";
import { startRecurringInvoiceScheduler } from "./modules/recurring-invoices/scheduler.js";
import { startReminderScheduler } from "./modules/reminders/scheduler.js";
import { startStatementScheduler } from "./modules/statements/scheduler.js";

const app = createApp();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`InvoiceFlow API listening on port ${PORT}`);
});

startRecurringInvoiceScheduler();
startReminderScheduler();
startStatementScheduler();
