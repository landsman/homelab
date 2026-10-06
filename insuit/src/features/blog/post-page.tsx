import { Suspense } from "react";
import { POST_COMPONENTS } from "@/features/blog/components";
import type { PostMeta } from "@/features/blog/post.types";
import { formatDate, usePostBody } from "@/features/blog/posts";
import { m } from "@/paraglide/messages.js";

export function PostPage({ post }: { post: PostMeta }) {
  const Body = usePostBody(post.slug);
  return (
    <main className="wrapper">
      {/* The post's own language, which a screen reader reads it in; the page
          around it is the site's. */}
      <article className="blog-post" lang={post.lang}>
        <h1>{post.title}</h1>
        <p className="blog-date">
          <time dateTime={post.published}>{formatDate(post.published)}</time>
          {post.updated && (
            <>
              {" · "}
              {m.blog_updated({ date: formatDate(post.updated) })}
            </>
          )}
        </p>
        <div className="content">
          <Suspense>
            <Body components={POST_COMPONENTS} />
          </Suspense>
        </div>
      </article>
    </main>
  );
}
