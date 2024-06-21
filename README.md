# asType

You've got `interface`s causing problems and you want `type`s instead: use `asType`!
Check out this [minimal TypeScript playground](https://tsplay.dev/Wk1pJN) to quickly get the gist of what's this is all about.
Then keep read this doc.

## Install

Copy/paste `asType.ts` into your project.
It's tiny and you can adapt it to fit your needs.

## The Problem

### Interface merging

In TypeScript, `type` and `interface` are fundamentally different.
The most important difference is that interfaces support [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html).
That means _any_ code that's part of your app (including dependencies) can change an interface.
It's a powerful feature and with great power comes great responsibility.

```ts
// blah.ts
interface Blah {
  x: number
}

interface Blah {
  y: string
}

let a: Blah = { x: 1, y: "hello" }
```

```ts
// some-other-file.ts
declare module "./blah.ts" {
  interface Blah {
    z: boolean
  }
}

// elsewhere.ts
import { Blah } from "blah"
let b: Blah = { x: 1, y: "hello", z: false }
```

To me this feels like [spooky action at a distance](https://en.wikipedia.org/wiki/Quantum_entanglement#:~:text=Like%20Einstein%2C%20Schr%C3%B6dinger%20was%20dissatisfied,spooky%20action%20at%20a%20distance.%22), so I tend to avoid `interface`s unless I really need them.

### Interfaces behave unintuitively

Unfortunately, you can't always use `type`.
Sometimes you really do want interface merging.
Or much more commonly, you might be using a dependency that use `interface`s internally.

So what exactly is the problem with `interface`?

> Because interfaces can be augmented by additional declarations but type aliases can't, it's "safer" (heavy quotes on that one) to infer an implicit index signature for type aliases than for interfaces. ([source](https://github.com/microsoft/TypeScript/issues/15300#issuecomment-332366024))
>
> -- Ryan Cavanaugh (Development lead for the TypeScript team at Microsoft)

Ok so that's the theoretical knowledge, but let's make it concrete by looking at an example:

```ts
// Example: arbitrarily nested objects with string or number values
type Data = number | string | { [key: PropertyKey]: Serializable }

let a: Data = { x: 1 }
let b: Data = { x: 1, y: { z: "hello" } }

function save(data: Data) {
  // ...some irrelevant code goes here...
}
```

With `type`s, thing work like you expect them to:

```ts
type PostT = {
  title: string
}
const post: PostT = { title: "my post" }
save(post) // ✅
```

But not so with `interface`s:

```ts
interface PostI {
  title: string
}
const post: PostI = { title: "my post" }
save(post) // ❌ 😱
//   ^^^^
// Argument of type 'PostI' is not assignable to parameter of type 'Data'.
//   Type 'PostI' is not assignable to type '{ [key: string]: Data; }'.
//     Index signature for type 'string' is missing in type 'PostI'.(2345)
```

[View this example as in TypeScript playground](https://tsplay.dev/WY10xW)

## The Solution

Shouldn't TypeScript itself change `interface` so that these problems go away?
Interface merging has legimate use-cases so TS can't just remove `interface` in favor of `type`.
The TS team also think that changing `interface`s in this way would be ["an incredibly disruptive breaking change without much concrete upside"](https://github.com/microsoft/TypeScript/issues/15300#issuecomment-1320620897).

### Prefer `type` over `interface`

Unless you explicitly _want_ interface merging, go with `type`.

I've seen some folks argue that you should use `interface` over `type` for performance reasons.
Apparently there are some scenarios where the TS type checker is faster when processing `interface` than `type`.

My first question is always: "Have you profiled it?"
Maybe `interface` vs `type` perf is insignificant for your project.
But even if you _have_ profiled it, know that you are changing the _semantics_ of your types by replacing `type` with `interface`.
They mean different things today and they will continue to mean different things tomorrow.
Whereas the TS type checker could get faster tomorrow.

But what if you don't control that code? Like what if its coming from a dependency?

### Attempts at manual fixes

In the specific example, TS is telling us that `PostI` is missing an index signature so we could just add one:

```ts
interface PostI {
  [key: string]: Data
}
```

And since interface declarations merge, you could even do this for interfaces you don't own:

```ts
// some-other-file
declare module "some-other-file" {
  interface PostI {
    [key: string]: Data
  }
}
```

But there are two big issues with this approach

1. You have to hunt down _all_ `interface`s you may be using and patch them up like this, including any `interface`s nested within other types
2. If you have `skipLibCheck` enabled, you won't get any errors when patching `interface`s that _should_ cause type checking errors

```ts
// myapp.ts
import type { Data } from "./data"

declare module "some-dependency" {
  interface NotData {
    [key: string]: Data // 👈 in user-land, we patch `NotData` with an index signature...
  }
}

// node_modules/some-dependency/index.d.ts
interface NotData {
  bad: () => number // 👈 ...but its incompatible with `bad`!
  //  Property 'bad' of type '() => number' is not assignable to 'string' index type 'Data'. ts (2411)
}
```

By default, TS will throw a type checking error on the line that defines `bad`.
But if you have `skipLibCheck` enabled in your `tsconfig.json`, that error disappears since its in your dependencies.
Which is bad since there's a legit error here with the way you patched `NotData` in your app code.

Ok so just don't enable `skipLibCheck` right?
Well, it's [generally recommended that you do enable `skipLibCheck`](https://www.totaltypescript.com/tsconfig-cheat-sheet) since the reality is that there are tons of libraries out there with gnarly type errors that don't actually affect your app.

Alternatively, you could patch `NotData` to extend `Data`:

```ts
// interface `extends` needs to be an object type
// so just wrap `Data` in an object for when we patch with `extends`
type DataObject = { [key: string]: Data }

declare module "some-dependency" {
  interface NotData extends DataObject {}
}
```

But that also runs into the same issues as before: enabling `skipLibCheck` means you won't get any errors for this unsafe patch.

### The REAL fix

Use the `asType` utility from this repo to convert `interface`s to `type`s.
It'll even work for nested `interface`s!

```ts
interface ShouldWork {
  title: string
}

let data: ShouldWork = { title: "c'mon, you can do this" }

// before
save(data) // ❌ without `asType`, you'll get index signature errors

// after
save(asType(data)) // ✅ with `asType`, things work!

interface ShouldNotWork {
  title: string
  log: () => void // 👈 functions aren't allowed in `Data` so this should error if we try to `save`
}
let badData: ShouldNotWork = { title: "uh oh", log: () => console.log("oops") }

// before
save(data) // ❌ without `asType`, you'll get inscrutable, irrelevant errors about index signatures
//   ^^^^
// Argument of type 'ShouldNotWork' is not assignable to parameter of type 'Data'.
//   Type 'ShouldNotWork' is not assignable to type '{ [key: string]: Data; }'.
//     Index signature for type 'string' is missing in type 'ShouldNotWork'.(2345)

// after
save(asType(data)) // ✅ with `asType`, you get the correct error showing `log` to be the problem
//   ^^^^^^^^^^^^
// Argument of type '{ title: string; log: () => void; }' is not assignable to parameter of type 'Data'.
//   Type '{ title: string; log: () => void; }' is not assignable to type '{ [key: string]: Data; }'.
//     Property 'log' is incompatible with index signature.
//       Type '() => void' is not assignable to type 'Data'.(2345)
```

[View this example in a TypeScript playground](https://tsplay.dev/Wk1pJN)
