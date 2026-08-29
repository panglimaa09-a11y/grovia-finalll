export const apiOk = (data) => ({ ok: true, data });
export const apiError = (code, message, details) => ({ ok:false, error:{ code, message, ...(details===undefined?{}:{details}) } });
