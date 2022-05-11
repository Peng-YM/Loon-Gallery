import Axios from 'axios';
import {BACKEND_BASE} from "@/config";

export const axios = Axios.create({
    baseURL: `${BACKEND_BASE}/api/gallery`,
    timeout: 10000
});