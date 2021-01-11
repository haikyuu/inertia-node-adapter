import { SinonSandbox } from 'sinon';

import { serverType } from '../koa.folio';

import { expressServer } from './express';
import { koaServer } from './koa';

export interface ServerOptions {
  sandbox: SinonSandbox;
}
export default function getServer(type: serverType, options: ServerOptions) {
  if (type === 'koa') {
    return koaServer(options);
  } else if (type === 'express') {
    return expressServer(options);
  }
  throw new Error('not supported server type');
}
