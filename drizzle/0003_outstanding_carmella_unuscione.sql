ALTER TABLE `payment_history` ADD `stripePaymentIntentId` varchar(100);--> statement-breakpoint
ALTER TABLE `payment_history` ADD `stripeInvoiceId` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(100);