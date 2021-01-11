import { TestModifier } from 'folio/out/testModifier';
import fetch from 'node-fetch';

import { headers } from '../lib/koaAdapter';

import { afterEach, describe, expect, it } from './koa.folio';

function skip(skip = true) {
  return (test: TestModifier) => test.skip(skip, 'Skip');
}

const cookies = {
  koa: 'koa.sess',
  express: 'connect.sid'
}
describe('Inertia adapter', () => {
  afterEach(async ({ koa }) => {
    koa.sandbox.reset();
  });

  it('responds with a json response with encoded page object when inertia header is present and version is the same', async ({
    port,
    koa,
  }) => {
    const result = await fetch(`http://localhost:${port}/home`, {
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
    });
    expect(await result.json()).toMatchObject(
      koa.metadata.pages.home as Record<string, unknown>
    );
  });

  it('includes partial data headers on partial request', async ({
    port,
    koa,
  }) => {
    const result = await fetch(`http://localhost:${port}/partial-optimized`, {
      headers: {
        'X-Inertia': 'true',
        'X-Inertia-Version': '1',
        'X-Inertia-Partial-Data': 'numbers',
        'X-Inertia-Partial-Component': 'partial-component',
      },
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      ...koa.metadata.pages.partial,
      props: { numbers: [1, 2, 3] },
    });
    // we are not resetting fake function calls. Might fail
    expect(koa.metadata.fakes.bigNumbers.callCount).toBe(0);
    expect(koa.metadata.fakes.numbers.callCount).toBe(1);
  });
  it('partial requests without the name of the component return a full request', async ({
    port,
    koa,
  }) => {
    const result = await fetch(`http://localhost:${port}/partial-optimized`, {
      headers: {
        'X-Inertia': 'true',
        'X-Inertia-Version': '1',
        'X-Inertia-Partial-Data': 'numbers',
      },
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      ...koa.metadata.pages.partial,
      props: { numbers: [1, 2, 3] },
    });
    expect(koa.metadata.fakes.bigNumbers.callCount).toBe(1);
    expect(koa.metadata.fakes.numbers.callCount).toBe(1);
  });
  it(
    'includes all data headers on none partial request',
    skip(false),
    async ({ port, koa }) => {
      const result = await fetch(`http://localhost:${port}/partial-optimized`, {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      });
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({
        ...koa.metadata.pages.partial,
        props: { numbers: [1, 2, 3], bigNumbers: [44, 33, 1123] },
      });
      expect(koa.metadata.fakes.bigNumbers.callCount).toBe(1);
      expect(koa.metadata.fakes.numbers.callCount).toBe(1);
    }
  );

  it('flash messages are shared as props', async ({ port, koa, type }) => {
    const result = await fetch(`http://localhost:${port}/flash`, {
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
    });
    // flash messages are stored in a cookie
    expect(result.headers.get('set-cookie')?.startsWith(cookies[type])).toBe(true);
    const jsonResult = await result.json();
    expect(jsonResult).toMatchObject({
      ...koa.metadata.pages.home,
      url: '/flash',
      props: {
        ...koa.metadata.pages.home.props,
        success: ['User created successfully'],
      },
    });
  });
  it('re-flashes data when flash session data exists when a 409 Conflict', async ({
    port,
  }) => {
    const result = await fetch(`http://localhost:${port}/flash`, {
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '2' },
    });
    expect(result.status).toBe(409);
    expect(result.statusText).toBe('Conflict');
    expect(result.headers.get(headers.xInertiaLocation)).toBe(`/flash`);
    expect(result.headers.get('set-cookie')).toBe(null);
    // no flash messages
  });

  it(
    'responds with 409 conflict when inertia header is present and version is different',
    skip(false),
    async ({ port }) => {
      const result = await fetch(`http://localhost:${port}/home`, {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '2' },
      });
      expect(result.status).toBe(409);
      expect(result.statusText).toBe('Conflict');
      expect(result.headers.get(headers.xInertiaLocation)).toBe(`/home`);
    }
  );
  it('Note, `409 Conflict` responses are only sent for `GET` requests, and not for POST/PUT/PATCH/DELETE requests', async ({
    port,
  }) => {
    const result = await fetch(`http://localhost:${port}/home`, {
      body: '12',
      method: 'POST',
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '2' },
    });
    expect(result.status).toBe(200);
  });
  it('Partial Reload If the final destination is different for whatever reason, no partial reload occurs', async ({
    koa,
    port,
  }) => {
    const result = await fetch(
      `http://localhost:${port}/partial-optimized?redirect=home`,
      {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'X-Inertia-Partial-Data': 'numbers',
        },
      }
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      ...koa.metadata.pages.home,
      url: '/partial-optimized?redirect=home',
    });
    expect(koa.metadata.fakes.bigNumbers.callCount).toBe(0);
    expect(koa.metadata.fakes.numbers.callCount).toBe(0);
  });
});
