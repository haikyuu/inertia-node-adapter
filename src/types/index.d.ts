import { Inertia } from "../lib/expressAdapter";
import { Flash } from "../lib/expressFlash";

type FlashMessages = 'info' | 'error' | 'success';
declare global {
    namespace Express {
        interface Request {
            Inertia: Inertia
            flash: Flash<FlashMessages>
        }
    }
}


declare module 'express-session' {
    export interface SessionData {
        flashMessages: Record<string, string[]>
    }
}