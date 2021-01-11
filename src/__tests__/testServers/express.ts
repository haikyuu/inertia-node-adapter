
import express from 'express';
import session from 'express-session';
import stringify from 'json-stable-stringify';

import inertia, { Page } from '../../lib/expressAdapter';
import flash from '../../lib/expressFlash';

import { ServerOptions } from '.';

export function getHtml(page: Page) {
    return `<!DOCTYPE html><html dir="ltr" lang="en">
<head><meta charset="utf-8"><title>Inertia adapter</title></head>
<body><div data-page='${stringify(page)}'></div>
</body></html>`;
}
const version = '1';

export function expressServer({ sandbox }: ServerOptions) {
    const app = express();

    app.use(session({ secret: "secret" }));
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

    const router = express.Router()

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore this fixes a bug with session trying to access app.keys using this.keys
    router.keys = app.keys;
    router.get('/flash', async (req, _res, next) => {
        // set session data
        req.flash.setFlashMessage('success', 'User created successfully');
        req.Inertia.render(pages.home);
        return next();
    });
    router.get('/home', async (req, _res, next) => {
        req.Inertia.render(pages.home);
        return next();
    });

    router.post('/home', async (req, _res, next) => {
        req.Inertia.render(pages.home);
        return next();
    });

    router.get('/partial-optimized', async (req, _res, next) => {
        if (req.query?.redirect) {
            await req.Inertia.render(pages.home);
        } else {
            await req.Inertia.render(pages.partial);
        }
        return next();
    });
    app.use(flash());
    app.use(
        inertia({
            version,
            html: getHtml,
            flashMessages: (req) => {
                const messages = req.flash.flashAll()
                return messages
            },
        })
    );
    app.use(router)
    return { app, metadata, sandbox };
}
