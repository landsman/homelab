import { Link } from "@tanstack/react-router";
import { POSTS, formatDate } from "@/features/blog/posts";
import { m } from "@/paraglide/messages.js";

// No menu links here yet: the blog is found by its address, and by search
// engines through its sitemap (vite/sitemap.ts).
export function BlogPage() {
  return (
    <main className="wrapper">
      <h1>{m.blog_heading()}</h1>

      <ul className="content blog-list">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <Link to="/blog/$slug" params={{ slug: post.slug }}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
