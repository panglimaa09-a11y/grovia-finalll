export function billingConfigured(){return Boolean(process.env.PAYMENT_API_KEY&&process.env.PAYMENT_WEBHOOK_SECRET)}
