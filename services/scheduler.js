export function normalizeSchedule(value){const d=new Date(value);if(Number.isNaN(d.getTime()))throw new Error('Waktu schedule tidak valid.');return d.toISOString();}
