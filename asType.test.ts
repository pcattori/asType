import { asType } from "./astype"

// Example: strings OR arbitrarily nested objects with string values
type Serializable = string | { [key: PropertyKey]: Serializable }

// good type
type BlogPostT = { title: string }
declare const t: BlogPostT
t satisfies Serializable // ✅ expected pass, actual pass

// good interface
interface BlogPostI {
  title: string
}
declare const i: BlogPostI
i satisfies Serializable // ❌ expected pass, actual fail with inscrutable error
asType(i) satisfies Serializable // ✅ expected pass, actual pass

// bad type
type BadBlogPostT = BlogPostT & { fn: () => number }
declare const badT: BadBlogPostT
badT satisfies Serializable // ✅ expected fail, actual fail with nice error

// bad interface
interface BadBlogPostI extends BlogPostI {
  fn: () => number
}
declare const badI: BadBlogPostI
badI satisfies Serializable // ❌ expected fail, actual fail with inscrutable error
asType(badI) satisfies Serializable // ✅ expected fail, actual fail with nice error
