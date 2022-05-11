const DEBUG = process.env.NODE_ENV === 'development';
const domain = process.env.DOMIAN || 'https://🎈.com';
export const BACKEND_BASE = DEBUG ? `http://localhost:3000` : domain;