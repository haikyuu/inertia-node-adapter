import debug from 'debug';
import { Request, RequestHandler } from 'express';

const log = debug('inertia-node-adapter:express');

type props = Record<string | number | symbol, unknown>;
export type Options = {
    readonly version: string;
    readonly html: (page: Page, viewData: props) => string;
    readonly flashMessages?: (
        req: Request<Record<string, unknown>>
    ) => props;
};

export type Page = {
    readonly component: string;
    props: props;
    readonly url: string;
    readonly version: string;
};
export type Inertia = {
    readonly setViewData: (viewData: props) => Inertia;
    readonly shareProps: (sharedProps: props) => Inertia;
    readonly setStatusCode: (statusCode: number) => Inertia;
    readonly setHeaders: (headers: Record<string, string>) => Inertia;
    readonly render: (Page: Page) => Promise<Inertia>;
    readonly redirect: (url: string) => Inertia;
};
export const headers = {
    xInertia: 'x-inertia',
    xInertiaVersion: 'x-inertia-version',
    xInertiaLocation: 'x-inertia-location',
    xInertiaPartialData: 'x-inertia-partial-data',
    xInertiaPartialComponent: 'x-inertia-partial-component',
};
const inertia: (
    options: Options
) => RequestHandler = function ({ version, html, flashMessages }) {
    return (req, res, next) => {
        if (
            req.method === 'GET' &&
            req.headers[headers.xInertia] &&
            req.headers[headers.xInertiaVersion] !== version
        ) {
            return req.session.destroy(() => {
                res.writeHead(409, { [headers.xInertiaLocation]: req.url }).end();
            })
        }

        let _viewData = {};
        let _sharedProps: props = {};
        let _statusCode = 200;
        let _headers = {};

        const Inertia: Inertia = {
            setViewData(viewData) {
                _viewData = viewData;
                return this;
            },

            shareProps(sharedProps) {
                _sharedProps = { ..._sharedProps, ...sharedProps };
                return this;
            },

            setStatusCode(statusCode) {
                _statusCode = statusCode;
                return this;
            },

            setHeaders(headers) {
                _headers = { ..._headers, ...headers };
                return this;
            },

            async render({ props, ...pageRest }) {
                const _page: Page = {
                    ...pageRest,
                    url: req.originalUrl || req.url,
                    version,
                    props,
                };
                log('rendering', _page);
                if (flashMessages) {
                    this.shareProps(flashMessages(req));
                }

                const allProps = { ..._sharedProps, ...props };

                let dataKeys;
                const partialDataHeader = req.headers[headers.xInertiaPartialData]
                if (
                    partialDataHeader &&
                    req.headers[headers.xInertiaPartialComponent] === _page.component &&
                    typeof partialDataHeader === "string"
                ) {
                    dataKeys = partialDataHeader.split(',');
                } else {
                    log(
                        'partial requests without the name of the component return a full request',
                        _page.component
                    );
                    log(
                        'header component',
                        req.headers[headers.xInertiaPartialComponent]
                    );
                    dataKeys = Object.keys(allProps);
                }

                // we need to clear the props object on each call
                const propsRecord: props = {};
                for await (const key of dataKeys) {
                    log('parsing props keys', dataKeys);
                    let value;
                    if (typeof allProps[key] === 'function') {
                        value = await (allProps[key] as () => unknown)();
                        log('prop promise resolved', key);
                    } else {
                        value = allProps[key];
                    }
                    propsRecord[key] = value;
                }
                _page.props = propsRecord;
                log('Page props built', _page.props);

                if (req.headers[headers.xInertia]) {
                    res
                        .status(_statusCode)
                        .set({
                            ..._headers,
                            'Content-Type': 'application/json',
                            [headers.xInertia]: 'true',
                            Vary: 'Accept',
                        })
                        .send(JSON.stringify(_page));
                } else {
                    res
                        .status(_statusCode)
                        .set({
                            ..._headers,
                            'Content-Type': 'text/html',
                        })
                        .send(html(_page, _viewData));
                }
                return this;
            },

            redirect(url) {
                const statusCode = ['PUT', 'PATCH', 'DELETE'].includes(req.method)
                    ? 303
                    : 302;
                res
                    .status(statusCode)
                    .set({ ..._headers, Location: url });
                return this;
            },
        };

        (req as Request & { Inertia: Inertia }).Inertia = Inertia;

        return next();
    };
};
export default inertia;
