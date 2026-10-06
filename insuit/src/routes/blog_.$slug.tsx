import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { POST_LANGS } from "@/features/blog/post.types";
import { loadPost } from "@/features/blog/posts";
import { PostPage } from "@/features/blog/post-page";
import { m } from "@/paraglide/messages.js";
import styles from "@/styles/components/blog.css?url";

export const Route = createFileRoute("/blog_/$slug")({
  // The footer's Back leads to the list, not home.
  staticData: { up: ROUTES.blog },
  loader: ({ params }) => loadPost(params.slug),
  // No post, no data: the root's "page not found" tags stay.
  head: ({ loaderData: post }) =>
    post
      ? {
          meta: pageMeta({
            title: m.blog_post_title({ title: post.title }),
            description: post.description,
            path: `${ROUTES.blog}/${post.slug}`,
            type: "article",
            locale: POST_LANGS[post.lang],
            published: post.published,
            updated: post.updated,
            hidden: post.hidden,
          }),
          links: [{ rel: "stylesheet", href: styles }],
        }
      : {},
  component: () => <PostPage post={Route.useLoaderData()} />,
});
