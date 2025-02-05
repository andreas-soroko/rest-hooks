---
title: Rest v6 - url path templates and more
authors: [ntucker]
tags:
  [
    releases,
    rest-hooks,
    packages,
    rest,
    http,
    path-to-regex,
    resource,
    endpoint,
    typescript,
  ]
---

import HooksPlayground from '@site/src/components/HooksPlayground';

<head>
  <title>@rest-hooks/rest@6 - TypeScript HTTP endpoints from url path templates.</title>
</head>

Today we're releasing [@rest-hooks/rest](/rest/usage) version 6. While this is a pretty
radical departure from previous versions, there is no need to upgrade if previous versions are
working as they will continue to work with the current 6.4 release of Rest Hooks as well as many
future versions.

First, we have completely decoupled the _networking lifecycle_ [RestEndpoint](/rest/api/RestEndpoint)
from the _data lifecycle_ [Schema](/rest/api/schema). Collections of Endpoints that operate on the same
data can be consgtructed by calling [createResource](/rest/api/createResource).

## RestEndpoint

<HooksPlayground row>

```tsx title="api/getTodo.ts"
const getTodo = new RestEndpoint({
  urlPrefix: 'https://jsonplaceholder.typicode.com',
  path: '/todos/:id',
});
```

```tsx title="TodoDetail.tsx" collapsed=true
function TodoDetail({ id }: { id: number }) {
  const todo = useSuspense(getTodo, { id });
  return <div>{todo.title}</div>;
}
render(<TodoDetail id={1} />);
```

</HooksPlayground>

The new [RestEndpoint](/rest/api/RestEndpoint) optimizes configuration based around HTTP
networking. Urls are constructed based on simple named parameters, which are [enforced with
strict TypeScript automatically](/rest/api/RestEndpoint#typing).

## createResource

<HooksPlayground row>

```tsx title="api/Todo.ts"
class Todo extends Entity {
  id = 0;
  userId = 0;
  title = '';
  completed = false;
  pk() {
    return this.id;
  }
}
const TodoResource = createResource({
  urlPrefix: 'https://jsonplaceholder.typicode.com',
  path: '/todos/:id',
  schema: Todo,
});
```

```tsx title="TodoDetail.tsx" collapsed=true
function TodoDetail({ id }: { id: number }) {
  const todo = useSuspense(TodoResource.get, { id });
  return <div>{todo.title}</div>;
}
render(<TodoDetail id={1} />);
```

</HooksPlayground>

[createResource](/rest/api/createResource) creates a simple collection of [RestEndpoints](/rest/api/RestEndpoint).
These can be easily overidden, removed as appropriate - or not used altogether. [createResource](/rest/api/createResource)
is intended as a quick start point and as a guide to best practices for API interface ergonomics. It is expected
to extend or replace createResource based on the common patterns for your own API.

```typescript
const todo = useSuspense(TodoResource.get, { id: '5' });
const todos = useSuspense(TodoResource.getList);
controller.fetch(TodoResource.create, { content: 'ntucker' });
controller.fetch(TodoResource.update, { id: '5' }, { content: 'ntucker' });
controller.fetch(
  TodoResource.partialUpdate,
  { id: '5' },
  { content: 'ntucker' },
);
controller.fetch(TodoResource.delete, { id: '5' });
```

<!--truncate-->

## Motivation

Previously, [Resource](/rest/5.2/api/resource) _was_ an [Entity](/rest/5.2/api/Entity). Endpoints are defined as [static members](/rest/5.2/api/resource#detail).

The motivation is for brevity: This allows one import to both define the expected type as well as access the endpoints to send as hook 'subjects'.

### Problems

However, this lead to some problems. Originally it was thought many of these would be eliminated by improvements
in related technologies.

1. Class static side is not well supported by TypeScript. This leads to the somewhat confusing but also limiting [generic workaround](https://resthooks.io/rest/guides/rest-types).
2. Inheritance does not work well for providing out-of-the-box endpoint definitions. Overrides are better
   - It's a struggle between general types that allow overrides or precise types that help developers.
   - Hacks like ‘SchemaDetail’ are an attempt around this but are confusing, expensive for typescript to compute and likely break in certain configurations.
3. Union Resources are awkward to define as their expected schema ends up not being the Entity.
   - In general, custom schemas are often shared by multiple endpoints, making it desirable to not require them to be just an Entity
4. Endpoints themselves don't maintain referential equality
   - This results in hacks in our hooks that violate expectations (ignoring referential changes to endpoints). There are legit reasons one might want to create a endpoint that changes and have that trigger fetches.

Probably most of all is that sharing data lifecycles with networking lifecycles made them quite a bit confusing in
many ways.

## Custom Networking

Customizations can be done easily with both [RestEndpoint inheritance](/rest/api/RestEndpoint#inheritance)
as well as [RestEndpoint.extend()](/rest/api/RestEndpoint#extend). Explore the [fetch lifecycle](/rest/api/RestEndpoint#fetch-lifecycle)
to understand how these customizations affect fetch.

### Base overrides for lifecycles

```ts
class GithubEndpoint<
  O extends RestGenerics = any,
> extends RestEndpoint<O> {
  getRequestInit(body: any): RequestInit {
    if (body) {
      return super.getRequestInit(deeplyApplyKeyTransform(body, snakeCase));
    }
    return super.getRequestInit();
  }

  async parseResponse(response: Response) {
    const results = await super.parseResponse(response);
    if (
      (response.headers && response.headers.has('link')) ||
      Array.isArray(results)
    ) {
      return {
        link: response.headers.get('link'),
        results,
      };
    }
    return results;
  }

  process(value: any, ...args: any) {
    return deeplyApplyKeyTransform(value, camelCase);
  }
}
```

### Default values

```ts
class IssueEndpoint<O extends RestGenerics=any> extends GithubEndpoint<O> {
  pollFrequency = 60000;
}
```

## Pagination

[Infinite scrolling pagination](/rest/guides/pagination#infinite-scrolling) can be achieved by creating a new pagination endpoint
for from any list endpoints [RestEndpoint.paginated()](/rest/api/RestEndpoint#paginated) method.

```ts
const MyResource.getNextPage = MyResource.getList.paginated(
  ({
    cursor,
    ...rest
  }: {
    cursor: string | number;
    group: string | number;
  }) => [rest],
);
```

## Hook context for fetch construction

In cases where React context is needed to perform networking requests, we can construct hook
endpoint generators with an augmentation function [hookifyResource](/rest/api/hookifyResource)

This utilizes the new key+string rewriting magic of TypeScript 4.2+. This means it won't be
as strongly typed when using previous versions of TypeScript.

```ts
const ContextAuthdArticleResourceBase = createResource({
  path: 'http\\://test.com/article/:id',
  schema: Article,
});
export const ContextAuthdArticleResource = hookifyResource(
  {
    ...ContextAuthdArticleResourceBase,
    getListWithUser: ContextAuthdArticleResourceBase.getList.extend({
      url: () =>
        (ContextAuthdArticleResourceBase.getList.url as any)({
          includeUser: true,
        }),
    }),
  },
  function useInit() {
    const accessToken = useContext(AuthContext);
    return {
      headers: {
        'Access-Token': accessToken,
      },
    };
  },
);
```

```tsx
const article = useSuspense(ContextAuthdArticleResource.useGet(), { id });
const updateArticle = ContextAuthdArticleResource.useUpdate()
const onSubmit = () => controller.fetch(updateArticle, { id }, body);

return <Form onSubmit={onSubmit} initialValues={article} />
```

# Demo

Explore common patterns with this implementation using the GitHub API.

<iframe
  src="https://stackblitz.com/github/coinbase/rest-hooks/tree/master/examples/github-app?embed=1&file=src%2Fresources%2FIssue.tsx&hideNavigation=1&hideDevTools=1&view=editor"
  width="738"
  height="700"
  style={{ width: '100%' }}
></iframe>

# Next Steps

See the [full documentation for @rest-hooks/rest@6](/rest) for more detailed guides that cover all the functionality.

[The PR for RestEndpoint, createResource, and hookifyResource](https://github.com/coinbase/rest-hooks/pull/2187)
