import { Request } from 'express';

import { Inertia } from '../lib/expressAdapter';
import { Flash } from '../lib/expressFlash';

type FlashMessages = 'info' | 'error' | 'success';
declare namespace global {
  type Req = Request &
    Express.Request & {
      Inertia: Inertia;
      flash: Flash<FlashMessages>;
    };
}
declare module 'express-session' {
  export interface SessionData {
    flashMessages: Record<string, string[]>;
    xInertiaCurrentComponent: string | undefined;
  }
}
