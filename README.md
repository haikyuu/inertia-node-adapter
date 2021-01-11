# inertia-node-adapter

Inertia adapter for nodejs - supports Express and Koa.

This is a fork of https://github.com/jordankaerim/inertia-node with added support for koa, flash messages and integration tests that adhere to Inertia protocol.

This also includes a flash middleware for koa and express as a bonus. You can use it or use your own.

## Usage

For working examples, see the `__tests/testServers` folders. It contains two servers in koa and express. Note The code is a bit tangled because it was written for integration tests in mind.

### Koa

```typescript
import { inertiaKoaAdapter as inertia, koaFlash } from 'inertia-node-adapter';
import session from 'koa-session';
import Router from '@koa/router';

const version = '1';

app.use(session({ maxAge: 86400000 }, app));
app.use(koaFlash()); // optional, but requires using middleware session beforehand
app.use(
  inertia({
    version,
    html: getHtml,
    flashMessages: (ctx) => ctx.flash.flashAll(), // optional, depends on the flash middleware used
  })
);
const router = new Router();
// in your router handlers
router.get('/home', async (ctx, next) => {
  // if flash middleware was added.
  ctx.flash.setFlashMessage('success', 'User created successfully');

  ctx.Inertia.render({
    component: 'home',
    props: { name: 1 },
    url: '/home',
    version,
  });
  next();
})
  app.use(router.routes());
  return next();
});
```

### Express usage

```typescript
import express from 'express';
import session from 'express-session';

const app = express();

app.use(session({ secret: 'secret' }));
const router = express.Router();

router.get('/home', async (req, res, next) => {
  // if flash middleware was added.
  req.flash.setFlashMessage('success', 'User created successfully');

  req.Inertia.render({
    component: 'home',
    props: { name: 1 },
    url: '/home',
    version,
  });
});
app.use(flash());
app.use(
  inertia({
    version,
    html: getHtml,
    flashMessages: (req) => req.flash.flashAll() },
  })
);
app.use(router);
```

## Usage details

`inertia-node` expects two arguments:

1. `html`: a function that recieves the Inertia `page` object and an optional `viewData` object that you can populate with additional data. The function should return an HTML string.
2. `version` (optional): your current asset version

It will return a standard Node.js middleware that you can use with Express.js, Polka etc (or koa if you're using koa adapter). Functions can be accessed from the `Inertia` object that will be added to the `request` / `context`. You can chain functions together but you can't call another function after calling [`render`](#renderpage) or [`redirect`](#redirecturl).

**Note:** In your HTML view function make sure to always stringify the `page` object and include it in the `data-page` attribute of the HTML node you want to render your JavaScript app in. For more infos on how Inertia works read [the protocol](https://inertiajs.com/the-protocol) on the Inertia website.

## API

### setViewData(data)

1. `data`, _Object_ - An Object of additional data you want to pass to your HTML view function

`setViewData` can be used to pass additional data to your [HTML view function](#usage) such as the page's title or other meta data.

```javascript
.use(({ Inertia }, _, next) => {
  Inertia.setViewData({
    title: "Todo App",
    description:"A Web App to Create and Manage Todos"
  })

  next();
})

// ...

const html = (page, viewData) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />

    <meta name="description" content="${viewData.description}">
    <title>${viewData.title}</title>

    <link rel="stylesheet" href="/build/bundle.css" />
    <script defer type="module" src="/build/main.js"></script>
  </head>

  <body id="app" data-page='${JSON.stringify(page)}'></body>
</html>
`;
```

### shareProps(props)

1. `props`, _Object_ - An object of props you want to include with every `render` call

Shared props are props that will be combined with the props you pass to the [`render`](#renderpage) function. When you call `shareProps` more than once, props shared from previous calls will be merged with props from any subsequent calls.

```javascript
.use(({ Inertia }, _, next) => {
  Inertia.shareProps({ username: "ironman" })
  next();
})
.get("/todos", ({ Inertia }) => {
  Inertia.render({
    component: "Todos",
    props: {
      todos: [
        { text: "Study Korean", done: false },
        { text: "Cook Arabic food", done: false },
      ]
    }
    // JavaScript component on the client will receive
    // {
    //   username: "ironman",
    //   todos: [
    //     { "Study Korean", done: false },
    //     { "Cook Arabic food", done: false },
    //   ]
    // }
  });
})
```

### setHeaders(headers)

1. `headers`, _Object_ - An Object of custom headers you want to include in your response

Add custom headers to your response.

**Note:** Headers that are required by Inertia take precedence and cannot be overwritten.

```javascript
.get("/", ({ Inertia }) => {
  Inertia
    .setHeaders({
      token: "7pTgHCv0JgeAyyBRDpUi"
    })
    .render({
      component: "Index",
      props: { username: "ironman" }
    });
})
```

### setStatusCode(statusCode)

1. `statusCode`, _number_ - The response's status code

Change the status code when sending a response. Useful for e.g. when you want to render an error. Headers set from previous calls will be merged with headers set from any subsequent calls.

```javascript
.get("/", ({ Inertia }) => {
  Inertia.render({
    component: "Index",
    props: { username: "ironman" }
  });
})
.use(({ Inertia }) => {
  Inertia
    .setStatusCode(404)
    .render({
      component: "Error",
      props: { message: "Page not found" },
    });
})
```

### render(page)

1. `page`, _Object_ - the Inertia page object

This function will send your response as either a HTML or JSON string to the client depending on wether the client is requesting your page for the first time or is making a subsequent Inertia request.

The Inertia page object consists of the following properties:

1. `component`, _string_ - The name of the JavaScript component to render on the client
2. `props`, _Object_ - The page props (data)
3. `url`, _string_ - The URL of the route. This will be automatically added by the middleware.
4. `version`, _string_ - The asset version. This will be automatically added by the middleware.

```javascript
.get("/todos", ({ Inertia }) => {
  Inertia.render({
    component: "Todos",
    props: {
      todos: [
        { text: "Study Korean", done: false },
        { text: "Cook Arabic food", done: false },
      ]
    },
  });
})
```

On Partial Reloads only props requested by the client will be sent. To improve performance on the server you can wrap each prop inside a function so that they will only be evaluated when necessary.

```javascript
.get("/todos", ({ Inertia }) => {
  const todos = async () => await database.getTodos();
  const bookmarks = async () => await database.getBookmarks();

  Inertia.render({
    component: "Todos",
    props: {
      todos,
      bookmarks
    },
  });
})
```

Now when the client only requests `todos` the middleware will hit the database only once and not call `bookmarks`.

### redirect(url)

1. `url`, _string_ - The URL to redirect to

Redirect the client to a different URL.

```javascript
.post("/todos", (req, res) => {
  database.createTodo(req.body);
  req.Inertia.redirect("/todos");
})
```

**Note:** Inertia requires you to use a `303` status code when redirecting upon a `PUT`, `PATCH` or `DELETE` request and a `302` status code otherwise. The `redirect` function will automatically take care of this for you. If you handle redirects yourself make sure to select the correct status code.

**Note:** Calling [`setStatusCode`](#renderpage) before [`redirect`](#redirecturl) has no effect.

## Credits

- [Jordan Kaerim](https://github.com/jordankaerim).
