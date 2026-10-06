import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { POSTS, formatDate } from "@/features/blog/posts";
import { m } from "@/paraglide/messages.js";

// No menu links here yet: the blog is found by its address, and by search
// engines through its sitemap (vite/sitemap.ts).
export function BlogPage() {
  // `?qa=true` lists the hidden posts too, marked, for checking one before it
  // is out. Read once the page runs: the file is built without a query, and
  // the first render has to match it.
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const [qa, setQa] = useState(false);
  useEffect(() => setQa(new URLSearchParams(search).get("qa") === "true"), [search]);
  const posts = qa ? POSTS : POSTS.filter((post) => !post.hidden);

  return (
    <main className="wrapper">
      <h1>{m.blog_heading()}</h1>

      {posts.length === 0 ? (
        <p className="content">{m.blog_empty()}</p>
      ) : (
        <ul className="content blog-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <time dateTime={post.published}>{formatDate(post.published)}</time>
              <Link to="/blog/$slug" params={{ slug: post.slug }} lang={post.lang}>
                {post.title}
              </Link>
              {post.hidden && <span className="blog-hidden">{m.blog_hidden()}</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
