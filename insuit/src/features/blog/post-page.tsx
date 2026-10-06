import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import type { PostMeta } from "@/features/blog/post.types";
import { formatDate, usePostBody } from "@/features/blog/posts";
import { m } from "@/paraglide/messages.js";

export function PostPage({ post }: { post: PostMeta }) {
  const Body = usePostBody(post.slug);
  return (
    <main className="wrapper">
      <article>
        <h1>{post.title}</h1>
        <p className="blog-date">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
        <div className="content">
          <Suspense>
            <Body />
          </Suspense>
        </div>
      </article>
      <p>
        <Link to={ROUTES.blog}>{m.blog_all_posts()}</Link>
      </p>
    </main>
  );
}
