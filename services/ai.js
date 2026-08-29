export async function generateWithProvider(){if(!process.env.AI_API_KEY)return {configured:false};throw new Error('AI provider adapter belum dikonfigurasi.');}
