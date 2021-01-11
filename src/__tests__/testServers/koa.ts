import path from 'path';

import Router from '@koa/router';
import stringify from 'json-stable-stringify';
import Koa, { DefaultContext } from 'koa';
import session from 'koa-session';
import serve from 'koa-static';

import inertia, { Inertia, Page } from '../../lib/koaAdapter';
import flash, { Flash } from '../../lib/koaFlash';

import { ServerOptions } from '.';

export function getHtml(page: Page) {
  return `<!DOCTYPE html><html dir="ltr" lang="en">
<head><meta charset="utf-8"><title>Inertia adapter</title></head>
<body><div data-page='${stringify(page)}'></div>
</body></html>`;
}
const version = '1';

export function koaServer({ sandbox }: ServerOptions) {
  const app = new Koa();

  app.keys = ['some secret'];
  app.use(
    session(
      {
        maxAge: 86400000,
      },
      app
    )
  );
  const fakes = {
    numbers: sandbox.fake.resolves([1, 2, 3]),
    bigNumbers: sandbox.fake.resolves([44, 33, 1123]),
  };
  const pages = {
    index: { component: 'index', props: { name: 'SERVER' }, url: '/', version },
    home: { component: 'app-home', props: { name: 1 }, url: '/home', version },
    partial: {
      component: 'partial-component',
      version,
      url: '/partial-optimized',
      props: {
        numbers: fakes.numbers,
        bigNumbers: fakes.bigNumbers,
      },
    },
  };
  const metadata = { fakes, pages };

  type FlashMessages = 'info' | 'error' | 'success';
  const router = new Router<
    DefaultContext,
    { Inertia: Inertia; flash: Flash<FlashMessages> }
  >();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore this fixes a bug with session trying to access app.keys using this.keys
  router.keys = app.keys;
  router.get('/flash', async (ctx, next) => {
    // set session data
    ctx.flash.setFlashMessage('success', 'User created successfully');
    ctx.Inertia.render(pages.home);
    return next();
  });
  router.get('/home', async (ctx, next) => {
    ctx.Inertia.render(pages.home);
    return next();
  });

  router.post('/home', async (ctx, next) => {
    ctx.Inertia.render(pages.home);
    return next();
  });

  router.get('/partial-optimized', async (ctx, next) => {
    if (ctx.query?.redirect) {
      await ctx.Inertia.render(pages.home);
    } else {
      await ctx.Inertia.render(pages.partial);
    }
    return next();
  });
  app.use(flash<FlashMessages>());
  app.use(
    serve(path.join(__dirname, '..', '..', 'www'), { brotli: true, gzip: true })
  );
  app.use(
    inertia({
      version,
      html: getHtml,
      flashMessages: (ctx) => ctx.flash.flashAll(),
    })
  );

  app.use(router.routes());
  app.use(router.allowedMethods());
  return { app, metadata, sandbox };
}
